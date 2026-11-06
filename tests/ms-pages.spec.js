#!/usr/bin/env node
/*
 * The Malay site in a real browser.
 *
 * Run:  npx wrangler pages dev . --port 8789 --local     (in another shell)
 *       node tests/ms-pages.spec.js  [baseUrl]
 *
 * Pages are opened at /ms/<page>, which is how a preview deployment serves
 * them; in production my.mambaapp.online/<page> is rewritten to the same file.
 * On localhost demo.js answers the API from localStorage, so sign-up and the
 * dashboard journey run without writing to D1 or alerting Telegram. The API
 * translation is checked separately against the real local Worker.
 */
'use strict';

const path = require('path');
const http = require('http');
const BASE = process.argv[2] || 'http://localhost:8789';

function loadPlaywright() {
  const candidates = [
    'playwright',
    path.resolve(__dirname, '../tools/valetax-sync/node_modules/playwright'),
    '/Users/anyaazman/Development/Mamba-Website/tools/valetax-sync/node_modules/playwright',
  ];
  for (const c of candidates) { try { return require(c); } catch (e) {} }
  console.error('Playwright not found.'); process.exit(1);
}
const { chromium, devices } = loadPlaywright();

let failures = 0, passed = 0;
const ck = (name, cond, detail) => {
  if (cond) { passed++; console.log(`    ok   ${name}`); }
  else { failures++; console.log(`    FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

const PAGES = ['', 'how-Mamba-work', 'login', 'reset-password', 'dashboard', 'support', 'account-deletion',
               'privacy-policy', 'terms-of-service', 'risk-disclosure'];

function post(route, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + route);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers } }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(data); } catch (e) {} resolve({ status: res.statusCode, json, data }); });
    });
    req.on('error', reject);
    req.end(body);
  });
}

(async () => {
  const browser = await chromium.launch();

  // ---- 1. every Malay page loads cleanly ----------------------------------
  console.log('\n  [1] each Malay page, desktop and phone');
  for (const device of [{ name: 'desktop', opts: { viewport: { width: 1280, height: 860 } } }, { name: 'phone', opts: { ...devices['Pixel 7'] } }]) {
    const ctx = await browser.newContext(device.opts);
    // Keep the dashboard from bouncing to sign-in, and keep the setup prompt off.
    await ctx.addInitScript(() => {
      try {
        if (!localStorage.getItem('mamba_token')) {
          localStorage.setItem('mamba_setup_prompt_dismissed_until', String(Date.now() + 864e5));
        }
      } catch (e) {}
    });
    for (const p of PAGES) {
      const page = await ctx.newPage();
      const errors = [], badAssets = [], msAssets = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => {
        const u = new URL(r.url());
        if (u.origin === new URL(BASE).origin && r.status() >= 400 && !u.pathname.startsWith('/api/')) badAssets.push(`${u.pathname}:${r.status()}`);
      });
      page.on('request', r => {
        const u = new URL(r.url());
        if (u.origin === new URL(BASE).origin && u.pathname.startsWith('/ms/') && r.resourceType() !== 'document') msAssets.push(u.pathname);
      });
      await page.goto(`${BASE}/ms/${p}`, { waitUntil: 'load' });
      await page.waitForTimeout(400);
      const info = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        mambaLang: window.MAMBA_LANG,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        switchHref: document.querySelector('[data-lang-switch]')?.getAttribute('href') || '',
      }));
      const label = `${device.name} /ms/${p}`;
      ck(`${label}: lang="ms" and i18n active`, info.lang === 'ms' && info.mambaLang === 'ms', JSON.stringify(info));
      ck(`${label}: no script errors`, errors.length === 0, errors.join(' | '));
      ck(`${label}: every asset loads`, badAssets.length === 0, badAssets.join(', '));
      ck(`${label}: assets come from the shared root, not /ms/`, msAssets.length === 0, msAssets.join(', '));
      // Signed out, /ms/dashboard redirects to /ms/login; check the page it landed on.
      const landed = new URL(page.url()).pathname.replace(/^\/ms\/?/, '');
      if (p === 'dashboard') ck(`${label}: signed out, redirects to the Malay sign-in`, landed === 'login', page.url());
      ck(`${label}: switch link returns to the same English page`,
         info.switchHref === `https://www.mambaapp.online/${landed}`, info.switchHref);
      if (device.name === 'phone') {
        // Malay runs longer than English; it must not push the page sideways.
        const en = await ctx.newPage();
        await en.goto(`${BASE}/${p ? p : ''}`, { waitUntil: 'load' });
        const enOverflow = await en.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        await en.close();
        ck(`${label}: no wider than the English page on a phone`, info.overflow <= Math.max(enOverflow, 1), `ms ${info.overflow}px, en ${enOverflow}px`);
      }
      await page.close();
    }
    await ctx.close();
  }

  // ---- 2. homepage animation speaks Malay --------------------------------
  console.log('\n  [2] homepage trade animation');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/ms/`, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    const demo = await page.evaluate(() => ({
      title: document.querySelector('[data-story-title]')?.textContent || '',
      change: document.querySelector('[data-change]')?.textContent || '',
      play: document.querySelector('[data-play]')?.textContent || '',
      dict: Object.values(window.MAMBA_MS || {}),
    }));
    ck('story title comes from the Malay dictionary', demo.dict.includes(demo.title), demo.title);
    ck('pip readout is in Malay', /pip|entry/.test(demo.change) && !/pips/.test(demo.change), demo.change);
    ck('play control is in Malay', ['Jeda', 'Main'].includes(demo.play), demo.play);
    await ctx.close();
  }

  // ---- 3. member journey on the Malay site (demo API) ---------------------
  console.log('\n  [3] member journey in Malay');
  {
    const ctx = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/ms/login`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.click('.login-form .submit-btn');
    ck('client-side validation is in Malay', (await page.textContent('.login-form .form-error')).trim() === 'E-mel dan kata laluan diperlukan.');

    await page.click('.auth-tab[data-target="register"]');
    await page.fill('#reg-name', 'Aina Ujian');
    await page.fill('#reg-email', `ms${Date.now()}@example.com`);
    await page.fill('#reg-password', 'rahsia12345');
    await page.fill('#reg-confirm', 'rahsia12345');
    await page.fill('#reg-recovery', 'lautan biru 42');
    await page.check('#reg-terms');
    await page.click('.register-form .submit-btn');
    await page.waitForURL(/\/ms\/dashboard/, { timeout: 8000 }).catch(() => {});
    ck('sign-up stays on the Malay site', new URL(page.url()).pathname === '/ms/dashboard', page.url());
    await page.waitForTimeout(1500);

    const dash = await page.evaluate(() => ({
      greeting: document.getElementById('dashboardGreeting')?.textContent.trim(),
      banner: (document.getElementById('ibBanner')?.textContent || '').replace(/\s+/g, ' ').trim(),
      steps: (document.getElementById('onboardingSteps')?.textContent || '').replace(/\s+/g, ' '),
      empty: document.getElementById('mt5AccountsList')?.textContent.trim(),
      profile: document.getElementById('profileContent')?.textContent || '',
    }));
    ck('greeting in Malay', dash.greeting === 'Selamat datang, Aina', dash.greeting);
    ck('IB banner in Malay', dash.banner.includes('IB BELUM DISAHKAN') && dash.banner.includes('Mohon Pengesahan IB'), dash.banner);
    ck('onboarding steps in Malay', dash.steps.includes('Muat turun aplikasi Mamba') && dash.steps.includes('Sambungkan akaun MT5 anda'), dash.steps.slice(0, 120));
    ck('profile labels in Malay', dash.profile.includes('Nama') && dash.profile.includes('E-mel'), dash.profile);

    await page.click('#addMT5Btn');
    await page.waitForTimeout(300);
    ck('IB gate explains itself in Malay', await page.isVisible('#ibRequiredModal.active') &&
       (await page.textContent('#ibRequiredModal h3')).trim() === 'Pengesahan IB Diperlukan');
    await page.click('#ibRequiredGoBtn');
    await page.waitForTimeout(300);
    await page.click('#ibOptNew');
    ck('IB modal title in Malay', (await page.textContent('#ibModalTitle')).trim() === 'Akaun Valetax Baharu');
    await page.fill('#ibEmailNew', 'aina.valetax@example.com');
    await page.click('#submitIBNew');
    await page.waitForTimeout(500);
    ck('IB request toast in Malay', ((await page.textContent('.toast-message').catch(() => '')) || '').trim() === 'Pengesahan IB telah dimohon.');
    await page.waitForTimeout(1200);
    const banner2 = (await page.textContent('#ibBanner')).replace(/\s+/g, ' ');
    ck('pending banner in Malay', banner2.includes('PENGESAHAN IB DALAM PROSES') && banner2.includes('Sedang Disemak'), banner2);

    await page.click('#addMT5Btn');
    await page.fill('#newMT5Input', String(Date.now()).slice(-9));
    await page.click('#saveMT5Btn');
    await page.waitForTimeout(500);
    ck('add-MT5 toast in Malay', ((await page.textContent('.toast-message').catch(() => '')) || '').trim() === 'Akaun MT5 telah ditambah.');
    await page.waitForTimeout(1200);
    const row = await page.evaluate(() => ({
      badge: document.querySelector('.mt5-account-row .status-badge')?.textContent.trim(),
      btn: document.querySelector('.request-whitelist-btn')?.textContent.trim(),
    }));
    ck('MT5 status and action in Malay', row.badge === 'MENUNGGU' && row.btn === 'Mohon Whitelist', JSON.stringify(row));

    await page.click('#logoutBtn');
    await page.waitForURL(/\/ms\/login/, { timeout: 8000 }).catch(() => {});
    ck('logout stays on the Malay site', new URL(page.url()).pathname === '/ms/login', page.url());
    ck('no script errors in the journey', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- 4. other Malay forms ----------------------------------------------
  console.log('\n  [4] form messages');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/ms/reset-password`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await page.click('.reset-form .submit-btn');
    ck('reset form validation in Malay', (await page.textContent('.reset-form .form-error')).trim() === 'Semua medan diperlukan.');
    await page.goto(`${BASE}/ms/support`, { waitUntil: 'load' });
    await page.click('#supportSubmit');
    ck('support form validation in Malay', (await page.textContent('#supportForm .form-status')).trim() === 'Sila masukkan e-mel dan mesej anda.');
    await page.goto(`${BASE}/ms/account-deletion`, { waitUntil: 'load' });
    await page.fill('#deletionEmail', 'aina@example.com');
    await page.click('#deletionSubmit');
    ck('deletion form validation in Malay', (await page.textContent('#deletionForm .form-status')).trim().startsWith('Sila tandakan kotak'));
    await ctx.close();
  }

  // ---- 5. the English site is unchanged -----------------------------------
  console.log('\n  [5] English site still English');
  {
    const ctx = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login.html#register`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    ck('English page reports lang en', await page.evaluate(() => document.documentElement.lang === 'en' && (window.MAMBA_LANG || 'en') === 'en'));
    await page.fill('#reg-name', 'Journey English');
    await page.fill('#reg-email', `en${Date.now()}@example.com`);
    await page.fill('#reg-password', 'secret12345');
    await page.fill('#reg-confirm', 'secret12345');
    await page.fill('#reg-recovery', 'blue ocean 42');
    await page.check('#reg-terms');
    await page.click('.register-form .submit-btn');
    await page.waitForURL(/\/dashboard/, { timeout: 8000 }).catch(() => {});
    const p = new URL(page.url()).pathname;
    ck('English sign-up lands on the English dashboard', p === '/dashboard' || p === '/dashboard.html', page.url());
    await page.waitForTimeout(1500);
    ck('English greeting unchanged', (await page.textContent('#dashboardGreeting')).trim() === 'Welcome, Journey');
    ck('English banner unchanged', (await page.textContent('#ibBanner')).includes('IB NOT VERIFIED YET'));
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    const title = await page.textContent('[data-story-title]');
    ck('English homepage animation unchanged', /^(You|At|Price)/.test(title.trim()), title);
    ck('English page links to the Malay page', (await page.getAttribute('[data-lang-switch]', 'href')) === 'https://my.mambaapp.online/');
    await ctx.close();
  }

  await browser.close();

  // ---- 6. API messages through the local Worker ---------------------------
  console.log('\n  [6] API messages from the real Worker');
  let r = await post('/api/auth/login', 'not json', { Referer: `${BASE}/ms/login` });
  ck('from a /ms/ page: Malay message', r.status === 400 && r.json?.error === 'Kandungan permintaan tidak sah.', `${r.status} ${r.data}`);
  r = await post('/api/auth/login', 'not json', { Referer: `${BASE}/login` });
  ck('from an English page: English message', r.status === 400 && r.json?.error === 'Invalid request body.', `${r.status} ${r.data}`);
  r = await post('/api/auth/login', 'not json', { Host: 'my.mambaapp.online' });
  ck('to host my.mambaapp.online: Malay message', r.status === 400 && r.json?.error === 'Kandungan permintaan tidak sah.', `${r.status} ${r.data}`);

  console.log(`\n  ${passed} passed, ${failures} failed`);
  console.log(failures ? '\nMALAY PAGE CHECKS FAILED' : '\nMALAY PAGE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
