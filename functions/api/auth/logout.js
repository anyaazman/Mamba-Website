import { hashToken, json } from '../_helpers.js';

export async function onRequestPost({ request, env }) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const hashed = await hashToken(authHeader.slice(7));
    await env.DB.prepare('DELETE FROM tokens WHERE token = ?').bind(hashed).run();
  }
  return json({ success: true });
}
