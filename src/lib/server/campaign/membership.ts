import { and, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AppDb } from '$lib/server/db';
import {
	campaignMembers,
	campaigns,
	investigators
} from '$lib/server/db/schema';

export type JoinCampaignResult =
	| { ok: true; memberId: string }
	| {
			ok: false;
			status: 404 | 403 | 409;
			message: string;
	  };

function isUniqueViolation(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const msg = (err as { message?: unknown }).message;
	return typeof msg === 'string' && msg.includes('UNIQUE constraint failed');
}

/**
 * Add a player + investigator to a campaign. Validates:
 *   - Campaign exists and `isOpen`.
 *   - Investigator belongs to the calling user.
 *   - Investigator is not a draft (mirrors share.ts:43-48 — drafts can't be
 *     surfaced to other players).
 *   - Investigator is not already an active member of this campaign.
 *   - The user does not already have a different active investigator in this
 *     campaign (one-character-per-user-per-campaign is enforced by the
 *     `campaign_members_user_active_uq` partial unique index — we check here
 *     for the friendly 409 message, but the DB index catches it under race).
 *
 * Soft-leave + re-join is supported: if a previous membership row exists with
 * `leftAt != null`, we reactivate it by clearing `leftAt` and updating
 * `joinedAt`. That preserves any historical rolls without DELETE.
 */
export async function joinCampaign(
	db: AppDb,
	params: { campaignId: string; userId: string; investigatorId: string },
	now: Date = new Date()
): Promise<JoinCampaignResult> {
	const campaign = await db
		.select({ id: campaigns.id, isOpen: campaigns.isOpen })
		.from(campaigns)
		.where(eq(campaigns.id, params.campaignId))
		.get();
	if (!campaign) return { ok: false, status: 404, message: 'Campaign not found' };
	if (!campaign.isOpen) {
		return { ok: false, status: 403, message: 'Campaign is closed to new joins' };
	}

	const investigator = await db
		.select({
			id: investigators.id,
			userId: investigators.userId,
			isDraft: investigators.isDraft,
			isArchived: investigators.isArchived
		})
		.from(investigators)
		.where(eq(investigators.id, params.investigatorId))
		.get();
	if (!investigator) return { ok: false, status: 404, message: 'Investigator not found' };
	if (investigator.userId !== params.userId) {
		return { ok: false, status: 403, message: 'Investigator belongs to another user' };
	}
	if (investigator.isArchived) {
		return { ok: false, status: 409, message: 'Investigator is archived' };
	}
	if (investigator.isDraft) {
		return {
			ok: false,
			status: 409,
			message: 'Drafts cannot join a campaign. Finish the investigator first.'
		};
	}

	const active = await db
		.select({ id: campaignMembers.id })
		.from(campaignMembers)
		.where(
			and(
				eq(campaignMembers.campaignId, params.campaignId),
				eq(campaignMembers.investigatorId, params.investigatorId),
				isNull(campaignMembers.leftAt)
			)
		)
		.get();
	if (active) {
		return { ok: false, status: 409, message: 'Investigator is already in this campaign' };
	}

	// User-side active-membership check: one user can only have one active
	// investigator in this campaign. The partial unique index would reject
	// this anyway under race; we catch it here for the friendlier message.
	const userActive = await db
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
	if (userActive) {
		return {
			ok: false,
			status: 409,
			message: 'You already have an active investigator in this campaign. Leave first to switch.'
		};
	}

	// Reactivate a prior soft-leave row if one exists; otherwise insert. Both
	// paths are wrapped to surface partial-index collisions as 409 instead of
	// raw SQLite errors when a concurrent request slipped past the read above.
	const previous = await db
		.select({ id: campaignMembers.id })
		.from(campaignMembers)
		.where(
			and(
				eq(campaignMembers.campaignId, params.campaignId),
				eq(campaignMembers.investigatorId, params.investigatorId)
			)
		)
		.get();

	try {
		if (previous) {
			await db
				.update(campaignMembers)
				.set({ leftAt: null, joinedAt: now, userId: params.userId })
				.where(eq(campaignMembers.id, previous.id));
			return { ok: true, memberId: previous.id };
		}

		const memberId = nanoid();
		await db.insert(campaignMembers).values({
			id: memberId,
			campaignId: params.campaignId,
			userId: params.userId,
			investigatorId: params.investigatorId,
			joinedAt: now,
			leftAt: null
		});
		return { ok: true, memberId };
	} catch (err) {
		if (isUniqueViolation(err)) {
			return {
				ok: false,
				status: 409,
				message: 'A concurrent join collided — try again.'
			};
		}
		throw err;
	}
}

export type LeaveCampaignResult =
	| { ok: true }
	| { ok: false; status: 404; message: string };

/**
 * Soft-leave: stamp `leftAt`. A player can re-join with the same
 * investigator later via `joinCampaign` which will reactivate the row.
 */
export async function leaveCampaign(
	db: AppDb,
	params: { campaignId: string; userId: string },
	now: Date = new Date()
): Promise<LeaveCampaignResult> {
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
	if (!member) return { ok: false, status: 404, message: 'Not an active member' };

	await db
		.update(campaignMembers)
		.set({ leftAt: now })
		.where(eq(campaignMembers.id, member.id));
	return { ok: true };
}

export type RemoveMemberResult =
	| { ok: true }
	| { ok: false; status: 404 | 403; message: string };

/**
 * Keeper removes a player. Soft-leave (sets leftAt). Validates the caller
 * is the Keeper of the campaign that owns the member row — prevents
 * cross-campaign tampering even via a guessed memberId.
 */
export async function removeMember(
	db: AppDb,
	params: { campaignId: string; memberId: string; keeperUserId: string },
	now: Date = new Date()
): Promise<RemoveMemberResult> {
	const campaign = await db
		.select({ keeperUserId: campaigns.keeperUserId })
		.from(campaigns)
		.where(eq(campaigns.id, params.campaignId))
		.get();
	if (!campaign) return { ok: false, status: 404, message: 'Campaign not found' };
	if (campaign.keeperUserId !== params.keeperUserId) {
		return { ok: false, status: 403, message: 'Keeper only' };
	}

	const member = await db
		.select({ id: campaignMembers.id, campaignId: campaignMembers.campaignId })
		.from(campaignMembers)
		.where(eq(campaignMembers.id, params.memberId))
		.get();
	if (!member || member.campaignId !== params.campaignId) {
		return { ok: false, status: 404, message: 'Member not found in this campaign' };
	}

	await db
		.update(campaignMembers)
		.set({ leftAt: now })
		.where(eq(campaignMembers.id, params.memberId));
	return { ok: true };
}

export interface ActiveMembership {
	memberId: string;
	campaignId: string;
	campaignName: string;
}

/**
 * Returns the campaigns where this investigator is currently an active
 * member. Used by the sheet page loader so the roll-emission helper can
 * mirror rolls into each campaign log.
 */
export async function listActiveMembershipsForInvestigator(
	db: AppDb,
	params: { investigatorId: string }
): Promise<ActiveMembership[]> {
	const rows = await db
		.select({
			memberId: campaignMembers.id,
			campaignId: campaigns.id,
			campaignName: campaigns.name
		})
		.from(campaignMembers)
		.innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
		.where(
			and(
				eq(campaignMembers.investigatorId, params.investigatorId),
				isNull(campaignMembers.leftAt)
			)
		);
	return rows;
}
