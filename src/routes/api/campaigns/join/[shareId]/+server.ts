import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import { resolveCampaignByShareId } from '$lib/server/campaign/share';
import { joinCampaign } from '$lib/server/campaign/membership';
import { joinCampaignSchema } from '$lib/schemas/campaign.schema';

/**
 * POST /api/campaigns/join/:shareId — body { investigatorId }.
 * Treats unknown/closed campaigns identically (404) so an attacker can't
 * enumerate which tokens currently resolve.
 */
export const POST: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);

	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw error(400, 'Request body is not valid JSON');
	}
	const parsed = joinCampaignSchema.safeParse(raw);
	if (!parsed.success) {
		throw error(400, `Invalid join request: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
	}

	const resolved = await resolveCampaignByShareId(db, event.params.shareId);
	if (!resolved.ok) throw error(resolved.status, resolved.message);

	const result = await joinCampaign(db, {
		campaignId: resolved.campaign.id,
		userId,
		investigatorId: parsed.data.investigatorId
	});
	if (!result.ok) throw error(result.status, result.message);

	return json(
		{
			campaignId: resolved.campaign.id,
			memberId: result.memberId
		},
		{ status: 201 }
	);
};
