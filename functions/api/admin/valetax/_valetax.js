// Shared helpers for the Valetax IB reconciliation.
//
// BOUNDARY: nothing here talks to Valetax. The downline is pulled by
// tools/valetax-sync, which runs attended on the operator's machine in a real
// browser with a human-solved CAPTCHA, and the resulting snapshot is uploaded
// to /api/admin/valetax/import. No broker credentials and no broker session
// token exist in this Worker.

// D1 caps bound parameters per statement (~100). Every insert below is a fixed
// 7-or-fewer-parameter statement submitted through db.batch(), and the batch
// itself is chunked, so neither the parameter cap nor the statement-count limit
// is approached regardless of downline size.
const BATCH_SIZE = 50;

// An import larger than this is far more likely to be the wrong file than a
// real downline, and rejecting it beats half-writing a snapshot.
export const MAX_CLIENTS = 5000;

export function normaliseEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// Valetax has renamed fields between portal versions, and the POC stores two
// different shapes (parentalTree vs getTrading), so read tolerantly rather than
// binding to one spelling. Returns '' when genuinely absent.
function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

// Pull the MT5 logins out of a client's `trading` payload. The POC stores
// whatever referral.getTrading returned, which may be an array, an object with
// an items/accounts array, or null when the call failed for that client.
function extractLogins(trading) {
  const rows = Array.isArray(trading) ? trading
    : Array.isArray(trading && trading.items) ? trading.items
    : Array.isArray(trading && trading.accounts) ? trading.accounts
    : Array.isArray(trading && trading.result) ? trading.result
    : trading && typeof trading === 'object' ? [trading]
    : [];

  const logins = [];
  for (const row of rows) {
    const login = pick(row, ['login', 'account', 'accountNumber', 'mt5Login', 'number']);
    // MT5 logins are numeric; anything else is a label that got picked up.
    if (login && /^\d{3,20}$/.test(login)) logins.push(login);
  }
  return [...new Set(logins)];
}

// Turn one raw snapshot entry into the rows we store. Exported so the tests can
// pin the parsing contract without needing a live snapshot.
export function normaliseClient(raw) {
  const valetaxUserId = pick(raw, ['userId', 'id', 'clientId']);
  const email = pick(raw, ['userEmail', 'email', 'clientEmail']);
  return {
    valetax_user_id: valetaxUserId,
    email: email,
    email_norm: normaliseEmail(email),
    name: pick(raw, ['userName', 'name', 'fullName']),
    registered_at: pick(raw, ['registeredAt', 'createdAt', 'registrationDate']),
    has_children: raw && (raw.hasChildren === true || raw.hasChildren === 1) ? 1 : 0,
    logins: extractLogins(raw && raw.trading)
  };
}

// Writes a whole snapshot. Returns the new snapshot id.
export async function storeSnapshot(env, pulledAt, clients) {
  const meta = await env.DB.prepare(
    'INSERT INTO valetax_snapshots (pulled_at, client_count) VALUES (?, ?)'
  ).bind(pulledAt || null, clients.length).run();

  const snapshotId = meta.meta.last_row_id;

  const clientStmt = env.DB.prepare(
    `INSERT INTO valetax_clients
       (snapshot_id, valetax_user_id, email, email_norm, name, registered_at, has_children)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const accountStmt = env.DB.prepare(
    'INSERT INTO valetax_accounts (snapshot_id, valetax_user_id, login) VALUES (?, ?, ?)'
  );

  const statements = [];
  for (const c of clients) {
    statements.push(clientStmt.bind(
      snapshotId, c.valetax_user_id, c.email, c.email_norm,
      c.name, c.registered_at, c.has_children
    ));
    for (const login of c.logins) {
      statements.push(accountStmt.bind(snapshotId, c.valetax_user_id, login));
    }
  }

  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    await env.DB.batch(statements.slice(i, i + BATCH_SIZE));
  }

  return snapshotId;
}

export async function getLatestSnapshot(env) {
  return env.DB.prepare(
    'SELECT id, pulled_at, client_count, imported_at FROM valetax_snapshots ORDER BY id DESC LIMIT 1'
  ).first();
}

// Keep the tables from growing without bound. History is useful for comparing a
// suspect import against the last good one; beyond a few there is no reader.
export async function pruneSnapshots(env, keep = 5) {
  await env.DB.prepare(
    `DELETE FROM valetax_snapshots
      WHERE id NOT IN (SELECT id FROM valetax_snapshots ORDER BY id DESC LIMIT ?)`
  ).bind(keep).run();
  // ON DELETE CASCADE is only honoured when foreign keys are enabled, which is
  // not guaranteed on D1, so clear the children explicitly.
  await env.DB.prepare(
    'DELETE FROM valetax_clients WHERE snapshot_id NOT IN (SELECT id FROM valetax_snapshots)'
  ).run();
  await env.DB.prepare(
    'DELETE FROM valetax_accounts WHERE snapshot_id NOT IN (SELECT id FROM valetax_snapshots)'
  ).run();
}

// The reconciliation itself. Runs entirely as SQL joins against one snapshot so
// the row counts stay in the database rather than being pulled into the Worker.
export async function reconcile(env, snapshotId) {
  // A Mamba user "claims" the partner code by submitting an IB request, which
  // is what sets ib_email. Users who never requested are out of scope.
  const matched = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.ib_email, u.ib_status, vc.valetax_user_id, vc.has_children
       FROM users u
       JOIN valetax_clients vc
         ON vc.email_norm = lower(trim(u.ib_email))
      WHERE vc.snapshot_id = ?
        AND trim(coalesce(u.ib_email, '')) != ''
      ORDER BY u.created_at DESC`
  ).bind(snapshotId).all();

  // Requested IB verification, but Valetax shows no such client under our code:
  // either a typo in the email they gave us, or they never actually moved.
  const claimedNotInValetax = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.ib_email, u.ib_status, u.created_at
       FROM users u
      WHERE trim(coalesce(u.ib_email, '')) != ''
        AND NOT EXISTS (
          SELECT 1 FROM valetax_clients vc
           WHERE vc.snapshot_id = ?
             AND vc.email_norm = lower(trim(u.ib_email))
        )
      ORDER BY u.created_at DESC`
  ).bind(snapshotId).all();

  // Under our partner code at Valetax but never signed up on Mamba — earning
  // commission with no app relationship. Checked against both the IB email and
  // the account email, since a client may have registered with either.
  const inValetaxNotOnMamba = await env.DB.prepare(
    `SELECT vc.valetax_user_id, vc.email, vc.name, vc.registered_at, vc.has_children
       FROM valetax_clients vc
      WHERE vc.snapshot_id = ?
        AND vc.email_norm != ''
        AND NOT EXISTS (
          SELECT 1 FROM users u
           WHERE lower(trim(coalesce(u.ib_email, ''))) = vc.email_norm
              OR lower(trim(u.email)) = vc.email_norm
        )
      ORDER BY vc.registered_at DESC`
  ).bind(snapshotId).all();

  // An MT5 account we whitelisted (or were asked to) that Valetax does not show
  // under our code. These are the ones actually worth chasing.
  const accountsNotInValetax = await env.DB.prepare(
    `SELECT m.id, m.account_number, m.status, u.name, u.email
       FROM mt5_accounts m
       JOIN users u ON u.id = m.user_id
      WHERE NOT EXISTS (
          SELECT 1 FROM valetax_accounts va
           WHERE va.snapshot_id = ?
             AND va.login = m.account_number
        )
      ORDER BY m.created_at DESC`
  ).bind(snapshotId).all();

  // Sub-IBs whose own downline the POC does not recurse into, so every count
  // above understates the true book by whatever sits beneath them.
  const subIbs = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM valetax_clients WHERE snapshot_id = ? AND has_children = 1'
  ).bind(snapshotId).first();

  return {
    matched: matched.results,
    claimedNotInValetax: claimedNotInValetax.results,
    inValetaxNotOnMamba: inValetaxNotOnMamba.results,
    accountsNotInValetax: accountsNotInValetax.results,
    subIbCount: subIbs ? subIbs.n : 0
  };
}
