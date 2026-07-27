import { authenticateUser, hasRequestedIB, json, recordEvent, notifyAdmin, readJson } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await authenticateUser(request, env);
  if (!user) return json({ error: 'Not authenticated.' }, 401);

  if (!hasRequestedIB(user)) {
    return json({ error: 'Please request IB verification before adding an MT5 account.' }, 403);
  }

  try {
    const body = await readJson(request);
    if (!body) return json({ error: 'Invalid request body.' }, 400);
    const { account_number } = body;

    const num = typeof account_number === 'string' ? account_number.trim() : '';
    if (!num) {
      return json({ error: 'Account number is required.' }, 400);
    }
    if (!/^\d{3,20}$/.test(num)) {
      return json({ error: 'MT5 account number must be 3-20 digits.' }, 400);
    }

    // Scoped to the current user, this let a different account claim a number
    // someone else had already registered. Whitelist state in the trading
    // backend is keyed on account_number alone, so a squatted row being
    // rejected or deleted could strip the real owner's whitelisting.
    const existing = await env.DB.prepare(
      'SELECT user_id FROM mt5_accounts WHERE account_number = ?'
    ).bind(num).first();

    if (existing) {
      return json({
        error: existing.user_id === user.id
          ? 'This MT5 account is already added.'
          : 'This MT5 account number is already registered. If it belongs to you, contact support.'
      }, 409);
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
