import { verifyAdminKey, json } from '../_helpers.js';

export async function onRequestPost({ request, env }) {
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  try {
    const { user_id, status } = await request.json();

    if (!user_id || !['approved', 'rejected'].includes(status)) {
      return json({ error: 'user_id and valid status (approved|rejected) are required.' }, 400);
    }

    const result = await env.DB.prepare(
      "UPDATE users SET ib_status = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(status, user_id).run();

    // Without this the admin gets a success toast for a user that doesn't exist
    if (!result.meta.changes) {
      return json({ error: 'User not found.' }, 404);
    }

    return json({ success: true, message: `IB verification ${status}.` });
  } catch (e) {
    console.error('Admin IB error:', e.message, e.stack);
    return json({ error: 'Action failed. Please try again.' }, 500);
  }
}
