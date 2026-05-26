import { hashSecret, verifySecret, json } from '../_helpers.js';

export async function onRequestPost({ request, env }) {
  try {
    const { email, recovery_phrase, new_password } = await request.json();

    if (!email || !recovery_phrase || !new_password) {
      return json({ error: 'Email, recovery phrase, and new password are required.' }, 400);
    }

    if (new_password.length < 6) {
      return json({ error: 'New password must be at least 6 characters.' }, 400);
    }

    const user = await env.DB.prepare(
      'SELECT id, recovery_phrase FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return json({ error: 'Invalid email or recovery phrase.' }, 401);
    }

    const valid = await verifySecret(recovery_phrase, user.recovery_phrase);
    if (!valid) {
      return json({ error: 'Invalid email or recovery phrase.' }, 401);
    }

    const hashedPw = await hashSecret(new_password);
    await env.DB.prepare(
      "UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(hashedPw, user.id).run();

    // Invalidate all existing tokens for this user (force re-login)
    await env.DB.prepare('DELETE FROM tokens WHERE user_id = ?').bind(user.id).run();

    return json({ success: true, message: 'Password has been reset. Please log in with your new password.' });
  } catch (e) {
    return json({ error: 'Password reset failed. Please try again.' }, 500);
  }
}
