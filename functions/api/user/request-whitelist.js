import { authenticateUser, json, recordEvent, notifyAdmin, syncBackendWhitelist } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await authenticateUser(request, env);
  if (!user) return json({ error: 'Not authenticated.' }, 401);

  try {
    const { account_id } = await request.json();

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

    // Auto-whitelist in the trading backend. Fails open: if the backend is
    // unreachable we keep the old 'pending' flow and alert the admin so the
    // manual approval path still works.
    const sync = await syncBackendWhitelist(
      env, 'add', account.account_number, `auto: client request user#${user.id}`
    );

    if (sync.ok) {
      await env.DB.prepare(
        "UPDATE mt5_accounts SET status = 'approved' WHERE id = ?"
      ).bind(account_id).run();

      await recordEvent(env, 'whitelist_synced', { user_id: user.id, metadata: { account_id, account_number: account.account_number } });
      context.waitUntil(notifyAdmin(env, '✅ MT5 Whitelisted (auto)', { Name: user.name, Email: user.email, 'Account': String(account.account_number) }));

      return json({ success: true, message: 'MT5 account whitelisted.' });
    }

    // Backend sync failed / not configured — preserve the existing manual flow.
    await env.DB.prepare(
      "UPDATE mt5_accounts SET status = 'pending' WHERE id = ?"
    ).bind(account_id).run();

    await recordEvent(env, 'whitelist_request', { user_id: user.id, metadata: { account_id } });
    context.waitUntil(notifyAdmin(env, '⚠️ MT5 Whitelist — backend sync failed, approve manually', { Name: user.name, Email: user.email, 'Account': String(account.account_number) }));

    return json({ success: true, message: 'Whitelist request submitted.' });
  } catch (e) {
    console.error('Request whitelist error:', e.message, e.stack);
    return json({ error: 'Request failed. Please try again.' }, 500);
  }
}
