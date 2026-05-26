import { verifySecret, json } from '../_helpers.js';

export async function onRequestPost({ request, env }) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return json({ error: 'Email and password are required.' }, 400);
    }

    const user = await env.DB.prepare(
      'SELECT id, name, email, password, ib_status, ib_email FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return json({ error: 'Invalid email or password.' }, 401);
    }

    const valid = await verifySecret(password, user.password);
    if (!valid) {
      return json({ error: 'Invalid email or password.' }, 401);
    }

    const token = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, datetime("now", "+7 days"))'
    ).bind(user.id, token).run();

    const accounts = await env.DB.prepare(
      'SELECT id, account_number, status, created_at FROM mt5_accounts WHERE user_id = ? ORDER BY created_at ASC'
    ).bind(user.id).all();

    return json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        ib_status: user.ib_status, ib_email: user.ib_email, mt5_accounts: accounts.results
      }
    });
  } catch (e) {
    return json({ error: 'Login failed. Please try again.' }, 500);
  }
}
