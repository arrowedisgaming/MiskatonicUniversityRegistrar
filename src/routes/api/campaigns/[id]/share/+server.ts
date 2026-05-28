import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import {
	disableCampaignShare,
	enableCampaignShare
} from '$lib/server/campaign/share';

/**
 * POST /api/campaigns/:id/share — mint/rotate join token (keeper only).
 * Returns both the raw shareId and a precomposed shareUrl.
 */
export const POST: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);
	const r = await enableCampaignShare(db, { campaignId: event.params.id, userId });
	if (!r.ok) throw error(r.status, r.message);
	return json({
		shareId: r.shareId,
		shareUrl: `${event.url.origin}/campaigns/join/${r.shareId}`
	});
};

/** DELETE /api/campaigns/:id/share — disable joining (keeper only) */
export const DELETE: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);
	const r = await disableCampaignShare(db, { campaignId: event.params.id, userId });
	if (!r.ok) throw error(r.status, r.message);
	return new Response(null, { status: 204 });
};
