/**
 * Whitelist sync reporting.
 *
 * Run:  npx wrangler pages dev . --port 8789 --local     (in another shell)
 *       node tests/whitelist-sync-reporting.spec.js [baseUrl]
 *
 * Covers the case where D1 and the trading backend disagree. Approving an
 * account in the portal writes 'approved' to D1 and separately calls the
 * Manager to add it to farm.db. Those can diverge, and when they do the client
 * is shown "approved" while the Bridge still refuses the login.
 *
 * Two endpoints used to hide that. /api/admin/whitelist returned an unqualified
 * {success:true} whatever the sync did, and /api/admin/delete-user fired the
 * backend removal through waitUntil() and never looked at the result — then
 * deleted the D1 rows recording which account it was, leaving an orphan that
 * could still trade and that nothing on either side remembered.
 *
 * In local dev BACKEND_ADMIN_KEY is unset, so syncBackendWhitelist() returns
 * {ok:false, skipped:true} without a network call. That is precisely the
 * divergence path, which makes it cheap to assert against here.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

const BASE = process.argv[2] || 'http://localhost:8789';
const ROOT = path.resolve(__dirname, '..');
const DB = 'mamba-db';
const ADMIN_KEY = 'test-sync-reporting-key';
const KEY_HASH = crypto.createHash('sha256').update(ADMIN_KEY).digest('hex');
const MARK = 'syncreport.test';

const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const SPAWN_OPTS = process.platform === 'win32' ? { shell: true } : {};
let sqlSeq = 0;

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}
const section = t => console.log('\n' + t);

function sqlFile(file) {
  return execFileSync(NPX, ['wrangler', 'd1', 'execute', DB, '--local', '--file', file],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...SPAWN_OPTS });
}
function sql(command) {
  // os.tmpdir(), NOT ROOT: `wrangler pages dev` watches the served directory and
  // reloads on any file change, so writing scratch .sql files into the repo root
  // bounced the worker mid-suite and surfaced as "fetch failed".
  const tmp = path.join(os.tmpdir(), `d1-stmt-${process.pid}-${sqlSeq++}.sql`);
  fs.writeFileSync(tmp, command, 'utf8');
  try { return sqlFile(tmp); } finally { try { fs.unlinkSync(tmp); } catch {} }
}

async function api(method, route, { key, body } = {}) {
  const headers = {};
  // Admin routes authenticate with X-Admin-Key (see _helpers.js verifyAdminKey),
  // not an Authorization bearer — that one is for user tokens.
  if (key) headers['X-Admin-Key'] = key;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + route, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

function cleanup() {
  try {
    sql(`DELETE FROM mt5_accounts WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%${MARK}')`);
    sql(`DELETE FROM tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%${MARK}')`);
    sql(`DELETE FROM events WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%${MARK}')`);
    sql(`DELETE FROM users WHERE email LIKE '%${MARK}'`);
    sql(`DELETE FROM admin_keys WHERE label = 'sync-reporting-spec'`);
    // Other suites hammer the admin key to prove the brute-force lockout works,
    // which leaves this IP throttled. Clear it or every request here is a 403.
    sql(`DELETE FROM rate_limits`);
  } catch (e) { console.log('  (cleanup warning: ' + e.message.slice(0, 90) + ')'); }
}

(async () => {
  console.log(`Whitelist sync reporting -> ${BASE}\n`);
  try {
    const probe = await fetch(BASE + '/index.html', { redirect: 'manual' });
    if (!probe.ok && probe.status !== 308 && probe.status !== 301) throw new Error('bad status ' + probe.status);
  } catch (e) {
    console.error(`Cannot reach ${BASE}. Start it with:\n  npx wrangler pages dev . --port 8789 --local\n`);
    process.exit(1);
  }

  cleanup();
  sql(`INSERT INTO admin_keys (key_hash, label) VALUES ('${KEY_HASH}', 'sync-reporting-spec')`);

  const email = `sync-${Date.now()}@${MARK}`;
  sql(`INSERT INTO users (name, email, password, recovery_phrase) VALUES ('Sync Report', '${email}', 'x', 'y')`);
  const uid = JSON.parse(sql(`SELECT id FROM users WHERE email = '${email}'`).match(/\[[\s\S]*\]/)[0])[0]
    .results[0].id;
  sql(`INSERT INTO mt5_accounts (user_id, account_number, status) VALUES (${uid}, '99000011', 'pending')`);
  sql(`INSERT INTO mt5_accounts (user_id, account_number, status) VALUES (${uid}, '99000022', 'pending')`);
  const accts = JSON.parse(
    sql(`SELECT id, account_number FROM mt5_accounts WHERE user_id = ${uid} ORDER BY id`).match(/\[[\s\S]*\]/)[0]
  )[0].results;

  section('[1] approving with the backend unreachable must not report plain success');
  const appr = await api('POST', '/api/admin/whitelist',
    { key: ADMIN_KEY, body: { account_id: accts[0].id, status: 'approved' } });
  check('approve -> 200', appr.status === 200, appr.status);
  check('response carries backend_synced', appr.data && 'backend_synced' in appr.data, JSON.stringify(appr.data));
  check('backend_synced is false when the sync did not confirm',
    appr.data && appr.data.backend_synced === false, JSON.stringify(appr.data));
  check('a warning names the divergence',
    appr.data && typeof appr.data.warning === 'string' && appr.data.warning.length > 0,
    JSON.stringify(appr.data));

  section('[2] the divergence leaves a durable trace, not just a Telegram alert');
  const evt = sql(`SELECT type FROM events WHERE type = 'whitelist_sync_failed'`);
  check('whitelist_sync_failed event row written', evt.includes('whitelist_sync_failed'), evt.slice(-160));

  section('[3] D1 still updated — the sync failure must not block the operator');
  const st = sql(`SELECT status FROM mt5_accounts WHERE id = ${accts[0].id}`);
  check('account still marked approved in D1', st.includes('approved'), st.slice(-160));

  section('[4] deleting a user reports which accounts were left behind');
  const del = await api('POST', '/api/admin/delete-user', { key: ADMIN_KEY, body: { user_id: uid } });
  check('delete-user -> 200', del.status === 200, del.status);
  check('response carries backend_synced', del.data && 'backend_synced' in del.data, JSON.stringify(del.data));
  check('backend_synced is false when removal did not confirm',
    del.data && del.data.backend_synced === false, JSON.stringify(del.data));
  check('the orphaned account numbers are named',
    del.data && Array.isArray(del.data.orphaned_accounts)
      && del.data.orphaned_accounts.includes('99000011')
      && del.data.orphaned_accounts.includes('99000022'),
    JSON.stringify(del.data));

  section('[5] the orphan is recorded before the D1 rows that identify it are dropped');
  const orphanEvt = sql(`SELECT metadata FROM events WHERE type = 'whitelist_orphaned'`);
  check('whitelist_orphaned event row written', orphanEvt.includes('whitelist_orphaned') || orphanEvt.includes('99000011'), orphanEvt.slice(-200));
  check('the event names the accounts', orphanEvt.includes('99000011'), orphanEvt.slice(-200));

  section('[6] the user is still deleted — backend availability must not block it');
  const gone = sql(`SELECT id FROM users WHERE email = '${email}'`);
  check('user row removed', !gone.includes(email), gone.slice(-160));

  cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('\nSuite crashed: ' + e.message);
  cleanup();
  process.exit(1);
});
