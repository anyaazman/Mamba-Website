import { verifyAdminKey, json } from '../../_helpers.js';
import { normaliseClient, storeSnapshot, pruneSnapshots, MAX_CLIENTS } from './_valetax.js';

// POST /api/admin/valetax/import
// Body: the valetax-snapshot.json produced by tools/valetax-sync —
//   { pulledAt: ISO string, count: number, clients: [...] }
//
// Stores the snapshot for reconciliation. This endpoint never contacts Valetax;
// the operator pulls the data themselves with a real browser and a human-solved
// CAPTCHA, then uploads the result here.
export async function onRequestPost({ request, env }) {
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Body must be valid JSON.' }, 400);
  }

  if (!body || typeof body !== 'object') {
    return json({ error: 'Body must be a JSON object.' }, 400);
  }

  const clients = body.clients;
  if (!Array.isArray(clients)) {
    return json({ error: 'Expected a "clients" array — upload valetax-snapshot.json unmodified.' }, 400);
  }
  if (clients.length === 0) {
    return json({ error: 'Snapshot contains no clients. Refusing to replace the current one with an empty pull.' }, 400);
  }
  if (clients.length > MAX_CLIENTS) {
    return json({ error: `Snapshot has ${clients.length} clients, above the ${MAX_CLIENTS} limit. Check this is the right file.` }, 413);
  }

  const normalised = clients.map(normaliseClient);

  // A pull that produced no usable email on any client means the shape changed
  // upstream. Importing it would silently reconcile everything into the "not on
  // Mamba" bucket, which reads as a catastrophe rather than a parse failure.
  const withEmail = normalised.filter(c => c.email_norm !== '').length;
  if (withEmail === 0) {
    return json({
      error: 'No client in this snapshot had a readable email. The Valetax response shape may have changed — not importing.',
      clientsSeen: normalised.length
    }, 422);
  }

  try {
    const snapshotId = await storeSnapshot(env, body.pulledAt, normalised);
    await pruneSnapshots(env);

    const accountCount = normalised.reduce((n, c) => n + c.logins.length, 0);
    return json({
      success: true,
      snapshotId,
      pulledAt: body.pulledAt || null,
      clientsImported: normalised.length,
      clientsWithEmail: withEmail,
      mt5AccountsImported: accountCount,
      subIbsNotRecursed: normalised.filter(c => c.has_children === 1).length
    }, 201);
  } catch (e) {
    console.error('Valetax import error:', e.message);
    return json({ error: 'Could not store the snapshot. ' + e.message }, 500);
  }
}
