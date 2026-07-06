import { verifySecret, hashToken, json, recordEvent, rateLimit } from '../_helpers.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!(await rateLimit(env, 'login', request, 10, 300))) {
      return json({ error: 'Too many login attempts. Please wait a few minutes and try again.' }, 429);
    }

    const { email, password } = await request.json();

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return json({ error: 'Email and password are required.' }, 400);
    }
    if (email.length > 254 || password.length > 128) {
      return json({ error: 'Invalid email or password.' }, 401);
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
    ).bind(user.id, await hashToken(token)).run();

    // Opportunistic cleanup so the tokens table doesn't grow forever
    await env.DB.prepare("DELETE FROM tokens WHERE expires_at <= datetime('now')").run();

    const accounts = await env.DB.prepare(
      'SELECT id, account_number, status, created_at FROM mt5_accounts WHERE user_id = ? ORDER BY created_at ASC'
    ).bind(user.id).all();

    await recordEvent(env, 'login', { user_id: user.id });

    return json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        ib_status: user.ib_status, ib_email: user.ib_email, mt5_accounts: accounts.results
      }
    });
  } catch (e) {
    console.error('Login error:', e.message, e.stack);
    return json({ error: 'Login failed. Please try again.' }, 500);
  }
}
