import { json, rateLimit, notifyAdmin, isValidEmail } from './_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!(await rateLimit(env, 'contact', request, 5, 3600))) {
      return json({ error: 'Too many messages. Please try again later.' }, 429);
    }

    const { email, message } = await request.json();

    if (!isValidEmail(email)) {
      return json({ error: 'A valid email address is required.' }, 400);
    }
    const msg = typeof message === 'string' ? message.trim() : '';
    if (msg.length < 5) {
      return json({ error: 'Please enter a message (at least 5 characters).' }, 400);
    }
    if (msg.length > 2000) {
      return json({ error: 'Message is too long (max 2000 characters).' }, 400);
    }

    // Store first so the message survives even if Telegram is down
    try {
      await env.DB.prepare(
        'INSERT INTO contacts (email, message) VALUES (?, ?)'
      ).bind(email.trim(), msg).run();
    } catch (e) {
      console.error('Contact insert error (has migration 0005 been run?):', e.message);
    }

    context.waitUntil(notifyAdmin(env, '✉️ Contact Form Message', {
      Email: email.trim(),
      Message: msg.length > 1000 ? msg.slice(0, 1000) + '…' : msg
    }));

    return json({ success: true, message: 'Message received. We will get back to you soon.' }, 201);
  } catch (e) {
    console.error('Contact error:', e.message, e.stack);
    return json({ error: 'Failed to send message. Please try again.' }, 500);
  }
}
