import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { investigators } from '$lib/server/db/schema';
import { ensureUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { CoCCharacterData } from '$lib/types/character';

/** POST /api/investigators/:id/duplicate — duplicate an investigator */
export const POST: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(db);

	const original = await db
		.select()
		.from(investigators)
		.where(and(eq(investigators.id, event.params.id), eq(investigators.userId, userId)))
		.get();

	if (!original) throw error(404, 'Investigator not found');

	const charData = JSON.parse(original.data) as CoCCharacterData;
	charData.name = `${charData.name} (Copy)`;

	const id = nanoid();
	const now = new Date();

	await db.insert(investigators).values({
		id,
		userId,
		name: charData.name,
		era: original.era,
		mode: original.mode,
		occupation: original.occupation,
		data: JSON.stringify(charData),
		isDraft: original.isDraft,
		isArchived: false,
		createdAt: now,
		updatedAt: now
	});

	return json({ id }, { status: 201 });
};
