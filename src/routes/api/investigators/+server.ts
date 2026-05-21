import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { investigators } from '$lib/server/db/schema';
import { ensureUser } from '$lib/server/auth';
import { recordEvent } from '$lib/server/analytics';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createInvestigatorSchema } from '$lib/schemas/character.schema';
import { validateFinalInvestigator } from '$lib/server/validation/investigator';

/** GET /api/investigators — list user's investigators */
export const GET: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);

	const rows = await db
		.select({
			id: investigators.id,
			name: investigators.name,
			era: investigators.era,
			mode: investigators.mode,
			occupation: investigators.occupation,
			isDraft: investigators.isDraft,
			isArchived: investigators.isArchived,
			createdAt: investigators.createdAt,
			updatedAt: investigators.updatedAt
		})
		.from(investigators)
		.where(and(eq(investigators.userId, userId), eq(investigators.isArchived, false)))
		.orderBy(desc(investigators.updatedAt));

	return json(rows);
};

/** POST /api/investigators — create new investigator */
export const POST: RequestHandler = async (event) => {
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
	const char = parsed.data.character as unknown as import('$lib/types/character').CoCCharacterData;

	if (!char.isDraft) {
		const ruleCheck = validateFinalInvestigator(char, { phase: 'creation' });
		if (!ruleCheck.valid) {
			throw error(400, `Game-rule violation: ${ruleCheck.errors.join('; ')}`);
		}
	}

	const id = nanoid();
	const now = new Date();

	await db.insert(investigators).values({
		id,
		userId,
		name: char.name || 'Unnamed Investigator',
		era: char.era,
		mode: char.mode,
		occupation: char.occupation?.occupationId ?? '',
		data: JSON.stringify(char),
		isDraft: char.isDraft,
		isArchived: false,
		createdAt: now,
		updatedAt: now
	});

	await recordEvent(db, {
		userId,
		eventType: 'investigator_created',
		metadata: { era: char.era, mode: char.mode, isDraft: char.isDraft }
	});

	return json({ id }, { status: 201 });
};
