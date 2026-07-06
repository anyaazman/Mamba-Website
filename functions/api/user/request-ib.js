import { authenticateUser, json, recordEvent, notifyAdmin, isValidEmail } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await authenticateUser(request, env);
  if (!user) return json({ error: 'Not authenticated.' }, 401);

  try {
    const { ib_email, ib_type } = await request.json();

    const email = typeof ib_email === 'string' ? ib_email.trim() : '';
    if (!email) {
      return json({ error: 'Valetax email is required.' }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ error: 'Please enter a valid Valetax email address.' }, 400);
    }
    const type = ib_type === 'new' || ib_type === 'existing' ? ib_type : '';

    if (user.ib_status === 'approved') {
      return json({ error: 'IB verification is already approved.' }, 400);
    }

    await env.DB.prepare(
      "UPDATE users SET ib_status = 'pending', ib_email = ?, ib_type = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(email, type, user.id).run();

    await recordEvent(env, 'ib_request', { user_id: user.id });
    context.waitUntil(notifyAdmin(env, '🔐 IB Verification Request', {
      Name: user.name,
      Email: user.email,
      'Valetax Email': email,
      'Selection': type === 'new' ? 'New Account (No Valetax yet)' : 'Already Has Valetax Account'
    }));

    return json({ success: true, message: 'IB verification request submitted.' });
  } catch (e) {
    console.error('Request IB error:', e.message, e.stack);
    return json({ error: 'Request failed. Please try again.' }, 500);
  }
}
