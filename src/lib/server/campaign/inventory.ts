import { and, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AppDb } from '$lib/server/db';
import {
	campaignMembers,
	campaignRolls,
	campaigns,
	investigators
} from '$lib/server/db/schema';
import type {
	CharacterWeapon,
	CoCCharacterData,
	EquipmentItem,
	PlayRollHistoryKeeperInventoryEntry
} from '$lib/types/character';
import { migrateCharacterData } from '$lib/engine/character-migration';
import { validateFinalInvestigator } from '$lib/server/validation/investigator';

export interface InventoryDelta {
	weapons?: CharacterWeapon[];
	items?: EquipmentItem[];
	cashDelta?: number;
}

export type AddItemsToMemberResult =
	| {
			ok: true;
			newUpdatedAt: number;
			rollId: number;
	  }
	| {
			ok: false;
			status: 404 | 403 | 409 | 400;
			message: string;
			currentUpdatedAt?: number;
	  };

/**
 * Keeper-side server merge of an inventory delta into a player's
 * investigator. Concurrency-correct: this is the *only* path that should
 * modify a player's investigator from the Keeper side, because it
 *
 *   1. asserts Keeper role on the campaign,
 *   2. confirms `memberId` belongs to *this* campaign (prevents tampering
 *      across campaigns even with a guessed memberId),
 *   3. reads the investigator row fresh,
 *   4. checks the caller's `expectedUpdatedAt` matches what's on disk —
 *      otherwise returns 409 so the keeper UI can refetch and retry,
 *   5. appends the delta to equipment, applies cashDelta,
 *   6. re-validates the *full* character against the same rules used by
 *      PUT /api/investigators/[id] (so a bad delta can't yield a malformed
 *      character via this side door), and
 *   7. UPDATEs with `WHERE id = ? AND updated_at = ?` as a belt-and-braces
 *      precondition in case some other writer landed between step 4 and 7.
 *
 * The "Keeper added X" event is also written into `campaign_rolls` so the
 * unified log shows it like any other entry.
 */
export async function addItemsToMember(
	db: AppDb,
	params: {
		campaignId: string;
		memberId: string;
		keeperUserId: string;
		keeperDisplayName: string;
		delta: InventoryDelta;
		expectedUpdatedAt: number; // millis
	},
	now: Date = new Date()
): Promise<AddItemsToMemberResult> {
	// 1. Keeper role.
	const campaign = await db
		.select({ keeperUserId: campaigns.keeperUserId })
		.from(campaigns)
		.where(eq(campaigns.id, params.campaignId))
		.get();
	if (!campaign) return { ok: false, status: 404, message: 'Campaign not found' };
	if (campaign.keeperUserId !== params.keeperUserId) {
		return { ok: false, status: 403, message: 'Keeper only' };
	}

	// 2. Member belongs to this campaign and is active.
	const member = await db
		.select({
			id: campaignMembers.id,
			campaignId: campaignMembers.campaignId,
			investigatorId: campaignMembers.investigatorId,
			leftAt: campaignMembers.leftAt
		})
		.from(campaignMembers)
		.where(eq(campaignMembers.id, params.memberId))
		.get();
	if (!member || member.campaignId !== params.campaignId) {
		return { ok: false, status: 404, message: 'Member not found in this campaign' };
	}
	if (member.leftAt !== null) {
		return { ok: false, status: 409, message: 'Member has left the campaign' };
	}

	// 3. Fresh investigator read.
	const row = await db
		.select({
			id: investigators.id,
			data: investigators.data,
			updatedAt: investigators.updatedAt,
			isArchived: investigators.isArchived
		})
		.from(investigators)
		.where(eq(investigators.id, member.investigatorId))
		.get();
	if (!row) return { ok: false, status: 404, message: 'Investigator not found' };
	if (row.isArchived) {
		return { ok: false, status: 409, message: 'Investigator is archived' };
	}

	// 4. Optimistic concurrency precondition.
	if (row.updatedAt.getTime() !== params.expectedUpdatedAt) {
		return {
			ok: false,
			status: 409,
			message: 'Investigator was updated by someone else — refetch and retry',
			currentUpdatedAt: row.updatedAt.getTime()
		};
	}

	// 5. Apply delta.
	const character = migrateCharacterData(JSON.parse(row.data)) as CoCCharacterData;
	const itemNames: string[] = [];
	if (params.delta.weapons?.length) {
		character.equipment.weapons = [...character.equipment.weapons, ...params.delta.weapons];
		for (const w of params.delta.weapons) itemNames.push(w.name);
	}
	if (params.delta.items?.length) {
		character.equipment.items = [...character.equipment.items, ...params.delta.items];
		for (const i of params.delta.items) {
			itemNames.push(i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name);
		}
	}
	if (typeof params.delta.cashDelta === 'number' && params.delta.cashDelta !== 0) {
		character.equipment.cash = Math.max(0, character.equipment.cash + params.delta.cashDelta);
		itemNames.push(
			params.delta.cashDelta > 0
				? `+${params.delta.cashDelta} cash`
				: `${params.delta.cashDelta} cash`
		);
	}

	if (itemNames.length === 0) {
		return { ok: false, status: 400, message: 'Delta is empty — nothing to add' };
	}

	// 6. Re-validate the full character. We use the 'play' phase because
	// equipment changes shouldn't be evaluated against creation-time skill
	// caps (creation phase max-skill-total is 90; play is 500).
	const ruleCheck = validateFinalInvestigator(character, { phase: 'play' });
	if (!ruleCheck.valid) {
		return {
			ok: false,
			status: 400,
			message: `Inventory change would invalidate character: ${ruleCheck.errors.join('; ')}`
		};
	}

	// 7. Conditional UPDATE — match on the precondition timestamp so a
	// concurrent persist between step 4 and here loses cleanly. D1's
	// transaction semantics are weaker than local SQLite; the WHERE clause
	// is the durable guarantee.
	//
	// Subtlety: the `updated_at` column uses Drizzle `mode: 'timestamp'`
	// which is *second-precision*. If we naively wrote `new Date()` we'd
	// risk the new timestamp truncating to the same second as the old one,
	// which would silently break optimistic concurrency for any second
	// where two writes happen. Force monotonic forward movement at second
	// granularity so each successful write strictly advances `updated_at`.
	const nextSec = Math.max(
		Math.floor(now.getTime() / 1000),
		Math.floor(row.updatedAt.getTime() / 1000) + 1
	);
	const nextUpdatedAt = new Date(nextSec * 1000);
	const updateRes = await db
		.update(investigators)
		.set({
			data: JSON.stringify(character),
			updatedAt: nextUpdatedAt
		})
		.where(
			and(
				eq(investigators.id, member.investigatorId),
				eq(investigators.updatedAt, row.updatedAt)
			)
		)
		.returning({ id: investigators.id });
	if (updateRes.length === 0) {
		// Lost the race to another writer.
		const refresh = await db
			.select({ updatedAt: investigators.updatedAt })
			.from(investigators)
			.where(eq(investigators.id, member.investigatorId))
			.get();
		return {
			ok: false,
			status: 409,
			message: 'Concurrent write — refetch and retry',
			currentUpdatedAt: refresh?.updatedAt.getTime() ?? 0
		};
	}

	// Emit a "Keeper added X" event into the campaign roll log so the
	// unified renderer surfaces it just like any other entry.
	const entry: PlayRollHistoryKeeperInventoryEntry = {
		id: nanoid(),
		at: now.toISOString(),
		targetKind: 'keeperInventory',
		addedBy: params.keeperDisplayName,
		itemNames
	};
	const insertRes = await db
		.insert(campaignRolls)
		.values({
			campaignId: params.campaignId,
			userId: null, // keeper-as-author surfaced via addedBy
			investigatorId: member.investigatorId,
			investigatorName: character.name || 'Unnamed Investigator',
			entry: JSON.stringify(entry),
			createdAt: nextUpdatedAt
		})
		.returning({ id: campaignRolls.id });

	// Return the exact value the row will read back as. The keeper UI uses
	// this as the next request's `expectedUpdatedAt`, so it must match the
	// (second-truncated) stored value, not the wall-clock millis.
	return {
		ok: true,
		newUpdatedAt: nextUpdatedAt.getTime(),
		rollId: insertRes[0].id
	};
}

/**
 * Fetch a member with their investigator's current `updatedAt` so the
 * keeper UI can include it as the optimistic-concurrency precondition.
 * Returns null for unknown / left members.
 */
export async function getMemberForInventoryPush(
	db: AppDb,
	params: { campaignId: string; memberId: string }
): Promise<{
	memberId: string;
	investigatorId: string;
	investigatorName: string;
	updatedAt: number;
} | null> {
	const row = await db
		.select({
			memberId: campaignMembers.id,
			investigatorId: investigators.id,
			investigatorName: investigators.name,
			updatedAt: investigators.updatedAt
		})
		.from(campaignMembers)
		.innerJoin(investigators, eq(investigators.id, campaignMembers.investigatorId))
		.where(
			and(
				eq(campaignMembers.id, params.memberId),
				eq(campaignMembers.campaignId, params.campaignId),
				isNull(campaignMembers.leftAt)
			)
		)
		.get();
	if (!row) return null;
	return {
		memberId: row.memberId,
		investigatorId: row.investigatorId,
		investigatorName: row.investigatorName,
		updatedAt: row.updatedAt.getTime()
	};
}
