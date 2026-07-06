import { authenticateUser, json } from '../_helpers.js';

export async function onRequestPut({ request, env }) {
  const user = await authenticateUser(request, env);
  if (!user) return json({ error: 'Not authenticated.' }, 401);

  try {
    const { name } = await request.json();

    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed || trimmed.length > 100) {
      return json({ error: 'Name is required (max 100 characters).' }, 400);
    }

    await env.DB.prepare(
      "UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(trimmed, user.id).run();

    return json({ success: true, message: 'Profile updated.' });
  } catch (e) {
    console.error('Update user error:', e.message, e.stack);
    return json({ error: 'Update failed. Please try again.' }, 500);
  }
}
