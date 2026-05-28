import { authenticateUser, json, recordEvent, notifyAdmin } from '../_helpers.js';

export async function onRequestPost({ request, env }) {
  const user = await authenticateUser(request, env);
  if (!user) return json({ error: 'Not authenticated.' }, 401);

  try {
    const { ib_email } = await request.json();

    if (!ib_email || !ib_email.trim()) {
      return json({ error: 'Valetax email is required.' }, 400);
    }

    if (user.ib_status === 'approved') {
      return json({ error: 'IB verification is already approved.' }, 400);
    }

    await env.DB.prepare(
      "UPDATE users SET ib_status = 'pending', ib_email = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(ib_email.trim(), user.id).run();

    await recordEvent(env, 'ib_request', { user_id: user.id });
    await notifyAdmin(env, '🔐 IB Verification Request', { Name: user.name, Email: user.email, 'Valetax Email': ib_email.trim() });

    return json({ success: true, message: 'IB verification request submitted.' });
  } catch (e) {
    console.error('Request IB error:', e.message, e.stack);
    return json({ error: 'Request failed. Please try again.' }, 500);
  }
}
