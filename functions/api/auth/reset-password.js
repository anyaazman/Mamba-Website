import { hashSecret, verifySecret, json, recordEvent, rateLimit } from '../_helpers.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!(await rateLimit(env, 'reset', request, 5, 900))) {
      return json({ error: 'Too many reset attempts. Please wait a few minutes and try again.' }, 429);
    }

    const { email, recovery_phrase, new_password } = await request.json();

    if (!email || !recovery_phrase || !new_password) {
      return json({ error: 'Email, recovery phrase, and new password are required.' }, 400);
    }
    if (typeof email !== 'string' || email.length > 254
      || typeof recovery_phrase !== 'string' || recovery_phrase.length > 200) {
      return json({ error: 'Invalid email or recovery phrase.' }, 401);
    }
    if (typeof new_password !== 'string' || new_password.length < 8 || new_password.length > 128) {
      return json({ error: 'New password must be between 8 and 128 characters.' }, 400);
    }

    const user = await env.DB.prepare(
      'SELECT id, recovery_phrase FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return json({ error: 'Invalid email or recovery phrase.' }, 401);
    }

    const valid = await verifySecret(recovery_phrase.trim(), user.recovery_phrase);
    if (!valid) {
      return json({ error: 'Invalid email or recovery phrase.' }, 401);
    }

    const hashedPw = await hashSecret(new_password);
    await env.DB.prepare(
      "UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(hashedPw, user.id).run();

    // Invalidate all existing tokens for this user (force re-login)
    await env.DB.prepare('DELETE FROM tokens WHERE user_id = ?').bind(user.id).run();

    await recordEvent(env, 'password_reset', { user_id: user.id });

    return json({ success: true, message: 'Password has been reset. Please log in with your new password.' });
  } catch (e) {
    console.error('Reset password error:', e.message, e.stack);
    return json({ error: 'Password reset failed. Please try again.' }, 500);
  }
}
