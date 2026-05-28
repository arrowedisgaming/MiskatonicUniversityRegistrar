import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import { leaveCampaign } from '$lib/server/campaign/membership';

/** POST /api/campaigns/:id/leave — player soft-leaves the campaign */
export const POST: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);
	const r = await leaveCampaign(db, { campaignId: event.params.id, userId });
	if (!r.ok) throw error(r.status, r.message);
	return new Response(null, { status: 204 });
};
