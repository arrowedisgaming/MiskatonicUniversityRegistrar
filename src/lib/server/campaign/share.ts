import { and, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AppDb } from '$lib/server/db';
import {
	campaignMembers,
	campaigns,
	investigators
} from '$lib/server/db/schema';

/**
 * Same length as `src/lib/server/investigator/share.ts` — 16 chars over the
 * nanoid alphabet is ~95 bits and stays under-2x the size of our nanoid PKs
 * so URLs remain shareable.
 */
export const CAMPAIGN_SHARE_ID_LENGTH = 16;

/**
 * Retry budget for the nanoid uniqueness collision case. At 95 bits a
 * collision is astronomically unlikely, but defensive code makes the
 * failure mode deterministic instead of bubbling up a raw SQLite error
 * when it inevitably happens once in 2^47 mints.
 */
export const MAX_TOKEN_GENERATION_ATTEMPTS = 4;

export type EnableCampaignShareResult =
	| { ok: true; shareId: string }
	| { ok: false; status: 404 | 403 | 500; message: string };

/**
 * Allow a custom generator to be injected for testing the collision-retry
 * path. Production callers leave this unset and get the default nanoid.
 */
export interface ShareTokenGenerator {
	(): string;
}

const defaultGenerator: ShareTokenGenerator = () => nanoid(CAMPAIGN_SHARE_ID_LENGTH);

/**
 * Mint a fresh share token for the campaign. Rotate semantics: calling
 * twice replaces the prior token (and invalidates the prior URL). Only
 * the Keeper may rotate.
 *
 * On the (extremely rare) unique-index collision, retries with a new
 * token up to MAX_TOKEN_GENERATION_ATTEMPTS times. After that, returns
 * 500 so the caller sees a clean error rather than the raw SQLite
 * constraint string.
 */
export async function enableCampaignShare(
	db: AppDb,
	params: { campaignId: string; userId: string },
	now: Date = new Date(),
	generate: ShareTokenGenerator = defaultGenerator
): Promise<EnableCampaignShareResult> {
	const existing = await db
		.select({ keeperUserId: campaigns.keeperUserId })
		.from(campaigns)
		.where(eq(campaigns.id, params.campaignId))
		.get();

	if (!existing) return { ok: false, status: 404, message: 'Campaign not found' };
	if (existing.keeperUserId !== params.userId) {
		return { ok: false, status: 403, message: 'Keeper only' };
	}

	for (let attempt = 0; attempt < MAX_TOKEN_GENERATION_ATTEMPTS; attempt++) {
		const shareId = generate();
		try {
			await db
				.update(campaigns)
				.set({ shareId, updatedAt: now })
				.where(eq(campaigns.id, params.campaignId));
			return { ok: true, shareId };
		} catch (err) {
			// Drizzle surfaces SQLite uniqueness violations as Error.message
			// containing "UNIQUE constraint failed". On any other error, rethrow.
			if (!isUniqueConstraintViolation(err)) throw err;
			// loop and retry with a new token
		}
	}
	return {
		ok: false,
		status: 500,
		message: 'Failed to mint a unique share token after several attempts'
	};
}

function isUniqueConstraintViolation(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const message = (err as { message?: unknown }).message;
	return typeof message === 'string' && message.includes('UNIQUE constraint failed');
}

export type DisableCampaignShareResult =
	| { ok: true }
	| { ok: false; status: 404 | 403; message: string };

/**
 * Clear the share token. Idempotent — disabling a campaign that already
 * has no token still returns ok. Only the Keeper may disable.
 */
export async function disableCampaignShare(
	db: AppDb,
	params: { campaignId: string; userId: string },
	now: Date = new Date()
): Promise<DisableCampaignShareResult> {
	const existing = await db
		.select({ keeperUserId: campaigns.keeperUserId })
		.from(campaigns)
		.where(eq(campaigns.id, params.campaignId))
		.get();
	if (!existing) return { ok: false, status: 404, message: 'Campaign not found' };
	if (existing.keeperUserId !== params.userId) {
		return { ok: false, status: 403, message: 'Keeper only' };
	}

	await db
		.update(campaigns)
		.set({ shareId: null, updatedAt: now })
		.where(eq(campaigns.id, params.campaignId));
	return { ok: true };
}

export type ResolveCampaignByShareIdResult =
	| {
			ok: true;
			campaign: typeof campaigns.$inferSelect;
	  }
	| { ok: false; status: 404; message: string };

/**
 * Look up a campaign by its share token. Returns 404 — and crucially the
 * same 404 — for unknown tokens, closed campaigns, and a missing token, so
 * a probing attacker can't distinguish them.
 */
export async function resolveCampaignByShareId(
	db: AppDb,
	shareId: string
): Promise<ResolveCampaignByShareIdResult> {
	if (!shareId) return { ok: false, status: 404, message: 'Campaign not found' };
	const row = await db
		.select()
		.from(campaigns)
		.where(and(eq(campaigns.shareId, shareId), eq(campaigns.isOpen, true)))
		.get();
	if (!row) return { ok: false, status: 404, message: 'Campaign not found' };
	return { ok: true, campaign: row };
}

/**
 * Lists the calling user's finished investigators that are NOT already
 * actively in this campaign. Used by the join page to populate the
 * "pick a character" dropdown.
 */
export async function listJoinableInvestigators(
	db: AppDb,
	params: { campaignId: string; userId: string }
): Promise<
	Array<{
		id: string;
		name: string;
		occupation: string;
		era: string;
	}>
> {
	const owned = await db
		.select({
			id: investigators.id,
			name: investigators.name,
			occupation: investigators.occupation,
			era: investigators.era
		})
		.from(investigators)
		.where(
			and(
				eq(investigators.userId, params.userId),
				eq(investigators.isArchived, false),
				eq(investigators.isDraft, false)
			)
		);

	const alreadyIn = await db
		.select({ investigatorId: campaignMembers.investigatorId })
		.from(campaignMembers)
		.where(
			and(
				eq(campaignMembers.campaignId, params.campaignId),
				eq(campaignMembers.userId, params.userId),
				isNull(campaignMembers.leftAt)
			)
		);

	const blocked = new Set(alreadyIn.map((r) => r.investigatorId));
	return owned.filter((i) => !blocked.has(i.id));
}
