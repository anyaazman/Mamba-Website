#!/usr/bin/env node
/* Focused regression checks for the rebuilt How Mamba Works page. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
let pw;
for (const name of ['playwright', path.resolve(__dirname, '../tools/valetax-sync/node_modules/playwright'), '/Users/anyaazman/Development/Mamba-Website/tools/valetax-sync/node_modules/playwright']) {
  try { pw = require(name); break; } catch {}
}
if (!pw) throw new Error('Playwright is required');
const { chromium } = pw;
const BASE = process.argv[2] || 'http://localhost:8790';
const ROOT = path.resolve(__dirname, '..');
let passed = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) passed++;
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

(async () => {
  const html = fs.readFileSync(path.join(ROOT, 'how-Mamba-work.html'), 'utf8');
  for (const asset of ['how-work-revamp.css', 'google-play-logo.svg', 'mamba-logo-transparent.png', 'how-it-works/v1-screenshot.webp', 'how-it-works/v2-screenshot.webp', 'how-it-works/freecompress-IMG_1758.mp4', 'how-it-works/freecompress-IMG_1759.mp4', 'config.js', 'nav.js']) {
    check(`local asset exists: ${asset}`, fs.existsSync(path.join(ROOT, asset)));
  }
  for (const required of ['You choose the trade', 'Mamba manages the protection', 'Smart breakeven', 'Dynamic trailing stop', 'Create your member account', 'Request IB verification', 'Add your MT5 account', 'Request whitelist approval', 'Download the app and start', 'Valetax introduction']) {
    check(`page includes ${required}`, html.includes(required));
  }
  check('page has both app stores', html.includes('apps.apple.com/app/id6776478463') && html.includes('play.google.com/store/apps/details?id=com.mambamanagement.app'));
  check('page keeps risk disclosure link', html.includes('risk-disclosure.html'));

  const browser = await chromium.launch();
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(`${BASE}/how-Mamba-work.html`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(700);
      const state = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const root = document.documentElement;
        const nav = document.querySelector('#navLinks');
        return {
          status: document.readyState,
          bodyBackground: body.backgroundColor,
          bodyColor: body.color,
          overflow: root.scrollWidth > root.clientWidth + 1,
          videoCount: document.querySelectorAll('video source').length,
          imageCount: document.querySelectorAll('img').length,
          navLinks: nav ? nav.querySelectorAll('a').length : 0,
          referral: document.querySelector('[data-valetax-link="referral"]')?.getAttribute('href'),
          storeIos: document.querySelector('[data-app-link="ios"]')?.getAttribute('href'),
          storeAndroid: document.querySelector('[data-app-link="android"]')?.getAttribute('href'),
          flowHeadings: [...document.querySelectorAll('.hw-flow h3')].map(h => h.textContent.trim())
        };
      });
      check(`${width}px loads`, response && response.status() < 400, response ? String(response.status()) : 'no response');
      check(`${width}px has no page errors`, errors.length === 0, errors[0]);
      check(`${width}px uses light page canvas`, state.bodyBackground === 'rgb(245, 248, 252)');
      check(`${width}px uses navy text`, state.bodyColor === 'rgb(16, 35, 61)');
      check(`${width}px has no horizontal overflow`, !state.overflow);
      check(`${width}px keeps two product videos`, state.videoCount === 2, String(state.videoCount));
      check(`${width}px keeps product imagery`, state.imageCount >= 3, String(state.imageCount));
      check(`${width}px has three navigation links`, state.navLinks === 3, String(state.navLinks));
      check(`${width}px wires Valetax referral`, state.referral === 'https://ma.valetaxglobal.com/p/3505549', state.referral);
      check(`${width}px wires iOS store`, state.storeIos === 'https://apps.apple.com/app/id6776478463', state.storeIos);
      check(`${width}px wires Android store`, state.storeAndroid === 'https://play.google.com/store/apps/details?id=com.mambamanagement.app', state.storeAndroid);
      check(`${width}px follows the confirmed onboarding order`, JSON.stringify(state.flowHeadings) === JSON.stringify([
        'Create your member account', 'Request IB verification', 'Add your MT5 account', 'Request whitelist approval', 'Download the app and start'
      ]), JSON.stringify(state.flowHeadings));
      if (width === 390) {
        await page.click('#navToggle');
        await page.waitForTimeout(100);
        check('mobile menu opens', await page.locator('#navLinks').evaluate(el => el.classList.contains('active')));
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\n  ${passed} passed, ${failures.length} failed`);
  if (failures.length) { failures.forEach(f => console.log(`   - ${f}`)); process.exit(1); }
  console.log('  HOW MAMBA WORKS REVAMP PASSED');
})().catch(error => { console.error(error); process.exit(1); });
