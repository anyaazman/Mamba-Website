#!/usr/bin/env node
// Local demo fixtures only: checks setup layout and preserves existing actions.
const assert = require('node:assert/strict');
const path = require('node:path');
let pw;
for (const name of ['playwright', path.resolve(__dirname, '../tools/valetax-sync/node_modules/playwright'), '/Users/anyaazman/Development/Mamba-Website/tools/valetax-sync/node_modules/playwright']) {
  try { pw = require(name); break; } catch {}
}
if (!pw) throw new Error('Playwright is required');
const base = process.argv[2] || 'http://localhost:8790';
(async () => {
  const browser = await pw.chromium.launch();
  let checks = 0;
  try {
    for (const [width, state, platform] of [[320,'none','android'],[390,'pending','android'],[390,'none','ios'],[768,'rejected'],[1280,'approved']]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, ...(width < 700 ? { userAgent: pw.devices[platform === 'ios' ? 'iPhone 13' : 'Pixel 7'].userAgent } : {}) });
      await context.addInitScript(({state}) => {
        const user = { id: 98765, name: 'Layout Test', email: 'layout@mamba.invalid', password: 'fixture', ib_status: state === 'none' ? 'pending' : state, ib_email: state === 'none' ? '' : 'layout@mamba.invalid', created_at: new Date().toISOString() };
        const accounts = state === 'approved' ? [{ id: 1, user_id: user.id, account_number: '12345678', status: 'approved', created_at: new Date().toISOString() }] : [];
        localStorage.setItem('mamba_demo_v2',JSON.stringify({users:[user],mt5_accounts:accounts,tokens:[{user_id:user.id,token:'layout-fixture'}],events:[]}));
        localStorage.setItem('mamba_token','layout-fixture');
      }, {state});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/dashboard.html?demo');
      await page.waitForSelector('#onboardingSteps > li');
      await page.locator('.loading-screen').waitFor({ state:'hidden' });
      assert.equal(await page.locator('#onboardingSteps > li').count(),3);
      const geometry = await page.locator('#onboardingCard').evaluate(panel => {
        const nodes = [...panel.querySelectorAll('*')].filter(e => e.getBoundingClientRect().width);
        const outside = nodes.filter(e => {const r=e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1;}).map(e => e.className);
        const controls = [...panel.querySelectorAll('a,button')].map(e => ({height:e.getBoundingClientRect().height, width:e.getBoundingClientRect().width}));
        const boxes = [...panel.querySelectorAll('.onboarding-step')].map(e=>{const r=e.getBoundingClientRect();return {top:r.top,left:r.left};});
        return {outside,controls,boxes};
      });
      assert.deepEqual(geometry.outside, [], 'no clipped descendants at '+width);
      assert.ok(geometry.controls.every(c=>c.height>=44 && c.width>=44), 'touch targets at '+width);
      assert.equal(geometry.boxes[1].top === geometry.boxes[2].top, width>900, 'responsive sequence');
      if (width > 900) assert.equal(geometry.boxes[0].top,geometry.boxes[1].top,'all three steps on one row');
      else assert.ok(geometry.boxes[0].top < geometry.boxes[1].top && geometry.boxes[1].top < geometry.boxes[2].top,'vertical step order');
      const connector = await page.locator('#onboardingStep1').evaluate(e=>getComputedStyle(e,'::after').content);
      assert.notEqual(connector,'none','visible flow connector');
      const android = page.locator('#onboardingCard [data-app-link="android"]');
      const ios = page.locator('#onboardingCard [data-app-link="ios"]');
      assert.match(await android.getAttribute('href'), /play.google.com\/store\/apps\/details\?id=com.mambamanagement.app/);
      assert.match(await ios.getAttribute('href'), /apps.apple.com\/.*6776478463/);
      if (platform) {
        const primary = platform === 'ios' ? ios : android;
        const secondary = platform === 'ios' ? android : ios;
        assert.equal(await primary.evaluate(e=>getComputedStyle(e).order),'1');
        assert.equal(await secondary.evaluate(e=>getComputedStyle(e).order),'2');
        assert.equal(await secondary.evaluate(e=>getComputedStyle(e).opacity),'1');
      }
      await android.focus();
      assert.equal(await android.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
      if(state==='none' || state==='rejected') {
        await page.locator('#onboardingIBBtn').click();
        assert.ok(await page.locator('#ibModal').evaluate(e=>e.classList.contains('active')));
        await page.locator('#cancelIB').click();
      }
      if(state==='none') {
        await page.locator('#onboardingWhitelistBtn').click();
        assert.ok(await page.locator('#ibRequiredModal').evaluate(e=>e.classList.contains('active')));
        await page.locator('#ibRequiredModal .cancel-btn').click();
      }
      if(state==='pending') {
        assert.equal(await page.locator('#onboardingStep2 button').textContent(),'Verification Pending');
        assert.ok(await page.locator('#onboardingStep2 button').isDisabled());
        await page.locator('#onboardingWhitelistBtn').click();
        assert.ok(await page.locator('#mt5AccountsList').isVisible());
      }
      if(state==='approved') {
        assert.equal(await page.locator('#onboardingStep2 button').textContent(),'Verified');
        assert.equal(await page.locator('#onboardingStep3 button').textContent(),'Approved');
        assert.equal(await page.locator('#onboardingCard .completed').count(),2);
      }
      assert.deepEqual(errors,[]);
      await page.locator('#onboardingCard').screenshot({path:'/tmp/mamba-onboarding-'+width+(platform || '')+'.png'});
      checks++;
      console.log('PASS',width+'px',state,'layout, links, targets, focus and actions');
      await context.close();
    }
    console.log(checks+' viewport/state combinations passed');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
