/**
 * In-app account deletion reaches the portal.
 *
 * Run:  npx wrangler pages dev . --port 8789 --local \
 *         --binding BACKEND_ADMIN_KEY=test-backend-key --binding BACKEND_MANAGER_URL=http://127.0.0.1:9
 *       node tests/account-deleted-sync.spec.js [baseUrl] [backendKey]
 *
 * (BACKEND_MANAGER_URL is pointed at a dead port so no other route can reach
 * the real Manager with the test key.)
 *
 * When a client deletes their account in the app, the Bridge removes it from
 * farm.db and POSTs /api/backend/account-deleted. Before this, D1 still said
 * 'approved' and the client was shown approved while every login was refused
 * (2421001779, 2026-10-15). Only an approved row is reset; a rejection or a
 * request under review is the operator's and stays.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const BASE = process.argv[2] || 'http://localhost:8789';
const KEY = process.argv[3] || 'test-backend-key';
const ROOT = path.resolve(__dirname, '..');
const DB = 'mamba-db';
const MARK = 'appdelete.test';

const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const SPAWN_OPTS = process.platform === 'win32' ? { shell: true } : {};
let sqlSeq = 0;

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}
const section = t => console.log('\n' + t);

function sql(command) {
  // os.tmpdir(), not ROOT: `wrangler pages dev` reloads on any file change in the repo.
  const tmp = path.join(os.tmpdir(), `d1-stmt-${process.pid}-${sqlSeq++}.sql`);
  fs.writeFileSync(tmp, command, 'utf8');
  try {
    return execFileSync(NPX, ['wrangler', 'd1', 'execute', DB, '--local', '--json', '--file', tmp],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...SPAWN_OPTS });
  } finally { try { fs.unlinkSync(tmp); } catch {} }
}
const rows = command => JSON.parse(sql(command).match(/\[[\s\S]*\]/)[0])[0].results;

async function notify(body, key = KEY) {
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(BASE + '/api/backend/account-deleted',
    { method: 'POST', headers, body: JSON.stringify(body) });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

function cleanup() {
  try {
    sql(`DELETE FROM events WHERE type = 'app_account_deleted' AND metadata LIKE '%"99000%'`);
    sql(`DELETE FROM mt5_accounts WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%${MARK}')`);
    sql(`DELETE FROM users WHERE email LIKE '%${MARK}'`);
    sql(`DELETE FROM rate_limits`);
  } catch (e) { console.log('  (cleanup warning: ' + e.message.slice(0, 90) + ')'); }
}

(async () => {
  console.log(`In-app deletion sync -> ${BASE}\n`);
  try {
    await fetch(BASE + '/index.html', { redirect: 'manual' });
  } catch (e) {
    console.error(`Cannot reach ${BASE}. See the Run line at the top of this file.\n`);
    process.exit(1);
  }

  cleanup();
  const email = `del-${Date.now()}@${MARK}`;
  sql(`INSERT INTO users (name, email, password, recovery_phrase) VALUES ('App Delete', '${email}', 'x', 'y')`);
  const uid = rows(`SELECT id FROM users WHERE email = '${email}'`)[0].id;
  sql(`INSERT INTO mt5_accounts (user_id, account_number, status) VALUES (${uid}, '99000101', 'approved')`);
  sql(`INSERT INTO mt5_accounts (user_id, account_number, status) VALUES (${uid}, '99000102', 'rejected')`);
  sql(`INSERT INTO mt5_accounts (user_id, account_number, status, whitelist_requested_at)
       VALUES (${uid}, '99000103', 'pending', datetime('now'))`);
  const status = num => rows(
    `SELECT status, whitelist_requested_at FROM mt5_accounts WHERE account_number = '${num}'`)[0];

  section('[1] only the backend may call it');
  let r = await notify({ account_number: '99000101' }, null);
  check('no key -> 401', r.status === 401, r.status);
  r = await notify({ account_number: '99000101' }, 'wrong-key');
  check('wrong key -> 401', r.status === 401, r.status);
  check('the approved row is untouched by refused calls', status('99000101').status === 'approved',
    JSON.stringify(status('99000101')));

  section('[2] bad input is a 400, not a 500');
  for (const bad of [{}, { account_number: '12ab' }, { account_number: 99000101 }]) {
    r = await notify(bad);
    check(`${JSON.stringify(bad)} -> 400`, r.status === 400, r.status);
  }

  section('[3] an approved account goes back to "not whitelisted"');
  r = await notify({ account_number: '99000101' });
  check('-> 200 reset', r.status === 200 && r.data.found === true && r.data.reset === true, JSON.stringify(r.data));
  const after = status('99000101');
  check('status is pending', after.status === 'pending', JSON.stringify(after));
  check('no request stamp, so the portal offers Request Whitelist', after.whitelist_requested_at === null,
    JSON.stringify(after));
  const evt = rows(`SELECT metadata FROM events WHERE type = 'app_account_deleted' AND metadata LIKE '%99000101%'`);
  check('app_account_deleted event row written (needs migration 0015)', evt.length === 1, JSON.stringify(evt));
  r = await notify({ account_number: '99000101' });
  check('a repeat is harmless', r.status === 200 && r.data.reset === false, JSON.stringify(r.data));

  section("[4] the operator's decisions stay");
  r = await notify({ account_number: '99000102' });
  check('rejected stays rejected', r.status === 200 && r.data.reset === false && status('99000102').status === 'rejected',
    JSON.stringify(r.data));
  r = await notify({ account_number: '99000103' });
  const review = status('99000103');
  check('a request under review stays under review',
    r.data.reset === false && review.status === 'pending' && review.whitelist_requested_at !== null, JSON.stringify(review));

  section('[5] an account the portal never had');
  r = await notify({ account_number: '99000999' });
  check('-> 200, found false', r.status === 200 && r.data.found === false && r.data.reset === false, JSON.stringify(r.data));

  cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); cleanup(); process.exit(1); });
