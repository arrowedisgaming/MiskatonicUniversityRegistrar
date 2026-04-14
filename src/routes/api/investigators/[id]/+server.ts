import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { investigators } from '$lib/server/db/schema';
import { ensureUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import type { CoCCharacterData } from '$lib/types/character';
import { createInvestigatorSchema } from '$lib/schemas/character.schema';

/** GET /api/investigators/:id — get full investigator */
export const GET: RequestHandler = async ({ params }) => {
	const userId = ensureUser();

	const row = await db
		.select()
		.from(investigators)
		.where(and(eq(investigators.id, params.id), eq(investigators.userId, userId)))
		.get();

	if (!row) throw error(404, 'Investigator not found');

	return json({
		...row,
		data: JSON.parse(row.data) as CoCCharacterData
	});
};

/** PUT /api/investigators/:id — update investigator */
export const PUT: RequestHandler = async ({ params, request }) => {
	const userId = ensureUser();

	const rawBody = await request.json();
	const parsed = createInvestigatorSchema.safeParse(rawBody);
	if (!parsed.success) {
		throw error(400, `Invalid character data: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
	}
	const char = parsed.data.character;

	const existing = await db
		.select({ id: investigators.id })
		.from(investigators)
		.where(and(eq(investigators.id, params.id), eq(investigators.userId, userId)))
		.get();

	if (!existing) throw error(404, 'Investigator not found');

	await db
		.update(investigators)
		.set({
			name: char.name || 'Unnamed Investigator',
			era: char.era,
			mode: char.mode,
			occupation: char.occupation?.occupationId ?? '',
			data: JSON.stringify(char),
			isDraft: char.isDraft,
			updatedAt: new Date()
		})
		.where(eq(investigators.id, params.id));

	return json({ success: true });
};

/** DELETE /api/investigators/:id — archive (soft delete) */
export const DELETE: RequestHandler = async ({ params }) => {
	const userId = ensureUser();

	const existing = await db
		.select({ id: investigators.id })
		.from(investigators)
		.where(and(eq(investigators.id, params.id), eq(investigators.userId, userId)))
		.get();

	if (!existing) throw error(404, 'Investigator not found');

	await db
		.update(investigators)
		.set({ isArchived: true, updatedAt: new Date() })
		.where(eq(investigators.id, params.id));

	return json({ success: true });
};
