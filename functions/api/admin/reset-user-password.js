import { verifyAdminKey, hashSecret, json } from '../_helpers.js';

export async function onRequestPost({ request, env }) {
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  try {
    const { user_id, new_password } = await request.json();

    if (!user_id || typeof new_password !== 'string' || new_password.length < 8 || new_password.length > 128) {
      return json({ error: 'user_id and new_password (min 8 chars) are required.' }, 400);
    }

    const hashedPw = await hashSecret(new_password);

    await env.DB.prepare(
      "UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(hashedPw, user_id).run();

    await env.DB.prepare('DELETE FROM tokens WHERE user_id = ?').bind(user_id).run();

    return json({ success: true, message: 'User password has been reset.' });
  } catch (e) {
    console.error('Admin reset password error:', e.message, e.stack);
    return json({ error: 'Password reset failed.' }, 500);
  }
}
