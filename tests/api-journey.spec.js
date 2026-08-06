#!/usr/bin/env node
/*
 * The member journey against the REAL API and a real D1 — not the demo mock.
 *
 * Run:  npx wrangler pages dev . --port 8789 --local     (in another shell)
 *       node tests/api-journey.spec.js  [baseUrl]
 *
 * user-journey.spec.js drives the ?demo sandbox, where every endpoint is
 * reimplemented in demo.js against localStorage. That covers the UI, but it
 * means the actual auth, registration and MT5 endpoints — PBKDF2 hashing,
 * token issue and expiry, the server-side IB gate, the UNIQUE constraint on
 * account_number, the consent requirement — were only ever exercised through a
 * mock that could drift from them. This drives the endpoints themselves.
 *
 * Seeds the LOCAL D1 with its own admin key and namespaces every user it
 * creates with a marker email domain, deleting them on the way in and out, so
 * repeat runs are idempotent and the remote database is never touched.
 *
 * Covers: register (and every rejection), consent enforcement, case-insensitive
 * login, token auth, the IB gate on both gated endpoints, MT5 uniqueness,
 * whitelist request incl. the whitelist_requested_at stamp from migration 0008,
 * profile update, logout invalidation, and the admin view of the same user.
 */
'use strict';

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

const BASE = process.argv[2] || 'http://localhost:8789';
const ROOT = path.resolve(__dirname, '..');
const DB = 'mamba-db';

const ADMIN_KEY = 'test-api-journey-key';
const KEY_HASH = crypto.createHash('sha256').update(ADMIN_KEY).digest('hex');
const MARK = 'apijourney.test';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}
const section = t => console.log('\n' + t);

// Running wrangler from Node on Windows is awkward: npx is npx.cmd, and since
// CVE-2024-27980 execFileSync refuses to launch a .cmd at all (ENOENT, then
// EINVAL). Going through cmd.exe fixes the launch but not the arguments — a
// shell splits "--command INSERT INTO ..." on spaces and wrangler reports a
// dozen unknown arguments.
//
// So no SQL is ever passed as an argument now. sql() writes the statement to a
// temp file and both paths use --file, whose one argument is a space-free path.
// Same code on every platform, and it stays correct if a query ever needs a
// quote of either kind.
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const SPAWN_OPTS = process.platform === 'win32' ? { shell: true } : {};
let sqlSeq = 0;

function sql(command) {
  // os.tmpdir(), NOT ROOT: `wrangler pages dev` watches the served directory and
  // reloads on any file change, so writing scratch .sql files into the repo root
  // bounced the worker mid-suite and surfaced as "fetch failed".
  const tmp = path.join(os.tmpdir(), `d1-stmt-${process.pid}-${sqlSeq++}.sql`);
  fs.writeFileSync(tmp, command, 'utf8');
  try {
    return sqlFile(tmp);
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
  }
}
function sqlFile(file) {
  return execFileSync(NPX, ['wrangler', 'd1', 'execute', DB, '--local', '--file', file],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...SPAWN_OPTS });
}

async function api(method, route, { token, key, body } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (key) headers['X-Admin-Key'] = key;
  const sendsBody = method !== 'GET' && method !== 'HEAD';
  if (sendsBody && body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + route, {
    method, headers,
    body: sendsBody && body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON */ }
  return { status: res.status, data };
}

const EMAIL = `member@${MARK}`;
const PASSWORD = 'correct-horse-battery';
const RECOVERY = 'recovery phrase for the api journey suite';
const IB_EMAIL = `member-ib@${MARK}`;
const MT5_A = '4410001';
const MT5_B = '4410002';

function seed() {
  // The full set this suite depends on. Local D1 had drifted well behind
  // production — 0005, 0006, 0008 and 0009 were all missing, which silently
  // disabled rate limiting and discarded two event types, because every one of
  // those paths is wrapped in a try/catch that fails open. Applying them here
  // keeps the drift from coming back.
  sqlFile('migrations/0001_init.sql');
  // 0014 must stay last and must not be dropped from this list. 0006, 0009 and
  // 0014 each REBUILD the events table to widen its CHECK constraint, so
  // replaying an earlier one after a later one silently narrows the constraint
  // again — which is how whitelist-sync-reporting.spec.js came to fail three
  // "event row written" checks against a database that had 0014 applied.
  for (const m of ['0003_add_events.sql', '0005_add_contact_and_rate_limits.sql',
                   '0006_add_whitelist_synced_event.sql', '0008_add_whitelist_requested_at.sql',
                   '0009_add_account_deletion_request_event.sql',
                   '0014_add_whitelist_divergence_events.sql']) {
    try { sqlFile('migrations/' + m); } catch (e) { /* already applied */ }
  }
  for (const c of ["ALTER TABLE users ADD COLUMN ib_email TEXT DEFAULT ''",
                   "ALTER TABLE users ADD COLUMN ib_type TEXT DEFAULT ''"]) {
    try { sql(c); } catch (e) { /* present already */ }
  }
  cleanup();
  sql(`INSERT INTO admin_keys (key_hash, label) VALUES ('${KEY_HASH}', 'api-journey-spec')`);
}

// register/login are rate limited per IP, and the limiter runs BEFORE the
// validation it protects. A suite that probes six rejection paths would spend
// the budget and start getting 429s instead of the 400s it is asserting, so the
// bucket is cleared between probes and the limiter is tested on its own in [14].
function clearRateLimit(scope) {
  try { sql(`DELETE FROM rate_limits WHERE rl_key LIKE '${scope}:%'`); } catch (e) { /* pre-0005 */ }
}

function cleanup() {
  try {
    sql(`DELETE FROM tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%${MARK}')`);
    sql(`DELETE FROM mt5_accounts WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%${MARK}')`);
    sql(`DELETE FROM events WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%${MARK}')`);
    sql(`DELETE FROM users WHERE email LIKE '%${MARK}'`);
    sql(`DELETE FROM admin_keys WHERE key_hash = '${KEY_HASH}'`);
    // Rate-limit buckets are per-IP; this suite registers and logs in enough
    // times to trip them on a repeat run if they are left behind.
    sql(`DELETE FROM rate_limits WHERE rl_key LIKE 'register:%' OR rl_key LIKE 'login:%'
          OR rl_key LIKE 'adminkey:%' OR rl_key LIKE 'adminstatus:%'
          OR rl_key LIKE 'account_deletion:%'`);
  } catch (e) { console.log('  (cleanup warning: ' + e.message.slice(0, 80) + ')'); }
}

(async () => {
  console.log(`API journey suite -> ${BASE}\n`);
  try {
    await fetch(BASE + '/api/admin/status', { headers: { 'X-Admin-Key': 'probe' } });
  } catch (e) {
    console.error(`Cannot reach ${BASE}. Start it with:\n  npx wrangler pages dev . --port 8789 --local\n`);
    process.exit(1);
  }

  console.log('Seeding local D1…');
  seed();

  section('[1] registration validates its input');
  const base = { name: 'API Member', email: EMAIL, password: PASSWORD,
                 recovery_phrase: RECOVERY, accept_terms: true };
  for (const [label, patch, expect] of [
    ['missing name',            { name: '' },                    400],
    ['invalid email',           { email: 'not-an-email' },       400],
    ['short password',          { password: 'short' },           400],
    ['short recovery phrase',   { recovery_phrase: 'tiny' },     400],
    ['consent not accepted',    { accept_terms: false },         400],
    ['consent absent entirely', { accept_terms: undefined },     400],
  ]) {
    const body = Object.assign({}, base, patch);
    if (patch.accept_terms === undefined && 'accept_terms' in patch) delete body.accept_terms;
    clearRateLimit('register');
    const res = await api('POST', '/api/auth/register', { body });
    check(`register rejects ${label} -> ${expect}`, res.status === expect,
      `${res.status} ${JSON.stringify(res.data)}`);
  }
  const noneCreated = sql(`SELECT COUNT(*) AS n FROM users WHERE email LIKE '%${MARK}'`);
  check('no user was created by the rejected attempts', /"n":\s*0/.test(noneCreated), noneCreated.match(/"n":\s*\d+/));

  section('[2] register, and the consent is recorded');
  clearRateLimit('register');
  const reg = await api('POST', '/api/auth/register', { body: base });
  check('register -> 200/201', reg.status === 200 || reg.status === 201, `${reg.status} ${JSON.stringify(reg.data)}`);
  const token = reg.data && reg.data.token;
  check('a token is issued', typeof token === 'string' && token.length > 20, typeof token);
  check('the password is not echoed back', !/correct-horse/.test(JSON.stringify(reg.data)), '');

  const stored = sql(`SELECT password FROM users WHERE email = '${EMAIL}'`);
  check('the password is stored hashed, not in clear', !stored.includes(PASSWORD), '');
  check('the hash carries a salt (salt:hash form)', /"password":\s*"[0-9a-f]+:[0-9a-f]+"/.test(stored), '');

  clearRateLimit('register');
  const dupe = await api('POST', '/api/auth/register', { body: base });
  check('duplicate email -> 409', dupe.status === 409, `${dupe.status} ${JSON.stringify(dupe.data)}`);

  section('[3] login');
  clearRateLimit('login');
  const badPw = await api('POST', '/api/auth/login', { body: { email: EMAIL, password: 'wrong-password' } });
  check('wrong password -> 401', badPw.status === 401, badPw.status);
  check('wrong password does not say which field was wrong',
    /invalid email or password/i.test((badPw.data && badPw.data.error) || ''), JSON.stringify(badPw.data));

  const upper = await api('POST', '/api/auth/login', { body: { email: EMAIL.toUpperCase(), password: PASSWORD } });
  check('login is case-insensitive on email', upper.status === 200, `${upper.status} ${JSON.stringify(upper.data)}`);
  const token2 = upper.data && upper.data.token;
  check('login issues a token', typeof token2 === 'string', typeof token2);
  check('the new token differs from the registration token', token2 !== token, '');

  section('[4] token authentication');
  const meNo = await api('GET', '/api/auth/me');
  check('/auth/me without a token -> 401', meNo.status === 401, meNo.status);
  const meBad = await api('GET', '/api/auth/me', { token: 'not-a-real-token' });
  check('/auth/me with a forged token -> 401', meBad.status === 401, meBad.status);
  const me = await api('GET', '/api/auth/me', { token });
  check('/auth/me with the real token -> 200', me.status === 200, me.status);
  check('/auth/me returns the right user', me.data && me.data.user && me.data.user.email === EMAIL,
    JSON.stringify(me.data && me.data.user));
  check('/auth/me never returns the password hash',
    !/password/.test(JSON.stringify(me.data)), JSON.stringify(me.data).slice(0, 120));

  section('[5] the IB gate is enforced server-side, not just in the UI');
  const gatedMt5 = await api('POST', '/api/user/add-mt5', { token, body: { account_number: MT5_A } });
  check('add-mt5 before any IB request -> 403', gatedMt5.status === 403, `${gatedMt5.status} ${JSON.stringify(gatedMt5.data)}`);
  const gatedWl = await api('POST', '/api/user/request-whitelist', { token, body: { account_id: 1 } });
  check('request-whitelist before any IB request -> 403', gatedWl.status === 403, gatedWl.status);
  const stillNone = sql(`SELECT COUNT(*) AS n FROM mt5_accounts WHERE user_id IN (SELECT id FROM users WHERE email = '${EMAIL}')`);
  check('the gated call created no account', /"n":\s*0/.test(stillNone), stillNone.match(/"n":\s*\d+/));

  section('[6] request IB verification');
  const badIb = await api('POST', '/api/user/request-ib', { token, body: { ib_email: 'nope', ib_type: 'new' } });
  check('a malformed Valetax email -> 400', badIb.status === 400, badIb.status);
  const ib = await api('POST', '/api/user/request-ib', { token, body: { ib_email: IB_EMAIL, ib_type: 'new' } });
  check('request-ib -> 200', ib.status === 200, `${ib.status} ${JSON.stringify(ib.data)}`);
  const afterIb = await api('GET', '/api/auth/me', { token });
  check('ib_email is now set', afterIb.data.user.ib_email === IB_EMAIL, afterIb.data.user.ib_email);
  check('ib_status is pending', afterIb.data.user.ib_status === 'pending', afterIb.data.user.ib_status);

  section('[7] MT5 accounts');
  const shortNum = await api('POST', '/api/user/add-mt5', { token, body: { account_number: '12' } });
  check('too-short account number -> 400', shortNum.status === 400, shortNum.status);
  const notNum = await api('POST', '/api/user/add-mt5', { token, body: { account_number: 'abcdefg' } });
  check('non-numeric account number -> 400', notNum.status === 400, notNum.status);

  const add1 = await api('POST', '/api/user/add-mt5', { token, body: { account_number: MT5_A } });
  check('add-mt5 after the IB request -> 200/201', add1.status === 200 || add1.status === 201,
    `${add1.status} ${JSON.stringify(add1.data)}`);
  const add2 = await api('POST', '/api/user/add-mt5', { token, body: { account_number: MT5_B } });
  check('a second account is accepted', add2.status === 200 || add2.status === 201, add2.status);

  // Squatting guard: the same MT5 login must not be claimable twice, by anyone.
  const dupeMt5 = await api('POST', '/api/user/add-mt5', { token, body: { account_number: MT5_A } });
  check('the same MT5 number cannot be added twice', dupeMt5.status >= 400,
    `${dupeMt5.status} ${JSON.stringify(dupeMt5.data)}`);

  const withAccts = await api('GET', '/api/auth/me', { token });
  const accts = (withAccts.data.user.mt5_accounts) || [];
  check('/auth/me lists both accounts', accts.length === 2, accts.length);
  check('new accounts start pending', accts.every(a => a.status === 'pending'), JSON.stringify(accts));
  check('new accounts have no whitelist request stamp',
    accts.every(a => a.whitelist_requested_at === null), JSON.stringify(accts));

  section('[8] whitelist request stamps the time (migration 0008)');
  const target = accts[0];
  const notMine = await api('POST', '/api/user/request-whitelist', { token, body: { account_id: 999999 } });
  check("another user's account id -> 404", notMine.status === 404, notMine.status);

  const wl = await api('POST', '/api/user/request-whitelist', { token, body: { account_id: target.id } });
  check('request-whitelist -> 200', wl.status === 200, `${wl.status} ${JSON.stringify(wl.data)}`);
  const afterWl = await api('GET', '/api/auth/me', { token });
  const stamped = (afterWl.data.user.mt5_accounts || []).find(a => a.id === target.id);
  check('whitelist_requested_at is now set', !!(stamped && stamped.whitelist_requested_at),
    JSON.stringify(stamped));
  const untouched = (afterWl.data.user.mt5_accounts || []).find(a => a.id !== target.id);
  check('the other account is untouched', untouched && untouched.whitelist_requested_at === null,
    JSON.stringify(untouched));

  section('[8b] an unapproved IB cannot auto-whitelist itself into the backend');
  // The defect this pins: request-whitelist only checked that ib_email was
  // non-empty, so a user whose IB had been revoked could re-submit the IB form
  // with any address and sync straight back into the trading backend — no admin
  // involved. Revocation was undoable by the person being revoked.
  const stillPending = sql(
    `SELECT status FROM mt5_accounts WHERE id = ${target.id};`);
  check('a pending-IB user never reaches approved via request-whitelist',
    !/"status":\s*"approved"/.test(stillPending), stillPending);
  check('the response says approval is still required',
    /IB verification is approved/.test(JSON.stringify(wl.data)), JSON.stringify(wl.data));

  // The revoked case specifically: rejected IB, then re-request, then retry.
  sql(`UPDATE users SET ib_status='rejected', ib_email='' WHERE email='${EMAIL}';`);
  const revokedWl = await api('POST', '/api/user/request-whitelist',
    { token, body: { account_id: target.id } });
  check('a revoked user is refused outright -> 403', revokedWl.status === 403, revokedWl.status);

  const reIb = await api('POST', '/api/user/request-ib',
    { token, body: { ib_email: IB_EMAIL, ib_type: 'existing' } });
  check('a revoked user may re-request IB -> 200', reIb.status === 200, reIb.status);
  const afterReIb = sql(`SELECT ib_status FROM users WHERE email='${EMAIL}';`);
  check('re-requesting lands in pending, not approved',
    /"ib_status":\s*"pending"/.test(afterReIb), afterReIb);

  const retryWl = await api('POST', '/api/user/request-whitelist',
    { token, body: { account_id: target.id } });
  check('re-requesting IB does not restore the whitelist', retryWl.status === 200, retryWl.status);
  const afterRetry = sql(`SELECT status FROM mt5_accounts WHERE id = ${target.id};`);
  check('the account is still NOT approved after the re-request cycle',
    !/"status":\s*"approved"/.test(afterRetry), afterRetry);

  sql(`UPDATE users SET ib_status='pending' WHERE email='${EMAIL}';`);

  section('[9] profile update');
  const longName = await api('PUT', '/api/user/update', { token, body: { name: 'x'.repeat(101) } });
  check('an over-long name -> 400', longName.status === 400, longName.status);
  const upd = await api('PUT', '/api/user/update', { token, body: { name: 'Renamed Member' } });
  check('update -> 200', upd.status === 200, `${upd.status} ${JSON.stringify(upd.data)}`);
  const renamed = await api('GET', '/api/auth/me', { token });
  check('the new name is returned', renamed.data.user.name === 'Renamed Member', renamed.data.user.name);

  section('[10] the admin sees the same user');
  const users = await api('GET', '/api/admin/users', { key: ADMIN_KEY });
  check('/api/admin/users -> 200', users.status === 200, users.status);
  const mine = (users.data.users || []).find(u => u.email === EMAIL);
  check('the user appears in the admin list', !!mine, '');
  check('the admin sees their IB email', mine && mine.ib_email === IB_EMAIL, mine && mine.ib_email);
  check('the admin sees both MT5 accounts', mine && (mine.mt5_accounts || []).length === 2,
    mine && (mine.mt5_accounts || []).length);

  section('[11] logout invalidates the token');
  const out = await api('POST', '/api/auth/logout', { token, body: {} });
  check('logout -> 200', out.status === 200, out.status);
  const afterOut = await api('GET', '/api/auth/me', { token });
  check('the token no longer authenticates', afterOut.status === 401, afterOut.status);
  const other = await api('GET', '/api/auth/me', { token: token2 });
  check('the other session is still valid', other.status === 200, other.status);

  // Migration 0009 exists because this event type was missing from the events
  // CHECK constraint, so the INSERT failed, recordEvent swallowed it, and the
  // endpoint answered 201 while persisting nothing — the durable record that
  // Play Store compliance depends on. Assert the row, not the status code.
  section('[12] a deletion request is actually persisted (migration 0009)');
  const before = sql("SELECT COUNT(*) AS n FROM events WHERE type = 'account_deletion_request'");
  const beforeN = Number((before.match(/"n":\s*(\d+)/) || [])[1]);
  const del = await api('POST', '/api/request-deletion',
    { body: { email: EMAIL, mt5_account: MT5_A, reason: 'suite', confirm: true } });
  check('request-deletion -> 201', del.status === 201, `${del.status} ${JSON.stringify(del.data)}`);
  const after = sql("SELECT COUNT(*) AS n FROM events WHERE type = 'account_deletion_request'");
  const afterN = Number((after.match(/"n":\s*(\d+)/) || [])[1]);
  check('the event row really exists', afterN === beforeN + 1, `${beforeN} -> ${afterN}`);

  const noConfirm = await api('POST', '/api/request-deletion', { body: { email: EMAIL, confirm: false } });
  check('an unconfirmed deletion -> 400', noConfirm.status === 400, noConfirm.status);

  // The brute-force guard lives in verifyAdminKey, so it covers every admin
  // route by construction. It fails open when rate_limits is missing, which is
  // why this only became testable once the table was in place.
  section('[13] admin key brute force is locked out');
  // Probed through /api/admin/users, not /api/admin/status: status carries its
  // own 'adminstatus' limiter that answers 429 first and would mask the guard
  // under test. verifyAdminKey's budget is consumed only on a WRONG key, so a
  // valid key is never throttled however often the panel polls.
  clearRateLimit('adminkey');
  const okBefore = await api('GET', '/api/admin/users', { key: ADMIN_KEY });
  check('the real key works before the lockout', okBefore.status === 200, okBefore.status);
  for (let i = 0; i < 11; i++) {
    await api('GET', '/api/admin/users', { key: 'wrong-key-' + i });
  }
  const lockedOut = await api('GET', '/api/admin/users', { key: ADMIN_KEY });
  check('the CORRECT key is refused once the budget is spent', lockedOut.status === 403,
    `${lockedOut.status} — a guesser must not be able to keep trying`);
  clearRateLimit('adminkey');
  const recovered = await api('GET', '/api/admin/users', { key: ADMIN_KEY });
  check('the key works again once the window clears', recovered.status === 200, recovered.status);

  // The second layer: status.js additionally throttles by endpoint.
  clearRateLimit('adminstatus'); clearRateLimit('adminkey');
  let statusLimited = false;
  for (let i = 0; i < 12; i++) {
    const r = await api('GET', '/api/admin/status', { key: ADMIN_KEY });
    if (r.status === 429) { statusLimited = true; break; }
  }
  check('/api/admin/status has its own per-endpoint budget', statusLimited, '');
  clearRateLimit('adminstatus'); clearRateLimit('adminkey');

  // These fail OPEN by design, so a missing rate_limits table disables them
  // silently — which is exactly the state local D1 was in until this suite was
  // written. Assert the budget actually bites.
  section('[14] registration is rate limited per IP');
  clearRateLimit('register');
  let sawLimit = false, lastStatus = 0;
  for (let i = 0; i < 7; i++) {
    const r = await api('POST', '/api/auth/register',
      { body: { name: 'Flood', email: `flood${i}@${MARK}`, password: PASSWORD,
                recovery_phrase: RECOVERY, accept_terms: true } });
    lastStatus = r.status;
    if (r.status === 429) { sawLimit = true; break; }
  }
  check('the register budget is enforced (429 within 7 attempts)', sawLimit, `last status ${lastStatus}`);
  clearRateLimit('register');

  console.log('\nCleaning up fixtures…');
  cleanup();

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? 'API JOURNEY FAILED' : 'API JOURNEY PASSED');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('\nSuite crashed:', e.message);
  cleanup();
  process.exit(1);
});
