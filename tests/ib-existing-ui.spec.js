#!/usr/bin/env node
const assert = require('node:assert/strict');
let pw;
for (const name of ['playwright', '../tools/valetax-sync/node_modules/playwright', '/Users/anyaazman/Development/Mamba-Website/tools/valetax-sync/node_modules/playwright']) {try {pw=require(name);break;}catch{}}
if(!pw) throw new Error('Playwright is required');
const {chromium}=pw;
const base = process.argv[2] || 'http://localhost:8790';
const luminance = color => {
  const rgb = color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
(async()=>{
 const browser=await chromium.launch();
 try {
 for(const [width,height] of [[1280,900],[390,844],[320,568]]) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const user={id:71,name:'IB UI Test',email:'ib-ui@mamba.invalid',ib_status:'pending',ib_email:''};
   localStorage.setItem('mamba_token','ui-test');
   localStorage.setItem('mamba_demo_v2',JSON.stringify({users:[user],tokens:[{user_id:71,token:'ui-test'}],mt5_accounts:[],events:[]}));
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.testCopied=text;}}});
  });
  await page.goto(base+'/dashboard.html?demo');
  await page.locator('.loading-screen').waitFor({state:'hidden'});
  await page.locator('#onboardingIBBtn').click();await page.locator('#ibOptExisting').click();
  for(const selector of ['.ib-copy-label','.ib-copy-text','.ib-change-btn']) {
   const colors=await page.locator(selector).evaluate(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e.matches('.ib-change-btn')?e:e.parentElement).backgroundColor,font:parseFloat(getComputedStyle(e).fontSize)}));
   const a=luminance(colors.fg),b=luminance(colors.bg);
   assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,selector+' contrast');
   assert.ok(colors.font>=14,selector+' readable text');
  }
  const modal=page.locator('#ibModalCard');
  const layout=await modal.evaluate(el=>{
   const m=el.getBoundingClientRect();const button=document.getElementById('submitIBExisting').getBoundingClientRect();const email=document.getElementById('ibEmailExisting').getBoundingClientRect();
   return {fits:m.left>=0&&m.right<=innerWidth&&m.top>=0&&m.bottom<=innerHeight+1,submitVisible:button.top>=m.top&&button.bottom<=m.bottom,emailVisible:email.top>=m.top&&email.bottom<=m.bottom};
  });
  assert.deepEqual(layout,{fits:true,submitVisible:true,emailVisible:true});
  const title=page.getByRole('button',{name:'Copy partner code'});
  await title.click();assert.equal(await page.evaluate(()=>window.testCopied),'Changing Partner Code To 3505549');
  const comment=page.getByRole('button',{name:'Copy ticket message'});
  await comment.click();assert.equal(await page.evaluate(()=>window.testCopied),'I want to change my partner code to 3505549\n\nAs they give me Proper Education To Trade');
  await page.locator('#ibCarouselNext').click();
  assert.ok(await page.locator('[data-slide="1"]').evaluate(e=>e.classList.contains('active')));
  await page.locator('#ibCarouselNext').click();
  assert.ok(await page.locator('[data-slide="2"]').evaluate(e=>e.classList.contains('active')));
  await page.locator('[data-slide="0"]').click();
  const heights=await page.locator('#ibCarousel').evaluate(e=>({carousel:e.clientHeight,slide:e.querySelector('.ib-carousel-slide').offsetHeight}));
  assert.ok(Math.abs(heights.carousel-heights.slide)<=2,'no reserved blank image space');
  await page.locator('.ib-guide-panel').evaluate(e=>e.scrollTop=0);
  await page.screenshot({path:'/tmp/mamba-ib-fixed-'+width+'.png'});
  await page.locator('#cancelIBExisting').click();
  assert.ok(await page.locator('#ibOptExisting').isVisible());
  await page.locator('#ibOptNew').click();
  assert.ok(await page.locator('#ibStepNew').isVisible());
  assert.equal(await modal.evaluate(e=>e.classList.contains('ib-existing')),false);
  await page.locator('#cancelIBNew').click();
  await page.locator('#ibOptExisting').click();
  await page.locator('#ibEmailExisting').fill('ib-existing@mamba.invalid');
  await page.locator('#submitIBExisting').click();
  await page.locator('#ibModal').waitFor({state:'hidden'});
  assert.match(await page.locator('#ibBanner').textContent(),/under review/i);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mamba_demo_v2')).users[0].ib_type),'existing');
  assert.deepEqual(errors,[]);
  console.log('PASS',width+'x'+height,'contrast, layout, copies, slides, back, local submission');
  await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
