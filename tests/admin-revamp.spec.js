#!/usr/bin/env node
// Isolated browser-local fixtures. No production API calls or operator browser data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('/Users/anyaazman/Development/Mamba-Website/tools/valetax-sync/node_modules/playwright');
const BASE=process.argv[2]||'http://localhost:8790';
const ART=process.env.ADMIN_SCREENSHOT_DIR||'/tmp/mamba-admin-review';
const now='2026-10-05T03:00:00.000Z';
const fixture={users:[
 {id:1,name:'Aina Rahman',email:'aina@example.invalid',ib_status:'pending',ib_email:'aina.broker@example.invalid',ib_type:'existing',created_at:'2026-10-01T01:00:00Z',password:'fixture-only'},
 {id:2,name:'Ben Newmember',email:'ben@example.invalid',ib_status:'pending',ib_email:'',created_at:now,password:'fixture-only'},
 {id:3,name:'Sara Lim',email:'sara@example.invalid',ib_status:'approved',ib_email:'sara.broker@example.invalid',ib_type:'new',created_at:now,password:'fixture-only'},
 {id:4,name:'Dan Followup',email:'dan@example.invalid',ib_status:'rejected',ib_email:'dan.broker@example.invalid',created_at:now,password:'fixture-only'}
],mt5_accounts:[
 {id:31,user_id:3,account_number:'555111',status:'pending',whitelist_requested_at:'2026-10-04T16:05:00Z',created_at:now},
 {id:32,user_id:3,account_number:'555222',status:'pending',whitelist_requested_at:null,created_at:now},
 {id:33,user_id:3,account_number:'555333',status:'approved',whitelist_requested_at:'2026-10-04T16:05:00Z',created_at:now}
],tokens:[{user_id:2,token:'fixture-session',expires_at:'2027-01-01T00:00:00Z'}],events:[]};
for(let i=1;i<=123;i++)fixture.events.push({id:i,type:'login',user_id:1,created_at:'2026-10-04T16:01:00Z',metadata:JSON.stringify({account_number:'555111',note:'<script>bad()</script>'}),page:'/login',referrer:'',title:'Sign in'});
fixture.events.push({id:124,type:'login',user_id:2,created_at:'2026-10-04T15:59:59Z',metadata:'{}'},{id:125,type:'whitelist_sync_failed',user_id:3,created_at:now,metadata:'{"account_number":"555111"}'},{id:126,type:'whitelist_orphaned',user_id:null,created_at:now,metadata:'{"accounts":["999888"]}'});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York'});
 const page=await context.newPage();page.setDefaultTimeout(8000);
 let count=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(name,ok)=>{assert.ok(ok,name);count++;console.log('PASS '+name)};
 const waitText=async(selector,re)=>page.waitForFunction(({selector,source})=>new RegExp(source).test(document.querySelector(selector).textContent),{selector,source:re.source});
 const readDb=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mamba_demo_v2')));
 const view=async name=>page.locator('#viewTabs [data-view="'+name+'"]').click();
 const select=async id=>{await view('users');await page.locator('#userFilterTabs [data-status=""]').click();await page.locator('[data-client="'+id+'"]').click();};
 try{
  await page.clock.setFixedTime(new Date(now));
  await context.addInitScript(data=>{
   if(!localStorage.getItem('mamba_demo_v2'))localStorage.setItem('mamba_demo_v2',JSON.stringify(data));
   // Fault injection at the response boundary, on test fixtures only.
   document.addEventListener('DOMContentLoaded',()=>{
    const original=window.fetch;window.__adminCalls=[];
    window.fetch=async function(url,opts){
     const route=String(url);window.__adminCalls.push({url:route,body:opts&&opts.body});
     if(window.__adminFault==='network' && route.endsWith('/admin/ib'))throw new Error('Fixture network unavailable');
     const res=await original.apply(this,arguments);
     if(window.__adminFault==='users' && route==='/api/admin/users')return {ok:false,status:503,json:async()=>({error:'Fixture client refresh unavailable'})};
     if(window.__delayAdminUsers && route==='/api/admin/users')return new Promise(resolve=>{window.__releaseAdminUsers=()=>{window.__delayAdminUsers=false;resolve(res);};});
     if(window.__adminFault==='whitelist' && route.endsWith('/admin/whitelist'))return {ok:true,status:200,json:async()=>({success:true,backend_synced:false,warning:'Trading backend did not confirm. Reconcile manually.'})};
     if(window.__adminFault==='delete' && route.endsWith('/admin/delete-user'))return {ok:true,status:200,json:async()=>({success:true,backend_synced:false,orphaned_accounts:['555111','555333']})};
     return res;
    };
   });
  },fixture);
  await page.goto(BASE+'/admin');await page.locator('#keyScreen').waitFor({state:'visible'});
  await page.locator('[name=admin_key]').fill('wrong');await page.locator('#keyForm [type=submit]').click();
  await page.locator('.key-error').waitFor({state:'visible'});check('invalid admin key stays locked',!await page.locator('#adminPanel').isVisible());
  await page.locator('[name=admin_key]').fill('demo-admin');await page.locator('#keyForm [type=submit]').click();
  await page.locator('#overviewStats .stat-button').first().waitFor();
  check('overview counts actual submitted requests',await page.locator('[data-queue=pending] .stat-value').textContent()==='1'&&await page.locator('[data-queue=whitelist] .stat-value').textContent()==='1');
  check('overview separates historical alerts and all clients',await page.locator('[data-queue=alerts] .stat-value').textContent()==='2'&&await page.locator('[data-queue=""] .stat-value').textContent()==='4');
  await view('overview');await page.evaluate(()=>window.__adminFault='users');await page.locator('#refreshAdmin').click();
  await waitText('#overviewStats',/unavailable/);
  check('failed refresh cannot republish stale client counts or actions',/unavailable/.test(await page.locator('#reviewQueue').textContent())&&await page.locator('#clientDetail [data-action]').count()===0);
  await page.evaluate(()=>window.__adminFault=null);await page.locator('#refreshAdmin').click();await page.locator('#overviewStats .stat-button').first().waitFor();
  check('refresh recovers the client workspace',await page.locator('[data-queue=""] .stat-value').textContent()==='4');
  await page.locator('#viewTabs .active').hover();await page.waitForTimeout(400);
  check('active navigation keeps readable hover colour',await page.locator('#viewTabs .active').evaluate(e=>getComputedStyle(e).color!==getComputedStyle(e).backgroundColor));
  fs.mkdirSync(ART,{recursive:true});await page.screenshot({path:path.join(ART,'admin-overview-desktop.png'),fullPage:true});
  await page.locator('[data-queue=pending]').click();check('overview opens the matching IB request queue',await page.locator('.client-row').count()===1&&/Aina/.test(await page.locator('.client-row').textContent()));
  await select(2);check('registration is not presented as an IB request',/Not requested/.test(await page.locator('#clientDetail').textContent()));
  await select(3);check('IB and MT5 states remain separate',/Approved/.test(await page.locator('#clientDetail').textContent())&&/Portal: pending/.test(await page.locator('#clientDetail').textContent()));
  await page.locator('#adminSearch').fill('555222');check('search finds a client by MT5 number',await page.locator('.client-row').count()===1);await page.locator('#adminSearch').fill('');
  await page.screenshot({path:path.join(ART,'admin-clients-desktop.png'),fullPage:true});
  // Malaysia range must remain effective even when host timezone is New York.
  await view('events');await page.locator('[data-type=login]').click();await page.locator('[data-range=today]').click();
  await waitText('#eventsPage',/123 events/);check('today uses Malaysia midnight',await page.locator('.activity-item').count()===50);
  await view('users');await view('events');await waitText('#eventsPage',/123 events/);
  check('date and type survive navigation',await page.locator('[data-range=today]').getAttribute('class').then(s=>s.includes('active'))&&await page.locator('[data-type=login]').getAttribute('class').then(s=>s.includes('active')));
  const lastCall=await page.evaluate(()=>window.__adminCalls.filter(c=>c.url.startsWith('/api/admin/events?')).at(-1).url);
  check('returning tab requests the displayed date range',new URL(lastCall,locationFallback()).searchParams.get('from')==='2026-10-04T16:00:00.000Z');
  await page.locator('#eventsNext').click();await waitText('#eventsPage',/Page 2/);await page.locator('#eventsNext').click();await waitText('#eventsPage',/Page 3/);
  check('activity pages beyond the first 50',await page.locator('.activity-item').count()===23&&!await page.locator('#eventsNext').isEnabled());
  await page.locator('#eventsPrevious').click();await waitText('#eventsPage',/Page 2/);check('previous page works',await page.locator('.activity-item').count()===50);
  await page.locator('.activity-item summary').first().click();check('metadata expands as safe readable text',/555111/.test(await page.locator('.event-detail').first().textContent())&&await page.locator('.event-detail script').count()===0);
  check('activity time is consistently MYT',/00:01.*MYT/.test(await page.locator('.activity-item time').first().textContent()));
  await page.locator('#eventSearch').fill('ben@');await waitText('#eventsContainer',/No activity/);await page.locator('[data-range=""]').click();await waitText('#eventsPage',/1 events/);check('activity client search applies across date ranges',/Ben/.test(await page.locator('.activity-item').textContent()));
  await page.locator('#eventSearch').fill('');await page.waitForTimeout(250);
  await page.locator('[data-range=custom]').click();await page.locator('#customDateFrom').fill('2026-10-04');await page.locator('#customDateTo').fill('2026-10-04');await page.locator('#customDateApply').click();await waitText('#eventsPage',/1 events/);check('custom dates use Malaysian day boundaries',/Ben/.test(await page.locator('.activity-item').textContent()));
  await view('overview');await page.locator('[data-queue=alerts]').click();await waitText('#eventsPage',/2 events/);check('alert card clears stale activity filters and names its historical scope',await page.locator('.activity-item').count()===2&&/Historical/.test(await page.locator('#activityScope').textContent()));
  // Valetax keeps all existing comparison buckets, guarded import and notices.
  await view('valetax');await waitText('#valetaxStatusLine',/No snapshot/);check('import requires a selected file',!await page.locator('#valetaxImportBtn').isEnabled());
  await page.locator('#valetaxFile').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await page.locator('#valetaxImportBtn').click();await waitText('#valetaxImportNote',/not valid JSON/);check('invalid JSON is explained',await page.locator('#valetaxImportNote').isVisible());
  const snapshot={pulledAt:'2026-09-01T00:00:00Z',clients:[{userEmail:'aina.broker@example.invalid',userName:'Aina',trading:[],hasChildren:true},{userEmail:'new-broker@example.invalid',userName:'Broker only',trading:[{login:'999000'}]}]};
  await page.locator('#valetaxFile').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(snapshot))});await page.locator('#valetaxImportBtn').click();await page.locator('#valetaxReport').waitFor({state:'visible'});
  check('Valetax renders all four comparison buckets',await page.locator('#valetaxBucketTabs button').count()===4);
  check('old snapshot and incomplete downline stay visible',/consider re-pulling/.test(await page.locator('#valetaxStatusLine').textContent())&&/does not include/.test(await page.locator('#valetaxBucketBody').textContent()));
  for(const bucket of ['claimedNotInValetax','accountsNotInValetax','inValetaxNotOnMamba','matched']){await page.locator('[data-bucket='+bucket+']').click();check('Valetax bucket '+bucket+' shows rows',await page.locator('#valetaxBucketBody tbody tr').count()>0);}
  await page.locator('#valetaxFile').setInputFiles({name:'empty.json',mimeType:'application/json',buffer:Buffer.from('{"clients":[]}')});await page.locator('#valetaxImportBtn').click();await waitText('#valetaxImportNote',/no clients/);check('empty import preserves the last valid report',await page.locator('#valetaxReport').isVisible());
  await page.screenshot({path:path.join(ART,'admin-valetax-desktop.png'),fullPage:true});
  // Responsive interaction targets, including the former offscreen Delete button.
  for(const width of [390,320,768]){
   await page.setViewportSize({width,height:844});await select(3);await page.locator('.more-actions summary').click();
   const bad=await page.locator('#clientDetail button:visible, #clientDetail summary:visible, #viewTabs button:visible').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||r.height<43}).map(e=>e.textContent));
   if(bad.length){console.log('Clipped/small:',bad);await page.screenshot({path:path.join(ART,'admin-failing-mobile.png'),fullPage:true});}
   check(width+'px actions fit the viewport with touch-size targets',!bad.length);
   check(width+'px document does not overflow horizontally',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===390)await page.screenshot({path:path.join(ART,'admin-clients-mobile.png'),fullPage:true});
   await page.locator('.more-actions summary').click();
  }
  await page.setViewportSize({width:1440,height:1000});
  await select(1);await page.locator('[data-action=ib][data-status=approved]').click();check('IB confirmation identifies the client',/aina@example.invalid/.test(await page.locator('#dialogDescription').textContent()));
  await page.locator('#dialogCancel').click();check('cancel makes no change',(await readDb()).users.find(u=>u.id===1).ib_status==='pending');
  await page.locator('[data-action=ib][data-status=approved]').click();await page.evaluate(()=>window.__adminFault='network');await page.locator('#dialogSubmit').click();await waitText('#dialogError',/network unavailable/);check('failed action keeps dialog open and allows retry',await page.locator('#actionDialog').isVisible()&&await page.locator('#dialogSubmit').isEnabled());
  await page.evaluate(()=>{window.__adminFault=null;window.__delayAdminUsers=true;});await page.locator('#dialogSubmit').click();
  await page.waitForFunction(()=>typeof window.__releaseAdminUsers==='function');
  check('action stays locked until its client refresh finishes',await page.locator('#actionDialog').isVisible()&&!await page.locator('#dialogSubmit').isEnabled());
  await page.evaluate(()=>window.__releaseAdminUsers());await page.locator('#actionDialog').waitFor({state:'hidden'});check('IB approval updates the intended client',(await readDb()).users.find(u=>u.id===1).ib_status==='approved');
  await select(3);await page.evaluate(()=>window.__adminFault='whitelist');await page.locator('[data-account="31"][data-status=approved]').click();await page.locator('#dialogSubmit').click();await page.locator('#actionDialog').waitFor({state:'hidden'});
  check('partial approval produces a persistent named warning',/555111.*Sara.*portal marked approved/.test(await page.locator('#actionNotice').textContent()));
  await page.reload();await page.locator('#overviewStats .stat-button').first().waitFor();check('warning survives reload',/555111/.test(await page.locator('#actionNotice').textContent()));
  await select(2);await page.locator('.more-actions summary').click();await page.locator('[data-action=reset]').click();await page.locator('#newAdminPassword').fill('new-fixture-password');await page.locator('#confirmAdminPassword').fill('different-fixture-password');await page.locator('#dialogSubmit').click();await waitText('#dialogError',/do not match/);check('password confirmation prevents a mismatched reset',(await readDb()).users.find(u=>u.id===2).password==='fixture-only');
  await page.locator('#confirmAdminPassword').fill('new-fixture-password');await page.locator('#dialogSubmit').click();await page.locator('#actionDialog').waitFor({state:'hidden'});const reset=await readDb();check('password reset updates fixture and invalidates its sessions',reset.users.find(u=>u.id===2).password==='new-fixture-password'&&!reset.tokens.some(t=>t.user_id===2));
  await select(3);await page.locator('.more-actions summary').click();await page.locator('[data-action=delete]').click();await page.locator('#deleteConfirmation').fill('DELETE');await page.evaluate(()=>window.__adminFault='delete');await page.locator('#dialogSubmit').click();await page.locator('#actionDialog').waitFor({state:'hidden'});
  const deleted=await readDb();check('delete removes only the selected fixture and its accounts',!deleted.users.some(u=>u.id===3)&&!deleted.mt5_accounts.some(a=>a.user_id===3)&&deleted.users.length===3);
  check('deletion retains backend cleanup warning and account numbers',/deleted from the portal.*555111, 555333/.test(await page.locator('#actionNotice').textContent()));
  check('no uncaught browser errors',errors.length===0);
  await page.locator('#adminLogoutBtn').click();await page.waitForURL(url=>url.pathname==='/'||url.pathname==='/index.html',{waitUntil:'domcontentloaded'});await page.goto(BASE+'/admin');await page.locator('#keyScreen').waitFor({state:'visible'});check('exit clears admin access',!await page.locator('#adminPanel').isVisible());
  console.log(count+' checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
function locationFallback(){return 'http://localhost';}
