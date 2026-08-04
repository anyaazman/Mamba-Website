#!/usr/bin/env node
/*
 * The admin Valetax tab, driven through a real browser.
 *
 * Run:  npx wrangler pages dev . --port 8789 --local     (in another shell)
 *       node tests/valetax-admin-ui.spec.js  [baseUrl]
 *
 * valetax-reconcile.spec.js covers the endpoints; nothing covered the tab that
 * calls them, so the import flow, the bucket tabs and the error notes could all
 * break without a test noticing. This drives admin.html end to end: unlock,
 * switch to the tab, import a snapshot, read every bucket, and push both
 * rejection paths through the UI.
 *
 * Seeds the LOCAL D1 itself via `wrangler d1 execute --local`, the same way the
 * endpoint suite does. Every fixture row is namespaced with a marker email
 * domain and deleted on the way in and out, so repeat runs are idempotent and
 * the remote database is never touched.
 */
'use strict';

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = process.argv[2] || 'http://localhost:8789';
const ROOT = path.resolve(__dirname, '..');
const DB = 'mamba-db';
const ADMIN_KEY = 'test-valetax-ui-key';
const KEY_HASH = crypto.createHash('sha256').update(ADMIN_KEY).digest('hex');
const MARK = 'valetaxui.test';

function loadPlaywright() {
  const candidates = [
    'playwright',
    '/Users/anyaazman/Development/Mamba-Website/tools/valetax-sync/node_modules/playwright',
    path.resolve(ROOT, 'tools/valetax-sync/node_modules/playwright'),
    path.resolve(ROOT, 'node_modules/playwright'),
  ];
  for (const c of candidates) { try { return require(c); } catch (e) {} }
  console.error('Playwright not found.'); process.exit(1);
}
const { chromium } = loadPlaywright();

let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (d !== undefined ? '  -> ' + d : '')); } };
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

const U_MATCHED = `ui-matched@${MARK}`;
const U_CLAIMED = `ui-claimed@${MARK}`;
const IB_MATCHED = `ui-ib-matched@${MARK}`;
const IB_CLAIMED = `ui-ib-claimed@${MARK}`;
const ORPHAN = `ui-orphan@${MARK}`;

function seed() {
  // Schema first, so the suite works against a fresh local D1. Every statement
  // in 0001/0003/0011 is IF NOT EXISTS; 0012 is an ALTER that throws
  // "duplicate column" once applied, which is the expected steady state.
  sqlFile('migrations/0001_init.sql');
  for (const m of ['0003_add_events.sql', '0011_add_valetax_snapshot.sql',
                   '0012_add_valetax_snapshot_completion.sql']) {
    try { sqlFile('migrations/' + m); } catch (e) { /* already applied */ }
  }
  for (const c of ["ALTER TABLE users ADD COLUMN ib_email TEXT DEFAULT ''",
                   "ALTER TABLE users ADD COLUMN ib_type TEXT DEFAULT ''"]) {
    try { sql(c); } catch (e) { /* present already */ }
  }

  sql(`DELETE FROM mt5_accounts WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%${MARK}')`);
  sql(`DELETE FROM users WHERE email LIKE '%${MARK}'`);
  sql('DELETE FROM valetax_accounts'); sql('DELETE FROM valetax_clients'); sql('DELETE FROM valetax_snapshots');
  sql(`DELETE FROM admin_keys WHERE key_hash = '${KEY_HASH}'`);
  sql(`INSERT INTO admin_keys (key_hash, label) VALUES ('${KEY_HASH}', 'valetax-ui-spec')`);
  sql(`INSERT INTO users (name, email, password, recovery_phrase, ib_email, ib_status) VALUES
        ('UI Matched', '${U_MATCHED}', 'x', 'y', '${IB_MATCHED}', 'approved'),
        ('UI Claimed', '${U_CLAIMED}', 'x', 'y', '${IB_CLAIMED}', 'pending')`);
  sql(`INSERT INTO mt5_accounts (user_id, account_number, status)
        SELECT id, '7770001', 'approved' FROM users WHERE email = '${U_MATCHED}'`);
  sql(`INSERT INTO mt5_accounts (user_id, account_number, status)
        SELECT id, '7770002', 'pending' FROM users WHERE email = '${U_CLAIMED}'`);
}

function cleanup() {
  try {
    sql(`DELETE FROM mt5_accounts WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%${MARK}')`);
    sql(`DELETE FROM users WHERE email LIKE '%${MARK}'`);
    sql('DELETE FROM valetax_accounts'); sql('DELETE FROM valetax_clients'); sql('DELETE FROM valetax_snapshots');
    sql(`DELETE FROM admin_keys WHERE key_hash = '${KEY_HASH}'`);
  } catch (e) { console.log('  (cleanup warning: ' + e.message + ')'); }
}

// A snapshot in the shape tools/valetax-sync writes.
const snapshot = {
  pulledAt: new Date().toISOString(),
  count: 3,
  clients: [
    { userId: '901', userEmail: IB_MATCHED.toUpperCase(), userName: 'UI Matched', registeredAt: '2026-01-05',
      hasChildren: false, trading: [{ login: '7770001' }] },
    { userId: '902', userEmail: ORPHAN, userName: 'UI Orphan', registeredAt: '2026-02-06',
      hasChildren: true, trading: [{ login: '7770009' }] },
    { userId: '903', userEmail: `ui-other@${MARK}`, userName: 'UI Other', registeredAt: '2026-03-07',
      hasChildren: false, trading: null }
  ]
};

(async () => {
  console.log('Seeding local D1…');
  seed();

  const tmp = path.join(os.tmpdir(), 'valetax-snapshot-ui.json');
  fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const jsErrors = [], badResponses = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('response', r => { if (r.status() >= 500) badResponses.push(r.status() + ' ' + r.url()); });

  try {
    section('[1] admin login and tab');
    await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
    await page.fill('#keyForm input[name="admin_key"]', ADMIN_KEY);
    await page.click('#keyForm button[type="submit"]');
    await page.waitForSelector('#viewTabs', { state: 'visible', timeout: 10000 });
    check('admin key accepted, dashboard shown', true);

    const valetaxTab = page.locator('#viewTabs .filter-tab[data-view="valetax"]');
    check('Valetax tab exists', await valetaxTab.count() === 1);
    await valetaxTab.click();
    await page.waitForSelector('#valetaxView', { state: 'visible' });
    check('Valetax view visible', await page.locator('#valetaxView').isVisible());

    section('[2] empty state before import');
    await page.waitForFunction(
      () => !/Checking/.test(document.getElementById('valetaxStatusLine').textContent), null, { timeout: 10000 });
    const emptyLine = (await page.locator('#valetaxStatusLine').textContent()).trim();
    check('status line reports no snapshot', /no snapshot/i.test(emptyLine), emptyLine);
    check('report block hidden when no snapshot', await page.locator('#valetaxReport').isHidden());
    check('import button disabled with no file', await page.locator('#valetaxImportBtn').isDisabled());
    check('spike CAPTCHA UI is gone', await page.locator('#valetaxCaptchaBox, #valetaxGetCaptchaBtn, #valetaxDebug').count() === 0);

    section('[3] import a snapshot');
    await page.setInputFiles('#valetaxFile', tmp);
    check('import button enables once a file is chosen', await page.locator('#valetaxImportBtn').isEnabled());
    await page.click('#valetaxImportBtn');
    await page.waitForSelector('#valetaxImportNote:not([hidden])', { timeout: 15000 });
    const note = (await page.locator('#valetaxImportNote').textContent()).trim();
    check('import reports success', /Imported 3 clients/.test(note), note);
    check('success note styled as ok', (await page.locator('#valetaxImportNote').getAttribute('class') || '').includes('is-ok'));

    section('[4] report renders');
    await page.waitForSelector('#valetaxReport:not([hidden])', { timeout: 15000 });
    await page.waitForFunction(
      () => document.querySelectorAll('#valetaxBucketTabs .filter-tab').length === 4, null, { timeout: 10000 });
    check('four bucket tabs render', true);
    const statusAfter = (await page.locator('#valetaxStatusLine').textContent()).trim();
    check('status line shows client count', /3 clients/.test(statusAfter), statusAfter);
    check('status line shows freshness', /ago|unknown time/.test(statusAfter), statusAfter);

    const stats = await page.locator('#valetaxSummary .valetax-stat').count();
    check('four summary stats', stats === 4, stats);

    section('[5] buckets carry the right rows');
    const bodyText = () => page.locator('#valetaxBucketBody').textContent();
    // default bucket = claimedNotInValetax
    let txt = await bodyText();
    check('default bucket lists the unmatched claimer', txt.includes(U_CLAIMED), txt.slice(0, 160));
    check('default bucket excludes the matched user', !txt.includes(U_MATCHED));

    await page.click('#valetaxBucketTabs .filter-tab[data-bucket="accountsNotInValetax"]');
    txt = await bodyText();
    check('MT5 bucket lists the absent account 7770002', txt.includes('7770002'), txt.slice(0, 160));
    check('MT5 bucket excludes the present account 7770001', !txt.includes('7770001'));

    await page.click('#valetaxBucketTabs .filter-tab[data-bucket="inValetaxNotOnMamba"]');
    txt = await bodyText();
    check('orphan bucket lists the Valetax-only client', txt.includes(ORPHAN), txt.slice(0, 160));

    await page.click('#valetaxBucketTabs .filter-tab[data-bucket="matched"]');
    txt = await bodyText();
    check('matched bucket lists the matched user', txt.includes(U_MATCHED), txt.slice(0, 160));
    check('matched bucket matched case-insensitively', txt.includes(IB_MATCHED));

    section('[6] rejection path surfaces in the UI');
    const badFile = path.join(os.tmpdir(), 'valetax-bad.json');
    fs.writeFileSync(badFile, JSON.stringify({ pulledAt: new Date().toISOString(), clients: [] }));
    await page.setInputFiles('#valetaxFile', badFile);
    await page.click('#valetaxImportBtn');
    await page.waitForFunction(
      () => /is-error/.test(document.getElementById('valetaxImportNote').className), null, { timeout: 15000 });
    const errNote = (await page.locator('#valetaxImportNote').textContent()).trim();
    check('empty snapshot rejected with a readable message', /no clients/i.test(errNote), errNote);

    const notJson = path.join(os.tmpdir(), 'valetax-notjson.json');
    fs.writeFileSync(notJson, 'this is not json');
    await page.setInputFiles('#valetaxFile', notJson);
    await page.click('#valetaxImportBtn');
    await page.waitForFunction(
      () => /not valid JSON/.test(document.getElementById('valetaxImportNote').textContent), null, { timeout: 10000 });
    check('non-JSON file caught client-side', true);

    section('[7] good snapshot survives the rejected ones');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#viewTabs', { state: 'visible', timeout: 10000 });
    await page.locator('#viewTabs .filter-tab[data-view="valetax"]').click();
    await page.waitForFunction(
      () => /clients/.test(document.getElementById('valetaxStatusLine').textContent), null, { timeout: 10000 });
    const persisted = (await page.locator('#valetaxStatusLine').textContent()).trim();
    check('previous good snapshot still reported', /3 clients/.test(persisted), persisted);

    section('[8] hygiene');
    check('no uncaught JS errors', jsErrors.length === 0, jsErrors.join(' | '));
    check('no 5xx responses', badResponses.length === 0, badResponses.join(' | '));

  } catch (e) {
    fail++; console.log('  FAIL harness error -> ' + e.message);
  } finally {
    await browser.close();
    console.log('\nCleaning up fixtures…');
    cleanup();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? 'VALETAX ADMIN UI PASSED' : 'VALETAX ADMIN UI FAILED');
  process.exit(fail === 0 ? 0 : 1);
})();
