import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { investigators } from '$lib/server/db/schema';
import { ensureUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import type { CoCCharacterData } from '$lib/types/character';
import { getOccupations } from '$lib/server/content/loader';

export const load: PageServerLoad = async ({ params }) => {
	const userId = ensureUser();

	const row = await db
		.select()
		.from(investigators)
		.where(and(eq(investigators.id, params.id), eq(investigators.userId, userId)))
		.get();

	if (!row) throw error(404, 'Investigator not found');

	const occupations = getOccupations();

	return {
		investigator: {
			id: row.id,
			character: JSON.parse(row.data) as CoCCharacterData
		},
		occupations
	};
};
