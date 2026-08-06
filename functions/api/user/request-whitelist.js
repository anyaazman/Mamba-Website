import { authenticateUser, hasRequestedIB, json, recordEvent, notifyAdmin, syncBackendWhitelist, readJson } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await authenticateUser(request, env);
  if (!user) return json({ error: 'Not authenticated.' }, 401);

  // Must precede the auto-whitelist sync below: without this an ungated caller
  // would be approved straight into the trading backend, not merely queued.
  if (!hasRequestedIB(user)) {
    return json({ error: 'Please request IB verification before requesting whitelist.' }, 403);
  }

  try {
    const body = await readJson(request);
    if (!body) return json({ error: 'Invalid request body.' }, 400);
    const { account_id } = body;

    if (!Number.isInteger(account_id) || account_id <= 0) {
      return json({ error: 'account_id is required.' }, 400);
    }

    const account = await env.DB.prepare(
      'SELECT id, status, account_number FROM mt5_accounts WHERE id = ? AND user_id = ?'
    ).bind(account_id, user.id).first();

    if (!account) {
      return json({ error: 'MT5 account not found.' }, 404);
    }

    if (account.status === 'approved') {
      return json({ error: 'This account is already approved.' }, 400);
    }

    // Auto-whitelist is reserved for users an admin has actually approved.
    //
    // hasRequestedIB() above only proves the user typed *an* email into the IB
    // form; it does not prove anyone checked that email against the Valetax
    // downline. Without this gate, revoking someone was undoable by the client:
    // re-submit the IB form with any address (request-ib.js allows it whenever
    // ib_status is not 'approved'), then request whitelist, and the account was
    // synced straight back into the trading backend inside a minute with no
    // admin in the loop. That is how the revocation of 2026-08-07 could have
    // been reversed by the 37 users it applied to.
    //
    // Unapproved users are not refused — they fall through to the manual path
    // below, which records the request and notifies the admin. Nothing reaches
    // the trading backend until an admin approves it.
    const ibApproved = user.ib_status === 'approved';

    // Fails open: if the backend is unreachable we keep the old 'pending' flow
    // and alert the admin so the manual approval path still works.
    const sync = ibApproved
      ? await syncBackendWhitelist(
          env, 'add', account.account_number, `auto: client request user#${user.id}`
        )
      : { ok: false };

    if (sync.ok) {
      await env.DB.prepare(
        "UPDATE mt5_accounts SET status = 'approved' WHERE id = ?"
      ).bind(account_id).run();

      await recordEvent(env, 'whitelist_synced', { user_id: user.id, metadata: { account_id, account_number: account.account_number } });
      context.waitUntil(notifyAdmin(env, '✅ MT5 Whitelisted (auto)', { Name: user.name, Email: user.email, 'Account': String(account.account_number) }));

      return json({ success: true, message: 'MT5 account whitelisted.' });
    }

    // Backend sync failed / not configured — preserve the existing manual flow.
    // Stamp the request time so the dashboard can tell "added" from
    // "requested"; status is 'pending' in both cases.
    await env.DB.prepare(
      "UPDATE mt5_accounts SET status = 'pending' WHERE id = ?"
    ).bind(account_id).run();

    // Best-effort: the column only exists once migration 0008 has been applied.
    // Naming it in a statement that must succeed is what took production down.
    try {
      await env.DB.prepare(
        "UPDATE mt5_accounts SET whitelist_requested_at = datetime('now') WHERE id = ?"
      ).bind(account_id).run();
    } catch (e) {
      // Pre-migration database — the request is still recorded via status and
      // the whitelist_request event; only the visual "under review" state is
      // unavailable until 0008 runs.
    }

    await recordEvent(env, 'whitelist_request', { user_id: user.id, metadata: { account_id } });

    // Two different reasons land here and the admin needs to tell them apart:
    // an unapproved IB is a decision waiting to be made, a failed sync is an
    // outage to investigate.
    context.waitUntil(ibApproved
      ? notifyAdmin(env, '⚠️ MT5 Whitelist — backend sync failed, approve manually', {
          Name: user.name, Email: user.email, 'Account': String(account.account_number)
        })
      : notifyAdmin(env, '🔒 MT5 Whitelist — IB not approved, review before approving', {
          Name: user.name, Email: user.email, 'Account': String(account.account_number),
          'IB Status': user.ib_status, 'IB Email': user.ib_email || '—'
        }));

    return json({
      success: true,
      message: ibApproved
        ? 'Whitelist request submitted.'
        : 'Whitelist request submitted. It will be activated once your IB verification is approved.'
    });
  } catch (e) {
    console.error('Request whitelist error:', e.message, e.stack);
    return json({ error: 'Request failed. Please try again.' }, 500);
  }
}
