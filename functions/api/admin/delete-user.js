import { verifyAdminKey, json, syncBackendWhitelist } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return json({ error: 'user_id is required.' }, 400);
    }

    const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(user_id).first();
    if (!user) {
      return json({ error: 'User not found.' }, 404);
    }

    // Remove this user's MT5 accounts from the backend whitelist before we drop
    // the D1 rows. Best-effort so backend availability never blocks deletion.
    const accounts = await env.DB.prepare(
      'SELECT account_number FROM mt5_accounts WHERE user_id = ?'
    ).bind(user_id).all();
    for (const acc of accounts.results) {
      context.waitUntil(syncBackendWhitelist(env, 'remove', acc.account_number));
    }

    await env.DB.prepare('DELETE FROM tokens WHERE user_id = ?').bind(user_id).run();
    await env.DB.prepare('DELETE FROM mt5_accounts WHERE user_id = ?').bind(user_id).run();
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user_id).run();

    return json({ success: true, message: 'User deleted.' });
  } catch (e) {
    console.error('Admin delete user error:', e.message, e.stack);
    return json({ error: 'Failed to delete user. Please try again.' }, 500);
  }
}
