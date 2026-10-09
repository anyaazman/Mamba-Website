#!/usr/bin/env node
// Real handlers and in-memory SQLite only. Never sends notifications or writes live data.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const load = name => import(pathToFileURL(path.join(root, 'functions/api', name + '.js')));

function fixture(schema) {
  const db = new DatabaseSync(':memory:');
  for (const name of schema) db.exec(fs.readFileSync(path.join(root, 'migrations', name), 'utf8'));
  const DB = { prepare(sql) {
    let params = [];
    return {
      bind(...values) { params = values; return this; },
      async first() { return db.prepare(sql).get(...params) || null; },
      async run() { return { success: true, meta: db.prepare(sql).run(...params) }; }
    };
  } };
  const pending = [];
  return { db, DB, pending, async submit(name, body) {
    const handler = await load(name);
    return handler.onRequestPost({
      request: new Request('https://unit.invalid/api/' + name, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      }), env: { DB }, waitUntil(promise) { pending.push(promise); }
    });
  } };
}
const contact = { email: 'client@example.invalid', message: 'Please help with my account.' };
const deletion = { email: 'client@example.invalid', mt5_account: '123456', reason: 'No longer used', confirm: true };
const base = ['0001_init.sql', '0003_add_events.sql', '0005_add_contact_and_rate_limits.sql'];

for (const [name, body] of [['contact', contact], ['request-deletion', deletion]]) {
  test(name + ' fails without storage and does not schedule a success notification', async () => {
    const f = fixture([]);
    try {
      const response = await f.submit(name, body);
      assert.equal(response.status, 500);
      assert.equal((await response.json()).success, undefined);
      assert.equal(f.pending.length, 0);
    } finally { f.db.close(); }
  });
}
test('deletion fails when the installed schema rejects its event type', async () => {
  const f = fixture(base);
  try {
    assert.equal((await f.submit('request-deletion', deletion)).status, 500);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM events').get().n, 0);
    assert.equal(f.pending.length, 0);
  } finally { f.db.close(); }
});
test('contact and deletion succeed only with durable rows', async () => {
  const f = fixture([...base, '0014_add_whitelist_divergence_events.sql']);
  try {
    assert.equal((await f.submit('contact', contact)).status, 201);
    assert.equal(f.db.prepare('SELECT message FROM contacts').get().message, contact.message);
    assert.equal((await f.submit('request-deletion', deletion)).status, 201);
    const event = f.db.prepare("SELECT metadata FROM events WHERE type='account_deletion_request'").get();
    assert.deepEqual(JSON.parse(event.metadata), { email: deletion.email, mt5_account: deletion.mt5_account, reason: deletion.reason });
    assert.equal(f.pending.length, 2);
    await Promise.all(f.pending);
  } finally { f.db.close(); }
});
test('optional telemetry failures remain non-blocking', async () => {
  const f = fixture([]);
  try { await assert.doesNotReject((await load('_helpers')).recordEvent({ DB: f.DB }, 'login')); }
  finally { f.db.close(); }
});
