import { verifyAdminKey, json } from '../_helpers.js';

export async function onRequestGet({ request, env }) {
  const valid = await verifyAdminKey(request, env);
  return json({ valid });
}
