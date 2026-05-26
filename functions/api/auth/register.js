import { hashSecret, json } from '../_helpers.js';

export async function onRequestPost({ request, env }) {
  try {
    const { name, email, password, recovery_phrase } = await request.json();

    if (!name || !email || !password || !recovery_phrase) {
      return json({ error: 'Name, email, password, and recovery phrase are required.' }, 400);
    }

    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters.' }, 400);
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return json({ error: 'Email already registered.' }, 409);
    }

    const hashedPw = await hashSecret(password);
    const hashedRecovery = await hashSecret(recovery_phrase);

    const result = await env.DB.prepare(
      'INSERT INTO users (name, email, password, recovery_phrase) VALUES (?, ?, ?, ?)'
    ).bind(name, email, hashedPw, hashedRecovery).run();

    const userId = result.meta.last_row_id;
    const token = crypto.randomUUID();

    await env.DB.prepare(
      'INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, datetime("now", "+7 days"))'
    ).bind(userId, token).run();

    return json({
      token,
      user: { id: userId, name, email, ib_status: 'pending', mt5_accounts: [] }
    }, 201);
  } catch (e) {
    return json({ error: 'Registration failed. Please try again.' }, 500);
  }
}
