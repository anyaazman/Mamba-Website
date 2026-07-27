#!/usr/bin/env node
/*
 * Valetax snapshot import + reconciliation, end to end against a real Worker.
 *
 * Run:  npx wrangler pages dev . --port 8789 --local     (in another shell)
 *       node tests/valetax-reconcile.spec.js  [baseUrl]
 *
 * Seeds the LOCAL D1 itself (schema + fixtures + a known admin key) via
 * `wrangler d1 execute --local`, so the suite is one command and never touches
 * the remote database. Every row it writes is namespaced with a marker email
 * domain and deleted on the way in, so repeat runs are idempotent and it cannot
 * disturb whatever else is in the local DB.
 *
 * Covers: auth on all three endpoints, every documented rejection path, the
 * real tools/valetax-sync payload shape, batching past the D1 chunk size, the
 * four reconciliation buckets, case-insensitive email matching, and a
 * regression pass over the pre-existing admin endpoints.
 */
'use strict';

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:8789';
const ROOT = path.resolve(__dirname, '..');
const DB = 'mamba-db';

const ADMIN_KEY = 'test-valetax-admin-key';
const KEY_HASH = crypto.createHash('sha256').update(ADMIN_KEY).digest('hex');
const MARK = 'valetaxspec.test';        // every fixture email ends with this

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n' + t); }

function sql(command) {
  return execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--local', '--command', command],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function sqlFile(file) {
  return execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--local', '--file', file],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function api(method, route, { key, body, raw } = {}) {
  const headers = {};
  if (key) headers['X-Admin-Key'] = key;
  // GET/HEAD cannot carry a body; callers pass one uniformly so the auth loop
  // can hit every route the same way.
  const sendsBody = method !== 'GET' && method !== 'HEAD';
  if (sendsBody && (body !== undefined || raw !== undefined)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(BASE + route, {
    method,
    headers,
    body: !sendsBody ? undefined
      : raw !== undefined ? raw
      : body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON */ }
  return { status: res.status, data };
}

// ---- fixtures -------------------------------------------------------------
// matched      : ib_email present in the snapshot (deliberately UPPERCASE in the
//                snapshot to prove matching is case-insensitive)
// claimed      : ib_email absent from the snapshot
// noclaim      : never requested IB, so out of scope for every bucket
const U_MATCHED = `matched@${MARK}`;
const U_CLAIMED = `claimed@${MARK}`;
const U_NOCLAIM = `noclaim@${MARK}`;
const IB_MATCHED = `ib-matched@${MARK}`;
const IB_CLAIMED = `ib-claimed@${MARK}`;
const ORPHAN     = `orphan@${MARK}`;      // in Valetax, no Mamba account

const ACC_IN_VALETAX  = '5550001';        // appears in the snapshot's trading
const ACC_NOT_VALETAX = '5550002';        // does not

function seed() {
  // Schema first — safe to re-run, every statement is IF NOT EXISTS.
  sqlFile('migrations/0001_init.sql');
  for (const m of ['0003_add_events.sql', '0011_add_valetax_snapshot.sql']) {
    try { sqlFile('migrations/' + m); } catch (e) { /* already applied */ }
  }
  // Columns added by later ALTERs; ignore "duplicate column" on re-run.
  for (const c of ["ALTER TABLE users ADD COLUMN ib_email TEXT DEFAULT ''",
                   "ALTER TABLE users ADD COLUMN ib_type TEXT DEFAULT ''"]) {
    try { sql(c); } catch (e) { /* present already */ }
  }

  // Clear only this suite's rows.
  sql(`DELETE FROM mt5_accounts WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%${MARK}')`);
  sql(`DELETE FROM users WHERE email LIKE '%${MARK}'`);
  sql('DELETE FROM valetax_accounts');
  sql('DELETE FROM valetax_clients');
  sql('DELETE FROM valetax_snapshots');
  sql(`DELETE FROM admin_keys WHERE key_hash = '${KEY_HASH}'`);

  sql(`INSERT INTO admin_keys (key_hash, label) VALUES ('${KEY_HASH}', 'valetax-spec')`);
  sql(`INSERT INTO users (name, email, password, recovery_phrase, ib_email, ib_status) VALUES
        ('Matched User', '${U_MATCHED}', 'x', 'y', '${IB_MATCHED}', 'approved'),
        ('Claimed User', '${U_CLAIMED}', 'x', 'y', '${IB_CLAIMED}', 'pending'),
        ('No Claim',     '${U_NOCLAIM}', 'x', 'y', '', 'pending')`);
  sql(`INSERT INTO mt5_accounts (user_id, account_number, status)
        SELECT id, '${ACC_IN_VALETAX}', 'approved' FROM users WHERE email = '${U_MATCHED}'`);
  sql(`INSERT INTO mt5_accounts (user_id, account_number, status)
        SELECT id, '${ACC_NOT_VALETAX}', 'pending' FROM users WHERE email = '${U_CLAIMED}'`);
}

function cleanup() {
  try {
    sql(`DELETE FROM mt5_accounts WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%${MARK}')`);
    sql(`DELETE FROM users WHERE email LIKE '%${MARK}'`);
    sql('DELETE FROM valetax_accounts');
    sql('DELETE FROM valetax_clients');
    sql('DELETE FROM valetax_snapshots');
    sql(`DELETE FROM admin_keys WHERE key_hash = '${KEY_HASH}'`);
  } catch (e) { console.log('  (cleanup warning: ' + e.message.slice(0, 80) + ')'); }
}

// Mirrors the real tools/valetax-sync output shape.
const SNAPSHOT = {
  pulledAt: '2026-07-27T02:00:00.000Z',
  count: 3,
  clients: [
    { userId: 'v-1', userEmail: IB_MATCHED.toUpperCase(), userName: 'Matched User',
      registeredAt: '2026-05-01', hasChildren: false,
      trading: [{ login: ACC_IN_VALETAX, balance: 100 }] },
    { userId: 'v-2', userEmail: ORPHAN, userName: 'Orphan Client',
      registeredAt: '2026-06-01', hasChildren: true, trading: [{ login: '5559999' }] },
    { userId: 'v-3', userEmail: `dormant@${MARK}`, userName: 'Dormant Client',
      registeredAt: '2026-06-15', hasChildren: false, trading: null }
  ]
};

(async () => {
  console.log(`Valetax reconciliation suite -> ${BASE}\n`);

  try {
    await fetch(BASE + '/api/admin/status', { headers: { 'X-Admin-Key': 'probe' } });
  } catch (e) {
    console.error(`Cannot reach ${BASE}. Start it with:\n  npx wrangler pages dev . --port 8789 --local\n`);
    process.exit(1);
  }

  console.log('Seeding local D1…');
  seed();

  // ---- auth ----
  section('[1] every endpoint rejects a missing/bad admin key');
  for (const [m, r] of [['GET', '/api/admin/valetax/status'],
                        ['GET', '/api/admin/valetax/reconcile'],
                        ['POST', '/api/admin/valetax/import']]) {
    const noKey = await api(m, r, { body: {} });
    check(`${m} ${r} without key -> 403`, noKey.status === 403, noKey.status);
    const badKey = await api(m, r, { key: 'wrong-key', body: {} });
    check(`${m} ${r} with wrong key -> 403`, badKey.status === 403, badKey.status);
  }

  // ---- empty state ----
  section('[2] before any import');
  const s0 = await api('GET', '/api/admin/valetax/status', { key: ADMIN_KEY });
  check('status -> 200', s0.status === 200, s0.status);
  check('status reports no snapshot', s0.data && s0.data.hasSnapshot === false, JSON.stringify(s0.data));
  const r0 = await api('GET', '/api/admin/valetax/reconcile', { key: ADMIN_KEY });
  check('reconcile -> 200 (not an error)', r0.status === 200, r0.status);
  check('reconcile reports no snapshot', r0.data && r0.data.hasSnapshot === false, JSON.stringify(r0.data));
  check('reconcile explains what to do', !!(r0.data && r0.data.message), JSON.stringify(r0.data));

  // ---- import rejections ----
  section('[3] import rejects bad payloads');
  const bad = [
    ['malformed JSON', { raw: '{not json' }, 400],
    ['missing clients array', { body: { pulledAt: 'x' } }, 400],
    ['clients not an array', { body: { clients: 'nope' } }, 400],
    ['empty clients array', { body: { clients: [] } }, 400],
    ['no readable emails', { body: { clients: [{ userId: 'a' }, { userId: 'b' }] } }, 422]
  ];
  for (const [label, payload, want] of bad) {
    const res = await api('POST', '/api/admin/valetax/import', { key: ADMIN_KEY, ...payload });
    check(`${label} -> ${want}`, res.status === want, `${res.status} ${JSON.stringify(res.data)}`);
    check(`${label} returns an error message`, !!(res.data && res.data.error), JSON.stringify(res.data));
  }
  const tooMany = await api('POST', '/api/admin/valetax/import', {
    key: ADMIN_KEY,
    body: { clients: Array.from({ length: 5001 }, (_, i) => ({ userId: String(i), userEmail: `x${i}@t.co` })) }
  });
  check('over the 5000-client cap -> 413', tooMany.status === 413, tooMany.status);

  // An empty pull must not wipe a good snapshot.
  section('[4] a rejected import leaves existing state untouched');
  const good = await api('POST', '/api/admin/valetax/import', { key: ADMIN_KEY, body: SNAPSHOT });
  check('valid import -> 201', good.status === 201, `${good.status} ${JSON.stringify(good.data)}`);
  const beforeId = good.data && good.data.snapshotId;
  await api('POST', '/api/admin/valetax/import', { key: ADMIN_KEY, body: { clients: [] } });
  const stillThere = await api('GET', '/api/admin/valetax/status', { key: ADMIN_KEY });
  check('snapshot survives a rejected empty import',
    stillThere.data && stillThere.data.hasSnapshot === true && stillThere.data.snapshotId === beforeId,
    JSON.stringify(stillThere.data));

  // ---- import correctness ----
  section('[5] import parses the real sync.js payload shape');
  check('3 clients imported', good.data.clientsImported === 3, good.data.clientsImported);
  check('3 had a readable email', good.data.clientsWithEmail === 3, good.data.clientsWithEmail);
  check('2 MT5 logins extracted', good.data.mt5AccountsImported === 2, good.data.mt5AccountsImported);
  check('1 sub-IB flagged as not recursed', good.data.subIbsNotRecursed === 1, good.data.subIbsNotRecursed);
  check('pulledAt round-trips', good.data.pulledAt === SNAPSHOT.pulledAt, good.data.pulledAt);

  section('[6] status reflects the import');
  const s1 = await api('GET', '/api/admin/valetax/status', { key: ADMIN_KEY });
  check('hasSnapshot true', s1.data.hasSnapshot === true, JSON.stringify(s1.data));
  check('clientCount 3', s1.data.clientCount === 3, s1.data.clientCount);
  check('ageHours is a number', typeof s1.data.ageHours === 'number', s1.data.ageHours);

  // ---- reconciliation ----
  section('[7] reconciliation buckets');
  const rec = await api('GET', '/api/admin/valetax/reconcile', { key: ADMIN_KEY });
  check('reconcile -> 200', rec.status === 200, rec.status);
  const d = rec.data || {};
  const emails = b => (d[b] || []).map(r => (r.email || r.ib_email || '').toLowerCase());

  check('matched contains the matching user',
    emails('matched').includes(U_MATCHED), JSON.stringify(emails('matched')));
  check('matched is case-insensitive (snapshot email was UPPERCASE)',
    d.counts && d.counts.matched === 1, JSON.stringify(d.counts));

  check('claimedNotInValetax contains the unmatched claimer',
    (d.claimedNotInValetax || []).some(r => r.email === U_CLAIMED),
    JSON.stringify(d.claimedNotInValetax));
  check('claimedNotInValetax excludes the matched user',
    !(d.claimedNotInValetax || []).some(r => r.email === U_MATCHED), '');
  check('users who never requested IB are in no bucket',
    !JSON.stringify(d).includes(U_NOCLAIM), 'noclaim leaked into a bucket');

  check('inValetaxNotOnMamba contains the orphan',
    (d.inValetaxNotOnMamba || []).some(r => (r.email || '').toLowerCase() === ORPHAN),
    JSON.stringify(d.inValetaxNotOnMamba));
  check('inValetaxNotOnMamba excludes the matched client',
    !(d.inValetaxNotOnMamba || []).some(r => (r.email || '').toLowerCase() === IB_MATCHED.toLowerCase()), '');

  check('accountsNotInValetax contains the missing account',
    (d.accountsNotInValetax || []).some(r => r.account_number === ACC_NOT_VALETAX),
    JSON.stringify(d.accountsNotInValetax));
  check('accountsNotInValetax excludes the present account',
    !(d.accountsNotInValetax || []).some(r => r.account_number === ACC_IN_VALETAX), '');

  check('subIbsNotRecursed surfaced in counts', d.counts.subIbsNotRecursed === 1, d.counts.subIbsNotRecursed);
  check('counts agree with array lengths',
    d.counts.matched === d.matched.length &&
    d.counts.claimedNotInValetax === d.claimedNotInValetax.length &&
    d.counts.inValetaxNotOnMamba === d.inValetaxNotOnMamba.length &&
    d.counts.accountsNotInValetax === d.accountsNotInValetax.length,
    JSON.stringify(d.counts));

  // ---- batching ----
  section('[8] batching past the D1 chunk size');
  const many = {
    pulledAt: '2026-07-27T03:00:00.000Z',
    clients: Array.from({ length: 120 }, (_, i) => ({
      userId: `b-${i}`, userEmail: `bulk${i}@${MARK}`, userName: `Bulk ${i}`,
      trading: [{ login: String(6000000 + i) }]
    }))
  };
  const bulk = await api('POST', '/api/admin/valetax/import', { key: ADMIN_KEY, body: many });
  check('120-client import -> 201', bulk.status === 201, `${bulk.status} ${JSON.stringify(bulk.data)}`);
  check('all 120 clients stored', bulk.data.clientsImported === 120, bulk.data.clientsImported);
  check('all 120 logins stored', bulk.data.mt5AccountsImported === 120, bulk.data.mt5AccountsImported);
  const recBulk = await api('GET', '/api/admin/valetax/reconcile', { key: ADMIN_KEY });
  check('reconcile still works at 120 clients', recBulk.status === 200, recBulk.status);
  check('newest snapshot is the one reconciled',
    recBulk.data.snapshot && recBulk.data.snapshot.clientCount === 120,
    JSON.stringify(recBulk.data.snapshot));

  // ---- regression ----
  section('[9] pre-existing admin endpoints still work');
  const st = await api('GET', '/api/admin/status', { key: ADMIN_KEY });
  check('/api/admin/status -> 200 valid', st.status === 200 && st.data && st.data.valid === true,
    `${st.status} ${JSON.stringify(st.data)}`);
  const users = await api('GET', '/api/admin/users', { key: ADMIN_KEY });
  check('/api/admin/users -> 200', users.status === 200, users.status);
  check('/api/admin/users returns an array', Array.isArray(users.data && users.data.users),
    JSON.stringify(users.data).slice(0, 120));
  check('users carry their mt5_accounts',
    (users.data.users || []).every(u => Array.isArray(u.mt5_accounts)), '');
  const events = await api('GET', '/api/admin/events', { key: ADMIN_KEY });
  check('/api/admin/events -> 200', events.status === 200, events.status);
  check('/api/admin/events returns an array', Array.isArray(events.data && events.data.events),
    JSON.stringify(events.data).slice(0, 120));

  section('[10] removed spike endpoints are gone');
  for (const r of ['/api/admin/valetax/captcha', '/api/admin/valetax/login']) {
    const res = await api(r === '/api/admin/valetax/login' ? 'POST' : 'GET', r, { key: ADMIN_KEY, body: {} });
    check(`${r} no longer routes (404/405)`, res.status === 404 || res.status === 405, res.status);
  }

  console.log('\nCleaning up fixtures…');
  cleanup();

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? 'VALETAX RECONCILIATION FAILED' : 'VALETAX RECONCILIATION PASSED');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('\nSuite crashed:', e.message);
  cleanup();
  process.exit(1);
});
