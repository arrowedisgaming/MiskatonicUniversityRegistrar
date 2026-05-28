import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { AppDb } from '$lib/server/db';
import {
	campaignMembers,
	campaignRolls,
	investigators
} from '$lib/server/db/schema';
import type {
	CoCCharacterData,
	PlayRollHistoryEntry
} from '$lib/types/character';
import { migrateCharacterData } from '$lib/engine/character-migration';

export interface AppendRollInput {
	campaignId: string;
	userId: string | null;
	investigatorId: string | null;
	investigatorName: string;
	entry: PlayRollHistoryEntry;
}

/**
 * Appends a roll to the campaign log. Caller is responsible for the auth
 * check (members or Keeper depending on the entry kind).
 */
export async function appendCampaignRoll(
	db: AppDb,
	input: AppendRollInput,
	now: Date = new Date()
): Promise<{ id: number }> {
	const result = await db
		.insert(campaignRolls)
		.values({
			campaignId: input.campaignId,
			userId: input.userId,
			investigatorId: input.investigatorId,
			investigatorName: input.investigatorName,
			entry: JSON.stringify(input.entry),
			createdAt: now
		})
		.returning({ id: campaignRolls.id });
	return { id: result[0].id };
}

/**
 * Wire shape sent to the client.
 *
 * Why timestamps are `number` (ms-since-epoch) and NOT `Date`:
 * the initial page load goes through SvelteKit's devalue serialiser which
 * preserves Date instances, but the polling fetch path uses plain
 * `JSON.stringify` / `parse` which silently converts them to strings. Mixing
 * the two means `member.updatedAt.getTime()` works on the first paint and
 * throws after the first poll. Using `number` everywhere makes both code
 * paths produce the same type. Consumers that want a Date can `new Date(ms)`.
 */
export interface CampaignRollRow {
	id: number;
	investigatorId: string | null;
	investigatorName: string;
	entry: PlayRollHistoryEntry;
	createdAt: number;
}

/**
 * Lists rolls for a campaign in newest-first order. `since` is the integer
 * cursor — only rolls with `id > since` are returned. Limit is capped at
 * 200 server-side regardless of caller input to keep the payload bounded.
 */
export async function listCampaignRolls(
	db: AppDb,
	params: { campaignId: string; since?: number; limit?: number }
): Promise<CampaignRollRow[]> {
	const limit = Math.min(Math.max(1, params.limit ?? 50), 200);
	const sinceClause = params.since
		? and(eq(campaignRolls.campaignId, params.campaignId), gt(campaignRolls.id, params.since))
		: eq(campaignRolls.campaignId, params.campaignId);

	const rows = await db
		.select({
			id: campaignRolls.id,
			investigatorId: campaignRolls.investigatorId,
			investigatorName: campaignRolls.investigatorName,
			entry: campaignRolls.entry,
			createdAt: campaignRolls.createdAt
		})
		.from(campaignRolls)
		.where(sinceClause)
		.orderBy(desc(campaignRolls.id))
		.limit(limit);

	return rows.map((r) => ({
		id: r.id,
		investigatorId: r.investigatorId,
		investigatorName: r.investigatorName,
		entry: JSON.parse(r.entry) as PlayRollHistoryEntry,
		createdAt: r.createdAt.getTime()
	}));
}

export interface DashboardMemberVitals {
	memberId: string;
	investigatorId: string;
	investigatorName: string;
	portraitUrl: string;
	occupation: string;
	hp: { max: number; current: number };
	mp: { max: number; current: number };
	sanity: { max: number; current: number; startingValue: number };
	luck: { max: number; current: number };
	lastRoll: PlayRollHistoryEntry | null;
	/** ms since epoch — see CampaignRollRow comment for why these are numbers, not Dates. */
	lastRollAt: number | null;
	updatedAt: number;
	/**
	 * True when this row's investigator is owned by the caller (i.e. the
	 * member.userId == the user requesting the dashboard). Gates the "Open
	 * full sheet" link on the Sheets tab — the sheet route only loads
	 * investigators owned by the caller (or by a stepped-up admin), so
	 * linking another member's id from a campaign view would 404 for them.
	 */
	belongsToCaller: boolean;
}

/**
 * Composes the per-member vitals view for the Keeper dashboard.
 *
 * IMPORTANT: this is NOT `composeLiveCharacter`. That helper merges a
 * client-side Svelte 5 `$state` overlay onto a base character — the server
 * never sees those overlay cells. We don't need them either, because
 * `persistInvestigator()` at src/routes/sheet/[id]/+page.svelte:554 PUTs
 * the already-merged `liveChar`. The saved JSON in `investigators.data`
 * already reflects Play Mode current values up to the last persist (which
 * the sheet page fires after every roll and every HP/SAN tick).
 *
 * Caveat: vitals lag until the next player persist. For CoC's pace this is
 * fine; if not the right fix is debounced persists, not server overlay.
 */
export async function summarizeCampaignDashboard(
	db: AppDb,
	campaignId: string,
	/**
	 * The id of the user requesting the dashboard, used to compute the
	 * per-row `belongsToCaller` flag. Optional so callers that don't have a
	 * user context (admin tooling, future read-only previews) can pass null
	 * and get a payload with every row marked as not-belonging-to-anyone.
	 */
	callerUserId: string | null = null
): Promise<DashboardMemberVitals[]> {
	const members = await db
		.select({
			memberId: campaignMembers.id,
			memberUserId: campaignMembers.userId,
			investigatorId: investigators.id,
			occupation: investigators.occupation,
			data: investigators.data,
			updatedAt: investigators.updatedAt
		})
		.from(campaignMembers)
		.innerJoin(investigators, eq(campaignMembers.investigatorId, investigators.id))
		.where(
			and(
				eq(campaignMembers.campaignId, campaignId),
				isNull(campaignMembers.leftAt),
				eq(investigators.isArchived, false)
			)
		);

	// Last roll per investigator. One query per member is acceptable here —
	// dashboard polls every ~5s for a small N. If this ever shows up in the
	// hot path, batch with a window function.
	const out: DashboardMemberVitals[] = [];
	for (const m of members) {
		const character = migrateCharacterData(JSON.parse(m.data)) as CoCCharacterData;
		const lastRollRow = await db
			.select({
				entry: campaignRolls.entry,
				createdAt: campaignRolls.createdAt
			})
			.from(campaignRolls)
			.where(
				and(
					eq(campaignRolls.campaignId, campaignId),
					eq(campaignRolls.investigatorId, m.investigatorId)
				)
			)
			.orderBy(desc(campaignRolls.id))
			.limit(1)
			.get();

		out.push({
			memberId: m.memberId,
			investigatorId: m.investigatorId,
			investigatorName: character.name || 'Unnamed Investigator',
			portraitUrl: character.portraitUrl,
			occupation: m.occupation,
			hp: character.derivedStats.hp,
			mp: character.derivedStats.mp,
			sanity: character.derivedStats.sanity,
			luck: { max: character.derivedStats.luck.max, current: character.derivedStats.luck.current },
			lastRoll: lastRollRow ? (JSON.parse(lastRollRow.entry) as PlayRollHistoryEntry) : null,
			lastRollAt: lastRollRow ? lastRollRow.createdAt.getTime() : null,
			updatedAt: m.updatedAt.getTime(),
			belongsToCaller: callerUserId !== null && m.memberUserId === callerUserId
		});
	}
	return out;
}
