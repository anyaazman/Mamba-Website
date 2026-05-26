import { json } from '../_helpers.js';

export async function onRequestPost({ request, env }) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    await env.DB.prepare('DELETE FROM tokens WHERE token = ?').bind(authHeader.slice(7)).run();
  }
  return json({ success: true });
}
