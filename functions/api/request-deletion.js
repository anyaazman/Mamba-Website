import { json, rateLimit, notifyAdmin, recordEvent, isValidEmail } from './_helpers.js';

// Public account-deletion request endpoint (Google Play / App Store data-deletion URL).
// Records a durable event + pings admins; an admin then fulfils it with the existing
// admin delete-user flow. No dedicated table needed — reuses the events table.
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!(await rateLimit(env, 'account_deletion', request, 5, 3600))) {
      return json({ error: 'Too many requests. Please try again later.' }, 429);
    }

    const body = await request.json();
    const { email, mt5_account, reason, confirm, website } = body || {};

    // Honeypot — real users never fill this. Pretend success so bots get no signal.
    if (typeof website === 'string' && website.trim() !== '') {
      return json({ success: true, message: 'Your deletion request has been received.' }, 201);
    }

    if (!isValidEmail(email)) {
      return json({ error: 'A valid account email address is required.' }, 400);
    }
    if (confirm !== true) {
      return json({ error: 'Please confirm you understand the deletion is permanent.' }, 400);
    }

    const cleanEmail = email.trim();
    const cleanAccount = typeof mt5_account === 'string' ? mt5_account.trim().slice(0, 200) : '';
    const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 1000) : '';

    // Durable record so the request survives even if Telegram is unavailable
    await recordEvent(env, 'account_deletion_request', {
      page: 'account-deletion.html',
      metadata: { email: cleanEmail, mt5_account: cleanAccount, reason: cleanReason }
    });

    context.waitUntil(notifyAdmin(env, '🗑️ Account Deletion Request', {
      Email: cleanEmail,
      'MT5 Account': cleanAccount || '—',
      Reason: cleanReason || '—'
    }));

    return json({
      success: true,
      message: 'Your deletion request has been received. We will verify it and email you a confirmation once your account is deleted.'
    }, 201);
  } catch (e) {
    console.error('Account deletion request error:', e.message, e.stack);
    return json({ error: 'Failed to submit request. Please try again.' }, 500);
  }
}
