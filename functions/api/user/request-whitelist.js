import { authenticateUser, json, recordEvent, notifyAdmin } from '../_helpers.js';

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
      'SELECT id, status FROM mt5_accounts WHERE id = ? AND user_id = ?'
    ).bind(account_id, user.id).first();

    if (!account) {
      return json({ error: 'MT5 account not found.' }, 404);
    }

    if (account.status === 'approved') {
      return json({ error: 'This account is already approved.' }, 400);
    }

    await env.DB.prepare(
      "UPDATE mt5_accounts SET status = 'pending' WHERE id = ?"
    ).bind(account_id).run();

    await recordEvent(env, 'whitelist_request', { user_id: user.id, metadata: { account_id } });
    context.waitUntil(notifyAdmin(env, '📊 MT5 Whitelist Request', { Name: user.name, Email: user.email, 'Account ID': String(account_id) }));

    return json({ success: true, message: 'Whitelist request submitted.' });
  } catch (e) {
    console.error('Request whitelist error:', e.message, e.stack);
    return json({ error: 'Request failed. Please try again.' }, 500);
  }
}
