#!/usr/bin/env node
/* Behaviour checks for the homepage's optional setup invitation. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
let pw;
for (const name of ['playwright', path.resolve(__dirname, '../tools/valetax-sync/node_modules/playwright'), '/Users/anyaazman/Development/Mamba-Website/tools/valetax-sync/node_modules/playwright']) {
  try { pw = require(name); break; } catch {}
}
if (!pw) throw new Error('Playwright is required');
const BASE = process.argv[2] || 'http://localhost:8790';
const SEEN = 'mamba_setup_prompt_seen';
const DISMISSED = 'mamba_setup_prompt_dismissed_until';
let passed = 0;
const check = (name, condition) => { assert.ok(condition, name); passed++; };

(async () => {
  const browser = await pw.chromium.launch();
  async function fixture(options = {}, init) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
    if (init) await context.addInitScript(init);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.goto(BASE, { waitUntil: 'load' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    return { context, page, errors, prompt: page.locator('#setupPrompt') };
  }
  async function reachOverview(page) {
    await page.locator('#how-it-works').scrollIntoViewIfNeeded();
    await page.clock.runFor(300);
  }
  try {
    const a = await fixture();
    check('homepage includes the setup invitation', await a.prompt.count() === 1);
    check('hidden on arrival', !await a.prompt.isVisible());
    await a.page.clock.fastForward(16000);
    check('time alone does not interrupt the hero', !await a.prompt.isVisible());
    await reachOverview(a.page);
    check('appears after enough visible time and reaching the overview', await a.prompt.isVisible());
    check('background remains scrollable', await a.page.evaluate(() => getComputedStyle(document.body).overflowY !== 'hidden'));
    check('arrival does not steal keyboard focus', await a.page.evaluate(() => !document.querySelector('#setupPrompt').contains(document.activeElement)));
    const signup = a.prompt.getByRole('link', { name: 'Create free account', exact: true });
    check('registration is the primary destination', (await signup.getAttribute('href')).endsWith('login.html#register'));
    check('desktop app action opens the real download section', (await a.prompt.getByRole('link', { name: 'Get the app', exact: true }).getAttribute('href')).endsWith('how-Mamba-work.html#download'));
    check('existing clients have a sign-in path', (await a.prompt.getByRole('link', { name: 'Sign in', exact: true }).getAttribute('href')).endsWith('login.html'));
    await a.prompt.getByRole('button', { name: 'Close setup invitation' }).click();
    check('close hides the invitation', !await a.prompt.isVisible());
    const remaining = await a.page.evaluate(key => Number(localStorage.getItem(key)) - Date.now(), DISMISSED);
    check('dismissal lasts seven days', remaining > 6.99 * 86400000 && remaining <= 7 * 86400000);
    await a.page.evaluate(key => sessionStorage.removeItem(key), SEEN);
    await a.page.reload(); await reachOverview(a.page); await a.page.clock.fastForward(16000);
    check('dismissal survives a fresh session', !await a.prompt.isVisible());
    await a.page.clock.fastForward(7 * 86400000 + 1000);
    await a.page.reload(); await reachOverview(a.page); await a.page.clock.fastForward(16000);
    check('eligible again after dismissal expires', await a.prompt.isVisible());
    await a.page.reload(); await reachOverview(a.page); await a.page.clock.fastForward(16000);
    check('does not reopen within the same session', !await a.prompt.isVisible());
    check('desktop has no runtime errors', a.errors.length === 0);
    await a.context.close();

    const b = await fixture({}, () => {
      window.testVisibility = 'visible';
      Object.defineProperty(document, 'visibilityState', { get: () => window.testVisibility });
    });
    await reachOverview(b.page);
    await b.page.clock.fastForward(5000);
    check('scroll alone does not show it early', !await b.prompt.isVisible());
    await b.page.evaluate(() => { window.testVisibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
    await b.page.clock.fastForward(60000);
    await b.page.evaluate(() => { window.testVisibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    check('background time does not count toward the delay', !await b.prompt.isVisible());
    await b.page.clock.fastForward(10000);
    check('visible time resumes on return', await b.prompt.isVisible());
    await b.prompt.getByRole('button', { name: 'Close setup invitation' }).focus();
    await b.page.keyboard.press('Escape');
    check('Escape dismisses without leaving focus on a hidden control', !await b.prompt.isVisible() && await b.page.evaluate(() => !document.querySelector('#setupPrompt').contains(document.activeElement)));
    await b.context.close();

    for (const [label, init] of [
      ['signed-in visitor', () => localStorage.setItem('mamba_token', 'test-member-session')],
      ['blocked storage', () => { Storage.prototype.getItem = () => { throw new Error('Storage blocked'); }; }],
      ['readable but non-writable session storage', () => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(...args) {
          if (this === sessionStorage) throw new Error('Session storage is read-only');
          return original.apply(this, args);
        };
      }],
      ['readable but non-writable local storage', () => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(...args) {
          if (this === localStorage) throw new Error('Local storage is read-only');
          return original.apply(this, args);
        };
      }]
    ]) {
      const f = await fixture({}, init);
      await reachOverview(f.page); await f.page.clock.fastForward(20000);
      check(`${label} receives no automatic promotion`, !await f.prompt.isVisible());
      check(`${label} leaves the homepage functional`, f.errors.length === 0 && await f.page.locator('.hero h1').isVisible());
      await f.context.close();
    }

    const c = await fixture();
    await c.page.route('**/login.html*', route => route.fulfill({ body: '<h1>Sign up destination</h1>', contentType: 'text/html' }));
    await c.page.locator('.hero-actions a[href="login.html#register"]').first().click();
    await c.page.goto(BASE); await reachOverview(c.page); await c.page.clock.fastForward(20000);
    check('visitors who already choose signup are not prompted on return', !await c.prompt.isVisible());
    await c.context.close();

    for (const [name, device, store] of [
      ['iPhone', pw.devices['iPhone 13'], 'https://apps.apple.com/app/id6776478463'],
      ['Android', pw.devices['Pixel 7'], 'https://play.google.com/store/apps/details?id=com.mambamanagement.app'],
      ['small phone', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true }, 'how-Mamba-work.html#download']
    ]) {
      const f = await fixture(device);
      await reachOverview(f.page);
      await f.page.locator('#navToggle').click();
      await f.page.clock.fastForward(16000);
      check(`${name}: waits while the menu is open`, !await f.prompt.isVisible());
      await f.page.locator('#navToggle').click();
      await f.page.clock.runFor(500);
      check(`${name}: appears after menu closes`, await f.prompt.isVisible());
      check(`${name}: correct app destination`, await f.prompt.getByRole('link', { name: 'Get the app', exact: true }).getAttribute('href') === store);
      const box = await f.prompt.boundingBox();
      const screen = f.page.viewportSize();
      check(`${name}: fits the viewport`, box.x >= 0 && box.x + box.width <= screen.width + 1 && box.y >= 0 && box.y + box.height <= screen.height + 1);
      check(`${name}: occupies less than half the screen height`, box.height < screen.height / 2);
      check(`${name}: no horizontal overflow`, await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const closeBox = await f.prompt.getByRole('button', { name: 'Close setup invitation' }).boundingBox();
      check(`${name}: close is easy to tap`, closeBox.width >= 44 && closeBox.height >= 44);
      check(`${name}: no forced motion`, await f.prompt.evaluate(el => getComputedStyle(el).animationName === 'none'));
      check(`${name}: no runtime errors`, f.errors.length === 0);
      await f.context.close();
    }
    console.log(`${passed} setup invitation checks passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
