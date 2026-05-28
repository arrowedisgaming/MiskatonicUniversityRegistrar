import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import { assertCampaignMember } from '$lib/server/campaign/auth';
import { summarizeCampaignDashboard } from '$lib/server/campaign/rolls';

/**
 * GET /api/campaigns/:id/dashboard — per-member vitals snapshot for the
 * Keeper "play dashboard" + player-side roster. Visible to both roles —
 * players see the same vitals on their roster page.
 */
export const GET: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);
	const auth = await assertCampaignMember(db, { campaignId: event.params.id, userId });
	if (!auth.ok) throw error(auth.status, auth.message);

	const vitals = await summarizeCampaignDashboard(db, event.params.id, userId);
	return json(vitals);
};
