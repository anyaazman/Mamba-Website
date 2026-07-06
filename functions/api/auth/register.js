import { hashSecret, hashToken, json, recordEvent, notifyAdmin, rateLimit, isValidEmail } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!(await rateLimit(env, 'register', request, 5, 3600))) {
      return json({ error: 'Too many registrations from this connection. Please try again later.' }, 429);
    }

    const { name, email, password, recovery_phrase } = await request.json();

    if (!name || !email || !password || !recovery_phrase) {
      return json({ error: 'Name, email, password, and recovery phrase are required.' }, 400);
    }
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      return json({ error: 'Name must be between 1 and 100 characters.' }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return json({ error: 'Password must be between 8 and 128 characters.' }, 400);
    }
    if (typeof recovery_phrase !== 'string' || recovery_phrase.trim().length < 8 || recovery_phrase.length > 200) {
      return json({ error: 'Recovery phrase must be between 8 and 200 characters.' }, 400);
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return json({ error: 'Email already registered.' }, 409);
    }

    const hashedPw = await hashSecret(password);
    const hashedRecovery = await hashSecret(recovery_phrase.trim());

    const result = await env.DB.prepare(
      'INSERT INTO users (name, email, password, recovery_phrase) VALUES (?, ?, ?, ?)'
    ).bind(name.trim(), email, hashedPw, hashedRecovery).run();

    const userId = result.meta.last_row_id;
    const token = crypto.randomUUID();

    await env.DB.prepare(
      'INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, datetime("now", "+7 days"))'
    ).bind(userId, await hashToken(token)).run();

    await recordEvent(env, 'register', { user_id: userId });
    // Fire-and-forget so the Telegram round trip doesn't delay the response
    context.waitUntil(notifyAdmin(env, '🆕 New Registration', { Name: name.trim(), Email: email }));

    return json({
      token,
      user: { id: userId, name: name.trim(), email, ib_status: 'pending', mt5_accounts: [] }
    }, 201);
  } catch (e) {
    console.error('Register error:', e.message, e.stack);
    return json({ error: 'Registration failed. Please try again.' }, 500);
  }
}
