import { authenticateUser, json, recordEvent, notifyAdmin } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await authenticateUser(request, env);
  if (!user) return json({ error: 'Not authenticated.' }, 401);

  try {
    const { account_number } = await request.json();

    const num = typeof account_number === 'string' ? account_number.trim() : '';
    if (!num) {
      return json({ error: 'Account number is required.' }, 400);
    }
    if (!/^\d{3,20}$/.test(num)) {
      return json({ error: 'MT5 account number must be 3-20 digits.' }, 400);
    }

    const existing = await env.DB.prepare(
      'SELECT id FROM mt5_accounts WHERE user_id = ? AND account_number = ?'
    ).bind(user.id, num).first();

    if (existing) {
      return json({ error: 'This MT5 account is already added.' }, 409);
    }

    const result = await env.DB.prepare(
      'INSERT INTO mt5_accounts (user_id, account_number) VALUES (?, ?)'
    ).bind(user.id, num).run();

    await recordEvent(env, 'mt5_added', { user_id: user.id, metadata: { account_number: num } });
    context.waitUntil(notifyAdmin(env, '💳 MT5 Account Added', { Name: user.name, Email: user.email, 'Account': num }));

    return json({
      success: true,
      account: { id: result.meta.last_row_id, account_number: num, status: 'pending' }
    }, 201);
  } catch (e) {
    console.error('Add MT5 error:', e.message, e.stack);
    return json({ error: 'Failed to add account. Please try again.' }, 500);
  }
}
