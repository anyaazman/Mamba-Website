import { authenticateUser, json, recordEvent } from '../_helpers.js';

export async function onRequestPost({ request, env }) {
  const user = await authenticateUser(request, env);
  if (!user) return json({ error: 'Not authenticated.' }, 401);

  try {
    const { account_number } = await request.json();

    if (!account_number || !account_number.trim()) {
      return json({ error: 'Account number is required.' }, 400);
    }

    const existing = await env.DB.prepare(
      'SELECT id FROM mt5_accounts WHERE user_id = ? AND account_number = ?'
    ).bind(user.id, account_number.trim()).first();

    if (existing) {
      return json({ error: 'This MT5 account is already added.' }, 409);
    }

    const result = await env.DB.prepare(
      'INSERT INTO mt5_accounts (user_id, account_number) VALUES (?, ?)'
    ).bind(user.id, account_number.trim()).run();

    recordEvent(env, 'mt5_added', { user_id: user.id, metadata: { account_number: account_number.trim() } });

    return json({
      success: true,
      account: { id: result.meta.last_row_id, account_number: account_number.trim(), status: 'pending' }
    }, 201);
  } catch (e) {
    console.error('Add MT5 error:', e.message, e.stack);
    return json({ error: 'Failed to add account. Please try again.' }, 500);
  }
}
