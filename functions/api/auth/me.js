import { authenticateUser, json } from '../_helpers.js';

export async function onRequestGet({ request, env }) {
  const user = await authenticateUser(request, env);
  if (!user) return json({ error: 'Not authenticated.' }, 401);
  return json({ user });
}
