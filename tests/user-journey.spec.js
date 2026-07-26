#!/usr/bin/env node
/*
 * Full member journey, end to end.
 *
 * Run:  node tests/user-journey.spec.js  [baseUrl]
 *       default baseUrl = http://localhost:8789
 *
 * Drives the ?demo sandbox, which mocks the API in localStorage. That lets every
 * MUTATING endpoint be exercised — register, add MT5, request IB, request
 * whitelist, update profile, logout — without writing to production D1 or firing
 * Telegram alerts at the operator.
 *
 * Covers the journey a real member actually takes:
 *   register -> dashboard -> request IB -> add MT5 -> request whitelist
 *   -> edit profile -> logout -> log back in
 */
'use strict';

const path = require('path');
const BASE = process.argv[2] || 'http://localhost:8789';

function loadPlaywright() {
  const candidates = [
    'playwright',
    '/Users/anyaazman/Development/Mamba-Website/tools/valetax-sync/node_modules/playwright',
    path.resolve(__dirname, '../tools/valetax-sync/node_modules/playwright'),
    path.resolve(__dirname, '../node_modules/playwright'),
  ];
  for (const c of candidates) { try { return require(c); } catch (e) {} }
  console.error('Playwright not found.'); process.exit(1);
}
const { chromium, devices } = loadPlaywright();

let failures = [];
let passed = 0;
const ck = (name, cond, detail) => {
  if (cond) { passed++; console.log(`    ok   ${name}`); }
  else { failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`    FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

const EMAIL = `journey${Date.now()}@example.com`;
const PW = 'secret12345';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const http5xx = [];
  page.on('response', r => { if (r.status() >= 500) http5xx.push(`${r.url().split('/').pop()}:${r.status()}`); });

  // ---- 1. Register --------------------------------------------------------
  console.log('\n  [1] register');
  await page.goto(`${BASE}/login.html?demo#register`, { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  ck('register tab opens from #register',
     await page.evaluate(() => document.querySelector('.auth-tab.active')?.getAttribute('data-target') === 'register'));

  await page.fill('#reg-name', 'Journey Test');
  await page.fill('#reg-email', EMAIL);
  await page.fill('#reg-password', PW);
  await page.fill('#reg-confirm', PW);
  await page.fill('#reg-recovery', 'blue ocean 42');
  ck('consent blocks submit until ticked',
     await page.evaluate(() => !document.querySelector('.register-form').checkValidity()));
  await page.check('#reg-terms');
  await page.click('.register-form .submit-btn');
  await page.waitForTimeout(3000);
  ck('lands on dashboard', /dashboard/.test(page.url()), page.url());

  // ---- 2. Dashboard initial state ----------------------------------------
  console.log('\n  [2] dashboard renders for a brand-new account');
  const initial = await page.evaluate(() => ({
    greeting: document.getElementById('dashboardGreeting')?.textContent.trim(),
    banner: (document.getElementById('ibBanner')?.textContent || '').replace(/\s+/g, ' ').trim(),
    steps: document.querySelectorAll('.onboarding-step').length,
    ibBtn: document.querySelector('#ibBanner button')?.textContent.trim(),
    mt5Rows: document.querySelectorAll('.mt5-account-row').length,
  }));
  ck('greeting shown', !!initial.greeting, initial.greeting);
  ck('3 onboarding steps', initial.steps === 3, String(initial.steps));
  ck('IB banner says not verified', /NOT VERIFIED/i.test(initial.banner), initial.banner.slice(0, 40));
  ck('IB button offers to request', initial.ibBtn === 'Request IB Verification', initial.ibBtn);
  ck('no MT5 accounts yet', initial.mt5Rows === 0, String(initial.mt5Rows));

  // ---- 3. MT5 add is gated behind IB -------------------------------------
  // dashboard.js:632 — the button opens #ibRequiredModal and returns without
  // ever revealing the form, so assert the gate, not a form that cannot appear.
  console.log('\n  [3] IB gate blocks adding an MT5 account');
  await page.click('#addMT5Btn');
  await page.waitForTimeout(900);
  const gated = await page.evaluate(() => ({
    modalOpen: document.getElementById('ibRequiredModal')?.classList.contains('active'),
    formVisible: getComputedStyle(document.getElementById('addMT5Form')).display !== 'none',
    rows: document.querySelectorAll('.mt5-account-row').length,
    scrollLocked: document.body.style.overflow === 'hidden',
  }));
  ck('IB-required modal opens', gated.modalOpen === true);
  ck('add form stays closed', gated.formVisible === false);
  ck('no account created', gated.rows === 0, String(gated.rows));
  ck('background scroll locked', gated.scrollLocked === true);

  // close it again
  await page.evaluate(() => {
    const m = document.getElementById('ibRequiredModal');
    if (m) m.classList.remove('active');
    document.body.style.overflow = '';
  });
  await page.waitForTimeout(300);

  // ---- 4. Request IB ------------------------------------------------------
  console.log('\n  [4] request IB verification');
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, .ib-required-popup').forEach(e => e.classList.remove('active'));
  });
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('mamba_demo_v2'));
    db.users.forEach(u => { u.ib_email = 'me@example.com'; u.ib_status = 'pending'; });
    localStorage.setItem('mamba_demo_v2', JSON.stringify(db));
    const u = JSON.parse(localStorage.getItem('mamba_user'));
    u.ib_email = 'me@example.com'; u.ib_status = 'pending';
    localStorage.setItem('mamba_user', JSON.stringify(u));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2600);
  const pending = await page.evaluate(() => ({
    banner: (document.getElementById('ibBanner')?.textContent || '').replace(/\s+/g, ' ').trim(),
    bannerBtn: document.querySelector('#ibBanner button')?.textContent.trim(),
    bannerBtnDisabled: document.querySelector('#ibBanner button')?.disabled,
    step2Btn: document.querySelector('#onboardingStep2 button')?.textContent.trim(),
  }));
  ck('banner shows pending', /PENDING/i.test(pending.banner), pending.banner.slice(0, 40));
  ck('banner button disabled "Under Review"',
     pending.bannerBtn === 'Under Review' && pending.bannerBtnDisabled === true, pending.bannerBtn);
  ck('step 2 agrees (no re-request offered)',
     pending.step2Btn === 'Verification Pending', pending.step2Btn);

  // ---- 5. Approve IB, then add MT5 ---------------------------------------
  console.log('\n  [5] add MT5 once IB approved');
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('mamba_demo_v2'));
    db.users.forEach(u => { u.ib_status = 'approved'; });
    localStorage.setItem('mamba_demo_v2', JSON.stringify(db));
    const u = JSON.parse(localStorage.getItem('mamba_user'));
    u.ib_status = 'approved';
    localStorage.setItem('mamba_user', JSON.stringify(u));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2600);
  await page.click('#addMT5Btn');
  await page.waitForTimeout(400);
  await page.fill('#newMT5Input', '9990001');
  await page.click('#saveMT5Btn');
  await page.waitForTimeout(2400);
  const added = await page.evaluate(() => {
    const r = document.querySelector('.mt5-account-row');
    return { rows: document.querySelectorAll('.mt5-account-row').length,
             txt: r ? r.textContent.replace(/\s+/g, ' ').trim() : null,
             hasReqBtn: !!document.querySelector('.request-whitelist-btn') };
  });
  ck('MT5 account created', added.rows === 1, `${added.rows} rows`);
  ck('shows PENDING badge', /PENDING/.test(added.txt || ''), added.txt);
  ck('offers Request Whitelist', added.hasReqBtn);

  // ---- 6. Request whitelist ----------------------------------------------
  console.log('\n  [6] request whitelist');
  await page.click('.request-whitelist-btn');
  await page.waitForTimeout(2600);
  const wl = await page.evaluate(() => {
    const r = document.querySelector('.mt5-account-row');
    return { txt: r ? r.textContent.replace(/\s+/g, ' ').trim() : null,
             note: !!document.querySelector('.mt5-review-note'),
             btn: !!document.querySelector('.request-whitelist-btn') };
  });
  ck('state visibly changes', wl.note && !wl.btn, wl.txt);
  ck('reads "under review"', /under review/i.test(wl.txt || ''), wl.txt);

  // ---- 7. Edit profile ----------------------------------------------------
  // The real modal is #editModal with #edit-name and a submit .save-btn
  // inside #editForm — not an inline form in the profile card.
  console.log('\n  [7] edit profile');
  await page.click('#editProfileBtn');
  await page.waitForTimeout(800);
  ck('edit modal opens',
     await page.evaluate(() => document.getElementById('editModal')?.classList.contains('active')));
  await page.fill('#edit-name', 'Renamed Tester');
  await page.click('#editForm .save-btn');
  await page.waitForTimeout(2400);
  const prof = await page.evaluate(() => ({
    modalClosed: !document.getElementById('editModal')?.classList.contains('active'),
    profile: (document.getElementById('profileContent')?.textContent || '').replace(/\s+/g, ' ').trim(),
    greeting: document.getElementById('dashboardGreeting')?.textContent.trim(),
    scrollReleased: document.body.style.overflow !== 'hidden',
  }));
  ck('modal closes after save', prof.modalClosed);
  ck('profile shows new name', /Renamed Tester/.test(prof.profile), prof.profile.slice(0, 70));
  ck('greeting updates too', /Renamed/i.test(prof.greeting || ''), prof.greeting);
  ck('scroll lock released', prof.scrollReleased);

  // ---- 8. Logout and log back in -----------------------------------------
  console.log('\n  [8] logout and re-login');
  await page.click('#logoutBtn');
  await page.waitForTimeout(2200);
  ck('logout returns to login', /login/.test(page.url()), page.url());
  ck('token cleared', await page.evaluate(() => !localStorage.getItem('mamba_token')));

  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PW);
  await page.click('.login-form .submit-btn');
  await page.waitForTimeout(3000);
  ck('can log back in', /dashboard/.test(page.url()), page.url());
  const persisted = await page.evaluate(() => document.querySelectorAll('.mt5-account-row').length);
  ck('data persisted across session', persisted === 1, `${persisted} rows`);

  // ---- 9. Hygiene ---------------------------------------------------------
  console.log('\n  [9] hygiene');
  ck('no 5xx responses', http5xx.length === 0, http5xx.join(', '));
  ck('no uncaught JS errors', errors.length === 0, errors[0]);

  await browser.close();
  console.log(`\n  ${passed} passed, ${failures.length} failed`);
  if (failures.length) { failures.forEach(f => console.log('   - ' + f)); process.exit(1); }
  console.log('  USER JOURNEY PASSED');
})().catch(e => { console.error(e); process.exit(1); });
