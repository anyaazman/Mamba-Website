#!/usr/bin/env node
// Real handler + SQLite contract tests, in-memory only. No server, credentials or broker requests.
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
(async()=>{
 const root=path.resolve(__dirname,'..');
 // ADMIN_TEST_ROOT supports replay against a scratch copy of the pre-change source.
 const source=process.env.ADMIN_TEST_ROOT||root;
 const events=await import(pathToFileURL(path.join(source,'functions/api/admin/events.js')));
 const users=await import(pathToFileURL(path.join(source,'functions/api/admin/users.js')));
 const db=new DatabaseSync(':memory:');
 db.exec(fs.readFileSync(path.join(root,'migrations/0001_init.sql'),'utf8'));
 db.exec("ALTER TABLE users ADD COLUMN ib_type TEXT; ALTER TABLE mt5_accounts ADD COLUMN whitelist_requested_at TEXT;");
 db.exec(fs.readFileSync(path.join(root,'migrations/0003_add_events.sql'),'utf8'));
 db.exec(fs.readFileSync(path.join(root,'migrations/0005_add_contact_and_rate_limits.sql'),'utf8'));
 db.exec(fs.readFileSync(path.join(root,'migrations/0014_add_whitelist_divergence_events.sql'),'utf8'));
 const DB={prepare(sql){let params=[];return {bind(...values){params=values;return this},async first(){return db.prepare(sql).get(...params)||null},async all(){return {results:db.prepare(sql).all(...params)}},async run(){return {meta:db.prepare(sql).run(...params)}}};}};
 const key='isolated-admin-contract';db.prepare('INSERT INTO admin_keys(key_hash) VALUES (?)').run(createHash('sha256').update(key).digest('hex'));
 db.exec("INSERT INTO users(id,name,email,password,recovery_phrase,ib_status,ib_email) VALUES(1,'Aina 100%','aina@example.invalid','fixture','fixture','approved','broker@example.invalid'),(2,'Ben','ben@example.invalid','fixture','fixture','pending',''); INSERT INTO mt5_accounts(user_id,account_number,status,whitelist_requested_at) VALUES(1,'555111','pending','2026-10-04 16:01:00');");
 const insert=db.prepare('INSERT INTO events(id,type,user_id,metadata,created_at) VALUES(?,?,?,?,?)');
 for(let i=1;i<=55;i++)insert.run(i,'login',1,JSON.stringify({sample:i}),'2026-10-04 16:01:00');
 insert.run(56,'login',2,'{}','2026-10-04 15:59:59');insert.run(57,'whitelist_sync_failed',1,'{"account_number":"555111"}','2026-10-05 02:00:00');insert.run(58,'whitelist_orphaned',null,'{"accounts":["999888"]}','2026-10-05 03:00:00');
 async function call(handler,params='',auth=key){return handler.onRequestGet({request:new Request('http://unit.test/api/admin/data'+params,{headers:auth?{'X-Admin-Key':auth}:{}}),env:{DB}});}
 let n=0;function check(name,ok){assert.ok(ok,name);console.log('PASS '+name);n++;}
 check('events require admin authorization',(await call(events,'',null)).status===403);
 check('users require admin authorization',(await call(users,'','bad-key')).status===403);
 let u=await (await call(users)).json();check('request timestamp exposed without password fields',u.users[0].mt5_accounts[0].whitelist_requested_at==='2026-10-04 16:01:00'&&!('password' in u.users[0]));
 let one=await (await call(events,'?limit=10&type=login')).json();
 check('filtered totals and bounded page',one.total===56&&one.events.length===10&&!!one.next_cursor);
 // A new row arrives between pages; cursor must not repeat any first-page event.
 insert.run(59,'login',1,'{}','2026-10-05 04:00:00');
 let two=await (await call(events,'?limit=10&type=login&cursor='+encodeURIComponent(one.next_cursor))).json();
 check('stable pagination survives new rows and equal timestamps',two.events.length===10&&!two.events.some(e=>one.events.some(f=>f.id===e.id))&&two.events[0].id===45);
 let ids=one.events.map(e=>e.id),next=one.next_cursor;
 while(next){const p=await (await call(events,'?limit=10&type=login&cursor='+encodeURIComponent(next))).json();ids.push(...p.events.map(e=>e.id));next=p.next_cursor;}
 check('all older pages reachable without duplicates',ids.length===56&&new Set(ids).size===56&&ids.includes(56));
 const search=await (await call(events,'?q='+encodeURIComponent('aina@'))).json();check('search joins client email',search.total===57&&search.events.every(e=>e.user_id===1));
 const literal=await (await call(events,'?q=%25')).json();check('percent search is literal',literal.total===57);
 const sqlInput=await (await call(events,'?q='+encodeURIComponent("' OR 1=1 --"))).json();check('search input cannot broaden query',sqlInput.total===0);
 const alerts=await (await call(events,'?type=sync_alerts')).json();check('sync alerts include failures and deleted-client orphan records',alerts.total===2&&alerts.events.some(e=>e.user_id===null&&e.metadata.includes('999888')));
 const failure=await (await call(events,'?type=whitelist_sync_failed')).json();check('failure type filter does not fall back to all events',failure.total===1&&failure.events[0].type==='whitelist_sync_failed');
 const range=await (await call(events,'?type=login&from=2026-10-04T16:00:00.000Z&to=2026-10-05T01:00:00.000Z')).json();check('Malaysia day boundary filters SQL UTC timestamps',range.total===55);
 check('invalid cursor rejected',(await call(events,'?cursor=not-json')).status===400);
 check('invalid date rejected',(await call(events,'?from=no-date')).status===400);
 check('reversed date range rejected',(await call(events,'?from=2026-10-06&to=2026-10-05')).status===400);
 const clamped=await (await call(events,'?limit=-1')).json();check('negative page size cannot dump all events',clamped.events.length===1);
 db.close();console.log(n+' checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
