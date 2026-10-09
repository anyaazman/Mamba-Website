#!/usr/bin/env node
// Executes the real browser-local demo API with isolated storage, without a live server.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../demo.js'),'utf8');
function sandbox(host='localhost',initial){
 const storage=new Map();if(initial!==undefined)storage.set('mamba_demo_v2',typeof initial==='string'?initial:JSON.stringify(initial));
 const originalFetch=()=>{throw new Error('Unexpected network access');};
 const window={location:{hostname:host,search:'?demo'},fetch:originalFetch};
 vm.runInNewContext(source,{window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},URL,console:{log(){}},Date,JSON,Promise});
 return {storage,window,originalFetch,read:()=>JSON.parse(storage.get('mamba_demo_v2')),call:(key='demo-admin')=>window.fetch('/api/admin/demo-seed',{method:'POST',headers:{'X-Admin-Key':key},body:'{}'})};
}
(async()=>{
 let n=0;function check(name,ok){assert.ok(ok,name);console.log('PASS '+name);n++;}
 const existing={users:[{id:999,name:'Existing Test',email:'existing@example.invalid',password:'keep-this',ib_status:'approved'}],mt5_accounts:[{id:777,user_id:999,account_number:'88001001',status:'approved'}],tokens:[{user_id:999,token:'keep-this-session'}],events:[{id:44,type:'login',user_id:999}],other_setting:'preserve'};
 const test=sandbox('localhost',existing);
 check('samples require the demo admin key',(await test.call('wrong')).status===403);
 check('unauthorized attempt leaves local data untouched',JSON.stringify(test.read())===JSON.stringify(existing));
 const result=await (await test.call()).json();check('adds six sample clients',result.success&&result.clients_added===6);
 const data=test.read();check('preserves existing clients, accounts and sessions',JSON.stringify(data.users[0])===JSON.stringify(existing.users[0])&&JSON.stringify(data.mt5_accounts[0])===JSON.stringify(existing.mt5_accounts[0])&&JSON.stringify(data.tokens)===JSON.stringify(existing.tokens)&&data.other_setting==='preserve');
 check('IDs and MT5 numbers are unique',new Set(data.users.map(u=>u.id)).size===data.users.length&&new Set(data.mt5_accounts.map(a=>a.id)).size===data.mt5_accounts.length&&new Set(data.mt5_accounts.map(a=>a.account_number)).size===data.mt5_accounts.length);
 check('samples include real submitted and unsubmitted requests',data.users.some(u=>u.ib_status==='pending'&&u.ib_email)&&data.users.some(u=>u.ib_status==='pending'&&!u.ib_email)&&data.mt5_accounts.some(a=>a.status==='pending'&&a.whitelist_requested_at)&&data.mt5_accounts.some(a=>a.status==='pending'&&!a.whitelist_requested_at));
 check('includes approved and rejected records',data.users.some(u=>u.ib_status==='rejected')&&data.mt5_accounts.some(a=>a.status==='approved')&&data.mt5_accounts.some(a=>a.status==='rejected'));
 check('sample events identify simulated data and include sync alerts',data.events.filter(e=>e.id!==44).every(e=>JSON.parse(e.metadata).simulated===true)&&data.events.some(e=>e.type==='whitelist_sync_failed'));
 check('backs up the original browser data',test.storage.get('mamba_demo_before_admin_samples_v1')===JSON.stringify(existing));
 check('adds broker comparison data when absent',data.valetax_snapshot.clients.length===3);
 // Preserve edits and deletion when the sample button is used again.
 data.users=data.users.filter(u=>u.id!==data.admin_samples_v1.user_ids[0]);data.users[1].name='Edited sample';test.storage.set('mamba_demo_v2',JSON.stringify(data));
 const before=test.storage.get('mamba_demo_v2');const repeated=await(await test.call()).json();check('repeated import never duplicates or restores modified samples',repeated.already_added&&test.storage.get('mamba_demo_v2')===before);
 const snapshot={pulledAt:'2026-01-01',clients:[{email:'preserve@example.invalid'}]};const withSnapshot=sandbox('127.0.0.1',{...existing,valetax_snapshot:snapshot});await withSnapshot.call();check('preserves an existing Valetax snapshot',JSON.stringify(withSnapshot.read().valetax_snapshot)===JSON.stringify(snapshot));
 for(const host of ['mambaapp.online','www.mambaapp.online','preview.pages.dev','localhost.example.com']) {
   const remote=sandbox(host,existing);check('remote ?demo leaves real API and saved data untouched: '+host,!remote.window.MAMBA_DEMO&&remote.window.fetch===remote.originalFetch&&JSON.stringify(remote.read())===JSON.stringify(existing));
 }
 const broken=sandbox('localhost','{unreadable');check('refuses to overwrite unreadable saved data',(await broken.call()).status===500&&broken.storage.get('mamba_demo_v2')==='{unreadable');
 console.log(n+' checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
