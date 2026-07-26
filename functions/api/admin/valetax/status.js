import { verifyAdminKey, json } from '../../_helpers.js';
import { getStoredSession } from './_valetax.js';

// GET /api/admin/valetax/status
// Tells the dashboard whether there's a live Valetax session so it can show
// "Connected" vs "Connect Valetax". Never returns the token itself.
export async function onRequestGet({ request, env }) {
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  const session = await getStoredSession(env);
  if (!session) {
    return json({ connected: false });
  }

  return json({
    connected: !session.expired,
    expired: session.expired,
    expiresAt: session.expires_at,
    lastLogin: session.updated_at
  });
}
