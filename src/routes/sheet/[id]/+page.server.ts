import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { investigators } from '$lib/server/db/schema';
import { ensureUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import type { CoCCharacterData } from '$lib/types/character';
import { getOccupations } from '$lib/server/content/loader';
import { migrateCharacterData } from '$lib/engine/character-migration';

export const load: PageServerLoad = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(db);

	const row = await db
		.select()
		.from(investigators)
		.where(and(eq(investigators.id, event.params.id), eq(investigators.userId, userId)))
		.get();

	if (!row) throw error(404, 'Investigator not found');

	const occupations = getOccupations();

	return {
		investigator: {
			id: row.id,
			character: migrateCharacterData(JSON.parse(row.data)) as CoCCharacterData
		},
		occupations
	};
};
