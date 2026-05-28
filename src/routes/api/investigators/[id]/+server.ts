import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { investigators } from '$lib/server/db/schema';
import { ensureUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import type { CoCCharacterData } from '$lib/types/character';
import { createInvestigatorSchema } from '$lib/schemas/character.schema';
import { migrateCharacterData } from '$lib/engine/character-migration';
import { validateFinalInvestigator } from '$lib/server/validation/investigator';

/** GET /api/investigators/:id — get full investigator */
export const GET: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);

	const row = await db
		.select()
		.from(investigators)
		.where(and(eq(investigators.id, event.params.id), eq(investigators.userId, userId)))
		.get();

	if (!row) throw error(404, 'Investigator not found');

	return json({
		...row,
		data: migrateCharacterData(JSON.parse(row.data)) as CoCCharacterData
	});
};

/**
 * PUT /api/investigators/:id — update investigator.
 *
 * Optional `expectedUpdatedAt` precondition (ms-since-epoch). When supplied,
 * the write is rejected with 409 + `{ currentUpdatedAt }` if the row's
 * `updatedAt` has moved since the client loaded it. This is symmetric with
 * the keeper-inventory push at src/lib/server/campaign/inventory.ts:170,
 * which also uses optimistic concurrency; without it, a player auto-saving
 * (e.g. after a roll) could silently overwrite keeper-added items pushed
 * between the player's last load and their next save.
 *
 * Legacy clients that omit the field continue to work unchanged — the
 * precondition is opt-in for callers (notably the sheet page) that need
 * the guarantee.
 */
export const PUT: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);

	let rawBody: unknown;
	try {
		rawBody = await event.request.json();
	} catch {
		throw error(400, 'Request body is not valid JSON');
	}
	const parsed = createInvestigatorSchema.safeParse(rawBody);
	if (!parsed.success) {
		throw error(400, `Invalid character data: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
	}
	const char = parsed.data.character as unknown as CoCCharacterData;

	// expectedUpdatedAt rides alongside the schema-parsed body — we read it
	// directly so we don't have to widen the existing schema.
	const expectedUpdatedAt =
		rawBody && typeof rawBody === 'object' && 'expectedUpdatedAt' in rawBody
			? (rawBody as { expectedUpdatedAt?: unknown }).expectedUpdatedAt
			: undefined;

	if (!char.isDraft) {
		const ruleCheck = validateFinalInvestigator(char);
		if (!ruleCheck.valid) {
			throw error(400, `Game-rule violation: ${ruleCheck.errors.join('; ')}`);
		}
	}

	const existing = await db
		.select({ id: investigators.id, updatedAt: investigators.updatedAt })
		.from(investigators)
		.where(and(eq(investigators.id, event.params.id), eq(investigators.userId, userId)))
		.get();

	if (!existing) throw error(404, 'Investigator not found');

	if (typeof expectedUpdatedAt === 'number') {
		if (existing.updatedAt.getTime() !== expectedUpdatedAt) {
			// Caller is working from a stale snapshot. Returning 409 directly
			// (not via SvelteKit error()) lets the body carry currentUpdatedAt
			// so the client can refetch and retry.
			return json(
				{
					message: 'Investigator was updated by someone else — refetch and retry',
					currentUpdatedAt: existing.updatedAt.getTime()
				},
				{ status: 409 }
			);
		}
	}

	// Force a monotonically-advancing updatedAt at second precision so the
	// next optimistic-concurrency comparison can detect this write. Mirrors
	// inventory.addItemsToMember's nextSec logic at inventory.ts:172-178.
	const now = new Date();
	const nextSec = Math.max(
		Math.floor(now.getTime() / 1000),
		Math.floor(existing.updatedAt.getTime() / 1000) + 1
	);
	const nextUpdatedAt = new Date(nextSec * 1000);

	await db
		.update(investigators)
		.set({
			name: char.name || 'Unnamed Investigator',
			era: char.era,
			mode: char.mode,
			occupation: char.occupation?.occupationId ?? '',
			data: JSON.stringify(char),
			isDraft: char.isDraft,
			updatedAt: nextUpdatedAt
		})
		.where(eq(investigators.id, event.params.id));

	return json({ success: true, updatedAt: nextUpdatedAt.getTime() });
};

/** DELETE /api/investigators/:id — archive (soft delete) */
export const DELETE: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);

	const existing = await db
		.select({ id: investigators.id })
		.from(investigators)
		.where(and(eq(investigators.id, event.params.id), eq(investigators.userId, userId)))
		.get();

	if (!existing) throw error(404, 'Investigator not found');

	await db
		.update(investigators)
		.set({ isArchived: true, updatedAt: new Date() })
		.where(eq(investigators.id, event.params.id));

	return json({ success: true });
};
