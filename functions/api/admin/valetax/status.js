import { verifyAdminKey, json } from '../../_helpers.js';
import { getLatestSnapshot } from './_valetax.js';

// GET /api/admin/valetax/status
// Reports whether a Valetax snapshot has been imported and how stale it is, so
// the admin panel can show freshness before anyone acts on the reconciliation.
//
// This replaces the earlier live-session status. The Worker no longer holds a
// Valetax session at all — see _valetax.js for why.
export async function onRequestGet({ request, env }) {
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  try {
    const snapshot = await getLatestSnapshot(env);
    if (!snapshot) {
      return json({ hasSnapshot: false });
    }

    // Age is measured from the Valetax pull, not the upload: a month-old
    // snapshot uploaded a minute ago is still a month-old view of the downline.
    const basis = snapshot.pulled_at || snapshot.imported_at;
    let ageHours = null;
    const parsed = Date.parse(basis ? String(basis).replace(' ', 'T') + (String(basis).endsWith('Z') ? '' : 'Z') : '');
    if (!Number.isNaN(parsed)) {
      ageHours = Math.max(0, Math.round((Date.now() - parsed) / 3600000));
    }

    return json({
      hasSnapshot: true,
      snapshotId: snapshot.id,
      pulledAt: snapshot.pulled_at,
      importedAt: snapshot.imported_at,
      clientCount: snapshot.client_count,
      ageHours
    });
  } catch (e) {
    console.error('Valetax status error:', e.message);
    return json({ error: 'Could not read snapshot status. ' + e.message }, 500);
  }
}
