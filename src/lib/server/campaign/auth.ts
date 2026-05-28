import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '$lib/server/db';
import { campaignMembers, campaigns } from '$lib/server/db/schema';

/**
 * Resolves a user's role inside a campaign. Returns 'none' for users with
 * no relationship to the campaign — kept distinct from a lookup miss so
 * routes can return 404 (campaign missing) vs 403 (campaign exists but
 * caller isn't a member) without an extra query.
 */
export type CampaignRole = 'keeper' | 'player' | 'none';

export async function resolveCampaignRole(
	db: AppDb,
	params: { userId: string; campaignId: string }
): Promise<CampaignRole | null> {
	const campaign = await db
		.select({ keeperUserId: campaigns.keeperUserId })
		.from(campaigns)
		.where(eq(campaigns.id, params.campaignId))
		.get();

	if (!campaign) return null;
	if (campaign.keeperUserId === params.userId) return 'keeper';

	const member = await db
		.select({ id: campaignMembers.id })
		.from(campaignMembers)
		.where(
			and(
				eq(campaignMembers.campaignId, params.campaignId),
				eq(campaignMembers.userId, params.userId),
				isNull(campaignMembers.leftAt)
			)
		)
		.get();

	return member ? 'player' : 'none';
}

export type AuthFailure =
	| { ok: false; status: 404; message: string }
	| { ok: false; status: 403; message: string };

/**
 * Confirms the caller is the Keeper of this campaign. Use on every endpoint
 * that mutates someone else's data (inventory push, member removal, share
 * rotation, campaign deletion).
 */
export async function assertCampaignKeeper(
	db: AppDb,
	params: { userId: string; campaignId: string }
): Promise<{ ok: true } | AuthFailure> {
	const role = await resolveCampaignRole(db, params);
	if (role === null) return { ok: false, status: 404, message: 'Campaign not found' };
	if (role !== 'keeper') return { ok: false, status: 403, message: 'Keeper only' };
	return { ok: true };
}

/**
 * Confirms the caller is the Keeper or an active (non-left) player. Use on
 * read endpoints and on roll-append (players post their own rolls).
 */
export async function assertCampaignMember(
	db: AppDb,
	params: { userId: string; campaignId: string }
): Promise<{ ok: true; role: 'keeper' | 'player' } | AuthFailure> {
	const role = await resolveCampaignRole(db, params);
	if (role === null) return { ok: false, status: 404, message: 'Campaign not found' };
	if (role === 'none') return { ok: false, status: 403, message: 'Not a member of this campaign' };
	return { ok: true, role };
}
