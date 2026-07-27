import { verifyAdminKey, json } from '../../_helpers.js';
import { getLatestSnapshot, reconcile } from './_valetax.js';

// GET /api/admin/valetax/reconcile
// Matches the most recent imported Valetax snapshot against the Mamba database
// and returns the four buckets the operator needs to act on.
export async function onRequestGet({ request, env }) {
  if (!(await verifyAdminKey(request, env))) {
    return json({ error: 'Unauthorized.' }, 403);
  }

  try {
    const snapshot = await getLatestSnapshot(env);
    if (!snapshot) {
      return json({
        hasSnapshot: false,
        message: 'No Valetax snapshot imported yet. Run tools/valetax-sync and upload valetax-snapshot.json.'
      });
    }

    const r = await reconcile(env, snapshot.id);

    return json({
      hasSnapshot: true,
      snapshot: {
        id: snapshot.id,
        pulledAt: snapshot.pulled_at,
        importedAt: snapshot.imported_at,
        clientCount: snapshot.client_count
      },
      counts: {
        matched: r.matched.length,
        claimedNotInValetax: r.claimedNotInValetax.length,
        inValetaxNotOnMamba: r.inValetaxNotOnMamba.length,
        accountsNotInValetax: r.accountsNotInValetax.length,
        subIbsNotRecursed: r.subIbCount
      },
      matched: r.matched,
      claimedNotInValetax: r.claimedNotInValetax,
      inValetaxNotOnMamba: r.inValetaxNotOnMamba,
      accountsNotInValetax: r.accountsNotInValetax
    });
  } catch (e) {
    console.error('Valetax reconcile error:', e.message);
    return json({ error: 'Reconciliation failed. ' + e.message }, 500);
  }
}
