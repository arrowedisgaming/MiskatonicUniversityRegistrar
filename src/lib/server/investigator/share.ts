import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { investigators } from '$lib/server/db/schema';
import type { AppDb } from '$lib/server/db';
import type { CoCCharacterData } from '$lib/types/character';
import { migrateCharacterData } from '$lib/engine/character-migration';

/**
 * Token length for public share URLs. 16 chars from the nanoid alphabet
 * gives ~95 bits of entropy — unguessable in practice while keeping
 * shared URLs friendlier than the 21-char primary keys.
 */
export const SHARE_ID_LENGTH = 16;

export type EnableShareResult =
	| { ok: true; shareId: string }
	| { ok: false; status: 404 | 409; message: string };

/**
 * Enable sharing on a finished investigator. Mints a fresh share token
 * (rotate semantics — calling this on an already-shared investigator
 * replaces the existing token, invalidating the old URL).
 *
 * Pure with respect to side effects beyond the DB; the route handler
 * builds the public URL from `event.url.origin`.
 */
export async function enableInvestigatorShare(
	db: AppDb,
	params: { investigatorId: string; userId: string },
	now: Date = new Date()
): Promise<EnableShareResult> {
	const existing = await db
		.select({ id: investigators.id, isDraft: investigators.isDraft })
		.from(investigators)
		.where(
			and(eq(investigators.id, params.investigatorId), eq(investigators.userId, params.userId))
		)
		.get();

	if (!existing) {
		return { ok: false, status: 404, message: 'Investigator not found' };
	}
	if (existing.isDraft) {
		return {
			ok: false,
			status: 409,
			message: 'Drafts cannot be shared. Finish the investigator first.'
		};
	}

	const shareId = nanoid(SHARE_ID_LENGTH);

	await db
		.update(investigators)
		.set({ shareId, isPublic: true, updatedAt: now })
		.where(eq(investigators.id, params.investigatorId));

	return { ok: true, shareId };
}

export type DisableShareResult =
	| { ok: true }
	| { ok: false; status: 404; message: string };

/**
 * Disable sharing on an investigator. Clears the share token so the
 * existing public URL stops resolving immediately. Idempotent — calling
 * this on an investigator that is not currently shared still succeeds.
 */
export async function disableInvestigatorShare(
	db: AppDb,
	params: { investigatorId: string; userId: string },
	now: Date = new Date()
): Promise<DisableShareResult> {
	const existing = await db
		.select({ id: investigators.id })
		.from(investigators)
		.where(
			and(eq(investigators.id, params.investigatorId), eq(investigators.userId, params.userId))
		)
		.get();

	if (!existing) {
		return { ok: false, status: 404, message: 'Investigator not found' };
	}

	await db
		.update(investigators)
		.set({ shareId: null, isPublic: false, updatedAt: now })
		.where(eq(investigators.id, params.investigatorId));

	return { ok: true };
}

export type SharedInvestigatorPayload = {
	character: CoCCharacterData;
};

/**
 * Public lookup by share token. Returns the migrated character payload
 * when the investigator exists, is currently shared, and is not archived.
 * Filtering on `isArchived = false` keeps soft-deleted investigators off
 * their old public URLs even if the owner archived without first toggling
 * sharing off. Never returns `userId` or any other owner-private fields —
 * the share token is the only identifier the visitor sees.
 */
export async function loadSharedInvestigator(
	db: AppDb,
	shareId: string
): Promise<SharedInvestigatorPayload | null> {
	const row = await db
		.select({ data: investigators.data })
		.from(investigators)
		.where(
			and(
				eq(investigators.shareId, shareId),
				eq(investigators.isPublic, true),
				eq(investigators.isArchived, false)
			)
		)
		.get();

	if (!row) return null;

	const character = migrateCharacterData(JSON.parse(row.data)) as CoCCharacterData;
	return { character };
}
