#!/usr/bin/env node
/* Shared-theme regression: client-facing pages should use the light revamp palette. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
let pw;
for (const name of ['playwright', path.resolve(__dirname, '../tools/valetax-sync/node_modules/playwright'), '/Users/anyaazman/Development/Mamba-Website/tools/valetax-sync/node_modules/playwright']) {
  try { pw = require(name); break; } catch {}
}
if (!pw) throw new Error('Playwright is required');
const { chromium } = pw;
const base = process.argv[2] || 'http://localhost:8790';
const pages = ['index.html','how-Mamba-work.html','support.html','login.html#register','reset-password.html','privacy-policy.html','terms-of-service.html','risk-disclosure.html','account-deletion.html','404.html','admin.html'];
const rgb = s => s.match(/[\d.]+/g)?.slice(0,3).map(Number);
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      for (const name of pages) {
        const page = await context.newPage();
        await page.goto(base + '/' + name, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);
        const state = await page.evaluate(() => {
          const body = getComputedStyle(document.body);
          const heading = document.querySelector('h1, h2');
          const link = document.querySelector('.support-card');
          const rect = document.documentElement;
          return {
            body: body.backgroundColor,
            text: body.color,
            heading: heading ? getComputedStyle(heading).color : null,
            supportLink: link ? getComputedStyle(link).color : null,
            overflow: rect.scrollWidth > innerWidth + 1
          };
        });
        assert.deepEqual(rgb(state.body), [245, 248, 252], `${name} ${width}px background`);
        assert.deepEqual(rgb(state.text), [16, 35, 61], `${name} ${width}px body text`);
        if (state.heading) assert.deepEqual(rgb(state.heading), [16, 35, 61], `${name} ${width}px heading`);
        if (name === 'support.html') assert.deepEqual(rgb(state.supportLink), [16, 35, 61], `${name} ${width}px card link`);
        assert.equal(state.overflow, false, `${name} ${width}px horizontal overflow`);
        await page.close();
      }
      await context.close();
      console.log('PASS', width + 'px', pages.length, 'pages share the revamp palette and fit');
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
