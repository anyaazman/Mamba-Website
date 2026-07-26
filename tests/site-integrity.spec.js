#!/usr/bin/env node
/*
 * Site-wide integrity: pages, assets, links, and asset-version consistency.
 *
 * Run:  node tests/site-integrity.spec.js  [baseUrl]
 *       default baseUrl = http://localhost:8789
 *
 * Catches the classes of breakage that are invisible until a user hits them:
 * a missing image, a link to a page that was renamed, a page loading v=3 of a
 * stylesheet while its siblings load v=25, or markup that needs a script the
 * page never includes.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const BASE = process.argv[2] || 'http://localhost:8789';
const ROOT = path.resolve(__dirname, '..');

function loadPlaywright() {
  const candidates = [
    'playwright',
    '/Users/anyaazman/Development/Mamba-Website/tools/valetax-sync/node_modules/playwright',
    path.resolve(ROOT, 'tools/valetax-sync/node_modules/playwright'),
  ];
  for (const c of candidates) { try { return require(c); } catch (e) {} }
  console.error('Playwright not found.'); process.exit(1);
}
const { chromium, devices } = loadPlaywright();

let failures = [], passed = 0;
const ck = (n, c, d) => {
  if (c) { passed++; }
  else { failures.push(n + (d ? ` — ${d}` : '')); console.log(`  FAIL ${n}${d ? ' — ' + d : ''}`); }
};

const PAGES = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

(async () => {
  console.log(`  ${PAGES.length} pages under test\n`);

  // ---- 1. Static: referenced local assets must exist on disk --------------
  console.log('  [1] referenced assets exist on disk');
  const assetRe = /(?:src|href|poster|data-webp)="(?!https?:|mailto:|tel:|#|data:)([^"?#]+)[^"]*"/g;
  let missing = 0;
  for (const pg of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, pg), 'utf8');
    let m;
    while ((m = assetRe.exec(html))) {
      const rel = m[1];
      if (!rel || rel.startsWith('/')) continue;
      if (!fs.existsSync(path.join(ROOT, rel))) {
        ck(`${pg} -> ${rel}`, false, 'file not found'); missing++;
      }
    }
  }
  ck('no missing local assets', missing === 0, `${missing} missing`);

  // ---- 2. Static: internal page links resolve ----------------------------
  console.log('  [2] internal links resolve');
  const linkRe = /href="(?!https?:|mailto:|tel:|#|data:)([^"#?]+\.html)[^"]*"/g;
  let broken = 0;
  for (const pg of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, pg), 'utf8');
    let m;
    while ((m = linkRe.exec(html))) {
      if (!fs.existsSync(path.join(ROOT, m[1]))) { ck(`${pg} -> ${m[1]}`, false, 'target missing'); broken++; }
    }
  }
  ck('no broken internal links', broken === 0, `${broken} broken`);

  // ---- 3. Static: shared assets served at ONE version across pages -------
  console.log('  [3] asset versions consistent across pages');
  const verRe = /(?:src|href)="([a-zA-Z0-9._-]+\.(?:css|js))\?v=([0-9]+)"/g;
  const versions = {};
  for (const pg of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, pg), 'utf8');
    let m;
    while ((m = verRe.exec(html))) {
      (versions[m[1]] ||= {})[m[2]] = (versions[m[1]][m[2]] || []).concat(pg);
    }
  }
  for (const [file, vs] of Object.entries(versions)) {
    const keys = Object.keys(vs);
    ck(`${file} single version`, keys.length === 1,
       keys.length > 1 ? keys.map(k => `v=${k}:${vs[k].join(',')}`).join(' | ') : '');
  }

  // ---- 4. Static: markup requiring a script actually loads it ------------
  console.log('  [4] markup dependencies have their scripts');
  const DEPS = [
    { attr: 'data-valetax-link', script: 'config.js' },
    { attr: 'data-app-link',     script: 'config.js' },
    { attr: 'data-app-label',    script: 'config.js' },
    { attr: 'id="navToggle"',    script: 'nav.js' },
    { attr: 'id="appBanner"',    script: 'app-banner.js' },
  ];
  for (const pg of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, pg), 'utf8');
    for (const d of DEPS) {
      if (html.includes(d.attr)) ck(`${pg} uses ${d.attr} -> loads ${d.script}`, html.includes(d.script));
    }
  }

  // ---- 5. Runtime: load every page at two widths -------------------------
  console.log('  [5] runtime page loads (390px + 1440px)');
  const browser = await chromium.launch();
  for (const [label, opt] of [['mobile', { ...devices['Pixel 7'] }], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
    const ctx = await browser.newContext(opt);
    for (const pg of PAGES) {
      const page = await ctx.newPage();
      const errs = [], bad = [];
      page.on('pageerror', e => errs.push(e.message));
      page.on('response', r => {
        const u = r.url();
        if (r.status() >= 400 && !u.includes('/api/') && !u.startsWith('data:')) bad.push(`${u.split('/').pop()}:${r.status()}`);
      });
      try {
        const resp = await page.goto(`${BASE}/${pg}`, { waitUntil: 'load', timeout: 20000 });
        await page.waitForTimeout(1800);
        ck(`${label}/${pg} HTTP ok`, resp && resp.status() < 400, resp ? String(resp.status()) : 'no response');
        ck(`${label}/${pg} no JS errors`, errs.length === 0, errs[0]);
        ck(`${label}/${pg} no failed assets`, bad.length === 0, bad.join(','));
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        ck(`${label}/${pg} no horizontal overflow`, !overflow);
      } catch (e) {
        ck(`${label}/${pg} loads`, false, e.message.slice(0, 60));
      }
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();

  console.log(`\n  ${passed} passed, ${failures.length} failed`);
  if (failures.length) { failures.forEach(f => console.log('   - ' + f)); process.exit(1); }
  console.log('  SITE INTEGRITY PASSED');
})().catch(e => { console.error(e); process.exit(1); });
