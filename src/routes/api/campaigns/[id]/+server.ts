import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import {
	deleteCampaign,
	getCampaignForUser,
	updateCampaign
} from '$lib/server/campaign/campaign';
import { updateCampaignSchema } from '$lib/schemas/campaign.schema';

/** GET /api/campaigns/:id — keeper or member view */
export const GET: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);
	const result = await getCampaignForUser(db, { campaignId: event.params.id, userId });
	if (!result.ok) throw error(result.status, result.message);
	const { campaign, role } = result;
	return json({
		id: campaign.id,
		name: campaign.name,
		description: campaign.description,
		isOpen: campaign.isOpen,
		hasShareLink: campaign.shareId !== null,
		shareId: role === 'keeper' ? campaign.shareId : null, // never leak token to players
		keeperUserId: campaign.keeperUserId,
		createdAt: campaign.createdAt,
		updatedAt: campaign.updatedAt,
		role
	});
};

/** PATCH /api/campaigns/:id — keeper-only metadata update */
export const PATCH: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);
	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw error(400, 'Request body is not valid JSON');
	}
	const parsed = updateCampaignSchema.safeParse(raw);
	if (!parsed.success) {
		throw error(400, `Invalid update: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
	}
	const result = await updateCampaign(
		db,
		{ campaignId: event.params.id, userId },
		parsed.data
	);
	if (!result.ok) throw error(result.status, result.message);
	return json({ success: true });
};

/** DELETE /api/campaigns/:id — keeper hard-deletes the campaign */
export const DELETE: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);
	const result = await deleteCampaign(db, { campaignId: event.params.id, userId });
	if (!result.ok) throw error(result.status, result.message);
	return new Response(null, { status: 204 });
};
