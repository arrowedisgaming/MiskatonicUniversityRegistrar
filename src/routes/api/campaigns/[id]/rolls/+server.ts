import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import { assertCampaignMember } from '$lib/server/campaign/auth';
import { appendCampaignRoll, listCampaignRolls } from '$lib/server/campaign/rolls';
import { appendRollSchema } from '$lib/schemas/campaign.schema';
import { campaignMembers, investigators, users } from '$lib/server/db/schema';
import type { PlayRollHistoryEntry } from '$lib/types/character';

/**
 * GET /api/campaigns/:id/rolls?since=<integer>&limit=<n>
 * Integer cursor pagination — `since` is the autoincrement id from
 * campaign_rolls, NOT a timestamp or nanoid.
 */
export const GET: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);
	const auth = await assertCampaignMember(db, { campaignId: event.params.id, userId });
	if (!auth.ok) throw error(auth.status, auth.message);

	const rawSince = event.url.searchParams.get('since');
	const rawLimit = event.url.searchParams.get('limit');
	const since = rawSince ? Number.parseInt(rawSince, 10) : undefined;
	const limit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
	if ((since !== undefined && !Number.isFinite(since)) || (limit !== undefined && !Number.isFinite(limit))) {
		throw error(400, 'since and limit must be integers');
	}

	const rolls = await listCampaignRolls(db, {
		campaignId: event.params.id,
		since,
		limit
	});
	return json(rolls);
};

/**
 * POST /api/campaigns/:id/rolls — body { entry }.
 *
 * The poster must be an active member. Both `investigatorId` and the
 * `investigatorName` snapshot stored on the row are resolved server-side
 * from the caller's active membership joined against `investigators` —
 * NOT trusted from the body — so a player can't impersonate another
 * member in the shared roll log. The `entry` itself is validated against
 * the same strict per-kind schemas the character-save path uses; arbitrary
 * extra fields are stripped, and oversized strings / arrays / dice
 * counts are rejected outright.
 */
export const POST: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);
	const auth = await assertCampaignMember(db, { campaignId: event.params.id, userId });
	if (!auth.ok) throw error(auth.status, auth.message);

	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw error(400, 'Request body is not valid JSON');
	}
	const parsed = appendRollSchema.safeParse(raw);
	if (!parsed.success) {
		throw error(400, `Invalid roll: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
	}

	// Server-side attribution. The membership join produces both the
	// investigator id (for the FK) and the canonical investigator name
	// (for the denormalised snapshot column). When the caller has no
	// active membership — e.g. a Keeper who didn't join their own campaign
	// — fall back to their user display name with a null investigator FK.
	const membershipRow = await db
		.select({
			investigatorId: campaignMembers.investigatorId,
			investigatorName: investigators.name,
			userName: users.name
		})
		.from(campaignMembers)
		.innerJoin(investigators, eq(investigators.id, campaignMembers.investigatorId))
		.innerJoin(users, eq(users.id, campaignMembers.userId))
		.where(
			and(
				eq(campaignMembers.campaignId, event.params.id),
				eq(campaignMembers.userId, userId),
				isNull(campaignMembers.leftAt)
			)
		)
		.get();

	let investigatorId: string | null;
	let investigatorName: string;
	if (membershipRow) {
		investigatorId = membershipRow.investigatorId;
		investigatorName = membershipRow.investigatorName || 'Unnamed Investigator';
	} else {
		investigatorId = null;
		const userRow = await db
			.select({ name: users.name })
			.from(users)
			.where(eq(users.id, userId))
			.get();
		investigatorName = userRow?.name || 'Keeper';
	}

	const result = await appendCampaignRoll(db, {
		campaignId: event.params.id,
		userId,
		investigatorId,
		investigatorName,
		entry: parsed.data.entry as unknown as PlayRollHistoryEntry
	});
	return json({ id: result.id }, { status: 201 });
};
