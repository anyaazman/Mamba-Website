import { verifyAdminKey, json, rateLimit } from '../_helpers.js';

export async function onRequestGet({ request, env }) {
  // Rate-limited because this is the endpoint an attacker would use to
  // brute-force the admin key
  if (!(await rateLimit(env, 'adminstatus', request, 10, 300))) {
    return json({ valid: false, error: 'Too many attempts.' }, 429);
  }
  const valid = await verifyAdminKey(request, env);
  return json({ valid });
}
