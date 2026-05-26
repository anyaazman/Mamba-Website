import { authenticateUser, json } from '../_helpers.js';

export async function onRequestPut({ request, env }) {
  const user = await authenticateUser(request, env);
  if (!user) return json({ error: 'Not authenticated.' }, 401);

  try {
    const { name } = await request.json();

    if (!name) {
      return json({ error: 'Name is required.' }, 400);
    }

    await env.DB.prepare(
      "UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(name, user.id).run();

    return json({ success: true, message: 'Profile updated.' });
  } catch (e) {
    return json({ error: 'Update failed. Please try again.' }, 500);
  }
}
