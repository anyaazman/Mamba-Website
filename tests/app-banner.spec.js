#!/usr/bin/env node
/*
 * Retained coverage for the app install banner.
 *
 * Run:  node tests/app-banner.spec.js
 * Exits 0 on pass, 1 on any failure. Self-contained: it serves the repo over
 * a throwaway HTTP server and drives it with Playwright, so it needs no
 * global dev server and no root package.json.
 *
 * What it protects (the observable behaviour that is easy to regress):
 *   - the old header "Get the App" button stays gone
 *   - Apple's Smart App Banner meta tag is present on marketing pages only
 *   - the custom banner is SUPPRESSED on real iOS Safari (Apple draws its own;
 *     shipping both stacks two bars and there is no API to detect Apple's)
 *   - the custom banner SHOWS on Android, non-Safari iOS, and in-app webviews
 *   - the banner tracks the hide-on-scroll header instead of orphaning
 *   - dismissal persists across reloads
 *   - accessibility and layout invariants (roles, 44px target, z-index, height)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadPlaywright() {
  const candidates = [
    'playwright',
    path.join(ROOT, 'tools/valetax-sync/node_modules/playwright'),
    path.join(ROOT, 'node_modules/playwright'),
  ];
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* try next */ }
  }
  console.error('Playwright not found. Install it, e.g.:\n  npm i -D playwright');
  process.exit(1);
}
const { chromium, devices } = loadPlaywright();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    // Keep the server inside the repo even if a test asks for something odd.
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

let passed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const IPHONE = devices['iPhone 14'];
const ANDROID = devices['Pixel 7'];

// UA strings that must NOT get Apple's native banner, so ours has to appear.
const UA_IOS_CHROME = IPHONE.userAgent.replace('Version/17.0 ', '') + ' CriOS/126.0.0.0';
const UA_IOS_INSTAGRAM = IPHONE.userAgent + ' Instagram 300.0.0.0';

// The header plays an entrance animation on load. Any geometry measured while
// it is still sliding reports a phantom overlap between header and banner, so
// wait for the transform to reach rest instead of guessing a timeout.
async function waitForHeaderSettled(page) {
  await page.waitForFunction(() => {
    const h = document.querySelector('.header');
    if (!h) return true;
    const t = getComputedStyle(h).transform;
    if (!t || t === 'none') return true;
    const m = t.match(/matrix\(([^)]+)\)/);
    if (!m) return true;
    const parts = m[1].split(',').map(Number);
    return Math.abs(parts[5]) < 0.5;   // translateY component at rest
  }, null, { timeout: 5000 }).catch(() => { /* fall through and assert anyway */ });
}

async function readBanner(page) {
  return page.evaluate(() => {
    const b = document.getElementById('appBanner');
    const html = document.documentElement;
    if (!b) return { present: false, flagged: html.classList.contains('has-app-banner') };
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    const closeBtn = document.getElementById('appBannerClose');
    const cb = closeBtn ? closeBtn.getBoundingClientRect() : null;
    const main = document.querySelector('main');
    const hdr = document.querySelector('.header');
    const hr = hdr ? hdr.getBoundingClientRect() : null;
    return {
      present: true,
      flagged: html.classList.contains('has-app-banner'),
      headerBottom: hr ? Math.round(hr.bottom) : null,
      headerH: hr ? Math.round(hr.height) : null,
      display: cs.display,
      visible: cs.display !== 'none' && r.height > 0,
      top: Math.round(r.top),
      height: Math.round(r.height),
      zIndex: cs.zIndex,
      role: b.getAttribute('role'),
      ariaLabel: b.getAttribute('aria-label'),
      closeW: cb ? Math.round(cb.width) : 0,
      closeH: cb ? Math.round(cb.height) : 0,
      ctaHref: (document.getElementById('appBannerCta') || {}).href || null,
      mainMarginTop: main ? getComputedStyle(main).marginTop : null,
      viewportH: window.innerHeight,
    };
  });
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  const openPage = async (ctxOpts, url) => {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/${url}`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await waitForHeaderSettled(page);
    return { ctx, page, errors };
  };

  // ---- 1. The old header button is gone everywhere --------------------
  console.log('\nheader button removed');
  for (const f of ['index.html', 'how-Mamba-work.html', 'login.html', 'dashboard.html']) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    check(`${f} has no header-app-btn`, !html.includes('header-app-btn'));
  }
  check('styles.css has no header-app-btn rules',
    !fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8').includes('header-app-btn'));

  // ---- 2. Apple's native banner tag, marketing pages only -------------
  console.log('\napple smart app banner meta');
  for (const f of ['index.html', 'how-Mamba-work.html']) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    check(`${f} declares apple-itunes-app`,
      /<meta name="apple-itunes-app" content="app-id=6776478463">/.test(html));
  }
  for (const f of ['login.html', 'dashboard.html', 'admin.html', 'reset-password.html']) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    check(`${f} does not declare apple-itunes-app`, !html.includes('apple-itunes-app'));
  }
  check('index.html has exactly one canonical link',
    (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/rel="canonical"/g) || []).length === 1);

  // ---- 3. Who sees the custom banner ----------------------------------
  console.log('\ncustom banner visibility');
  const cases = [
    { name: 'iOS Safari  -> suppressed (Apple draws its own)', opts: { ...IPHONE }, expect: false },
    { name: 'iOS Chrome  -> shown', opts: { ...IPHONE, userAgent: UA_IOS_CHROME }, expect: true },
    { name: 'iOS Instagram webview -> shown', opts: { ...IPHONE, userAgent: UA_IOS_INSTAGRAM }, expect: true },
    { name: 'Android     -> shown', opts: { ...ANDROID }, expect: true },
    { name: 'Desktop     -> suppressed', opts: { viewport: { width: 1440, height: 900 } }, expect: false },
  ];
  for (const c of cases) {
    const { ctx, page, errors } = await openPage(c.opts, 'index.html');
    const b = await readBanner(page);
    check(c.name, (b.present && b.visible) === c.expect,
      `present=${b.present} visible=${b.visible} flagged=${b.flagged}`);
    check(`${c.name.split('->')[0].trim()}: no JS errors`, errors.length === 0, errors.join('; '));
    await ctx.close();
  }

  // ---- 4. Layout, a11y and store routing on Android --------------------
  console.log('\nbanner invariants (Android)');
  {
    const { ctx, page } = await openPage({ ...ANDROID }, 'index.html');
    const b = await readBanner(page);
    check('role=region', b.role === 'region', String(b.role));
    check('has aria-label', !!b.ariaLabel, String(b.ariaLabel));
    check('close target >= 44x44', b.closeW >= 44 && b.closeH >= 44, `${b.closeW}x${b.closeH}`);
    check('z-index 999 (under header, under modals)', b.zIndex === '999', b.zIndex);
    check('height <= 15% of viewport', b.height <= b.viewportH * 0.15, `${b.height}px of ${b.viewportH}px`);
    check('CTA points at Play Store', /play\.google\.com.*com\.mambamanagement\.app/.test(b.ctaHref || ''), b.ctaHref);
    // The banner sits below the header, so main must clear header + banner.
    const marginTop = parseFloat(b.mainMarginTop);
    check('main clears header + banner', marginTop >= b.top + b.height,
      `main margin-top ${marginTop}px vs banner bottom ${b.top + b.height}px`);
    await ctx.close();
  }

  // ---- 4b. Banner is never tucked behind the header --------------------
  // Regression guard: --header-h was originally derived from main's
  // margin-top, which is smaller than the header's real height, so the
  // header covered the banner's top edge by 10-30px depending on breakpoint.
  console.log('\nno header/banner overlap across breakpoints');
  for (const width of [1440, 900, 768, 600, 480, 412, 390, 360]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 820 },
      userAgent: ANDROID.userAgent, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${base}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await waitForHeaderSettled(page);
    const b = await readBanner(page);
    check(`w=${width}: banner sits below header`,
      b.visible && b.top >= b.headerBottom,
      `bannerTop=${b.top} headerBottom=${b.headerBottom} headerH=${b.headerH}`);
    check(`w=${width}: main clears banner`,
      parseFloat(b.mainMarginTop) >= b.top + b.height,
      `margin=${b.mainMarginTop} bannerBottom=${b.top + b.height}`);
    await ctx.close();
  }

  // ---- 5. Banner tracks the hide-on-scroll header ----------------------
  console.log('\nheader sync');
  {
    const { ctx, page } = await openPage({ ...ANDROID }, 'index.html');
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(600);
    const afterDown = await page.evaluate(() => ({
      header: document.querySelector('.header').classList.contains('hidden'),
      banner: document.getElementById('appBanner').classList.contains('hidden'),
    }));
    check('banner hides with header on scroll down',
      afterDown.header === afterDown.banner, JSON.stringify(afterDown));

    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(600);
    const afterUp = await page.evaluate(() => ({
      header: document.querySelector('.header').classList.contains('hidden'),
      banner: document.getElementById('appBanner').classList.contains('hidden'),
    }));
    check('banner returns with header on scroll up',
      afterUp.header === afterUp.banner && !afterUp.banner, JSON.stringify(afterUp));
    await ctx.close();
  }

  // ---- 6. Dismissal persists across reloads ----------------------------
  console.log('\ndismissal persistence');
  {
    const ctx = await browser.newContext({ ...ANDROID });
    const page = await ctx.newPage();
    await page.goto(`${base}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await waitForHeaderSettled(page);
    check('banner visible before dismiss', (await readBanner(page)).visible === true);

    await page.click('#appBannerClose');
    await page.waitForTimeout(500);
    const gone = await page.evaluate(() => !document.getElementById('appBanner'));
    check('banner removed after dismiss', gone);

    const stored = await page.evaluate(() => localStorage.getItem('mamba_app_banner_hidden_until'));
    check('dismissal recorded in localStorage', !!stored && Number(stored) > Date.now(), String(stored));

    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    const after = await readBanner(page);
    check('banner stays away on reload', after.visible !== true, JSON.stringify(after));
    await ctx.close();
  }

  await browser.close();
  server.close();

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('ALL APP BANNER CHECKS PASSED');
})().catch(err => { console.error(err); process.exit(1); });
