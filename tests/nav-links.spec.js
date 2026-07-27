#!/usr/bin/env node
/*
 * Every header nav link must actually navigate — on every page.
 *
 * Run:  node tests/nav-links.spec.js [baseUrl]
 *
 * Written after a regression that only affected the two pages loading
 * script.js: its in-page-anchor handler called e.preventDefault() on ALL
 * .nav-links a, so real page links silently did nothing. The earlier nav test
 * only asserted links were visible and the drawer opened — it never clicked
 * one, so the breakage shipped. This clicks every link on every page.
 */
'use strict';
const path = require('path');
const BASE = process.argv[2] || 'http://localhost:8789';
function lp(){for(const c of ['playwright','/Users/anyaazman/Development/Mamba-Website/tools/valetax-sync/node_modules/playwright']){try{return require(c)}catch(e){}}process.exit(1)}
const { chromium, devices } = lp();

let pass = 0, fails = [];
const ck = (n, c, d) => { if (c) pass++; else { fails.push(`${n}${d?' — '+d:''}`); console.log(`  FAIL ${n}${d?' — '+d:''}`); } };

// Pages that carry the header nav. index/how-Mamba-work also load script.js,
// which is where the regression lived.
// index + how-Mamba-work load script.js (where the regression lived);
// terms-of-service is the control that does not.
const PAGES = ['index.html', 'how-Mamba-work.html', 'terms-of-service.html'];

(async () => {
  const browser = await chromium.launch();
  for (const [label, opt] of [['desktop', { viewport: { width: 1440, height: 900 } }],
                              ['mobile',  { ...devices['Pixel 7'] }]]) {
    const ctx = await browser.newContext(opt);
    for (const pg of PAGES) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${pg}`, { waitUntil: 'load' });
      await page.waitForTimeout(pg === 'index.html' ? 2600 : 900);
      // Dismiss the promo dialog the way a user does. Ripping the node out
      // leaves body{overflow:hidden} from its scroll lock in place, which then
      // blocks the very anchor scrolling this test measures.
      await page.evaluate(() => {
        const btn = document.getElementById('promoClose');
        if (btn) btn.click();
        document.getElementById('promoOverlay')?.remove();
      });

      const hrefs = await page.evaluate(() =>
        [...document.querySelectorAll('#navLinks a')].map(a => a.getAttribute('href')));
      ck(`${label}/${pg} has nav links`, hrefs.length === 3, `${hrefs.length}`);

      for (const href of hrefs) {
        const p2 = await ctx.newPage();
        await p2.goto(`${BASE}/${pg}`, { waitUntil: 'load' });
        await p2.waitForTimeout(pg === 'index.html' ? 2600 : 900);
        await p2.evaluate(() => {
          const btn = document.getElementById('promoClose');
          if (btn) btn.click();
          document.getElementById('promoOverlay')?.remove();
        });
        if (label === 'mobile') { await p2.click('#navToggle'); await p2.waitForTimeout(450); }

        const before = p2.url();
        await p2.click(`#navLinks a[href="${href}"]`).catch(() => {});
        await p2.waitForTimeout(1500);
        const after = p2.url();

        // Two legitimate outcomes are not "no navigation":
        //  - a link to the page you are already on leaves the URL unchanged
        //  - Cloudflare Pages strips .html, so index.html lands on "/"
        const targetFile = href.split('#')[0];
        const hash = href.includes('#') ? '#' + href.split('#')[1] : '';
        const selfLink = targetFile === pg;

        if (selfLink && hash) {
          const y = await p2.evaluate(() => window.scrollY);
          ck(`${label}/${pg} -> ${href} scrolls in place`, y > 0 || after.includes(hash), `scrollY=${y}`);
        } else if (selfLink) {
          ck(`${label}/${pg} -> ${href} stays on page`, after.split('#')[0] === before.split('#')[0],
             `${before} -> ${after}`);
        } else {
          const stem = targetFile.replace('.html', '');
          const landed = targetFile === 'index.html'
            ? (/\/(index)?(\?|#|$)/.test(after) || after.includes('index'))
            : after.includes(stem);
          ck(`${label}/${pg} -> ${href} navigates`, landed && after !== before,
             `${before.split('/').pop()||'/'} -> ${after.split('/').pop()||'/'}`);
        }
        await p2.close();
      }
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\n  ${pass} passed, ${fails.length} failed`);
  if (fails.length) { fails.forEach(f => console.log('   - ' + f)); process.exit(1); }
  console.log('  NAV LINK NAVIGATION PASSED');
})().catch(e => { console.error(e); process.exit(1); });
