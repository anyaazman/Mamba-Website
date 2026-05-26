import { authenticateUser, json } from '../_helpers.js';

export async function onRequestGet({ request, env }) {
  const user = await authenticateUser(request, env);
  if (!user) return json({ error: 'Not authenticated.' }, 401);

  const accounts = await env.DB.prepare(
    'SELECT id, account_number, status, created_at FROM mt5_accounts WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(user.id).all();

  return json({ accounts: accounts.results });
}
