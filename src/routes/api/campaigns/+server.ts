import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import { createCampaign, listCampaignsForUser } from '$lib/server/campaign/campaign';
import { createCampaignSchema } from '$lib/schemas/campaign.schema';

/** GET /api/campaigns — list campaigns the user keeps or plays in */
export const GET: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);
	return json(await listCampaignsForUser(db, userId));
};

/** POST /api/campaigns — create a new campaign (caller becomes Keeper) */
export const POST: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);

	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw error(400, 'Request body is not valid JSON');
	}
	const parsed = createCampaignSchema.safeParse(raw);
	if (!parsed.success) {
		throw error(400, `Invalid campaign: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
	}

	const { id } = await createCampaign(db, {
		keeperUserId: userId,
		name: parsed.data.name,
		description: parsed.data.description
	});
	return json({ id }, { status: 201 });
};
