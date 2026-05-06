import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { investigators } from '$lib/server/db/schema';
import { ensureUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import type { CoCCharacterData } from '$lib/types/character';
import { getContentPack, getEquipment, getOccupations, getSkills } from '$lib/server/content/loader';
import { migrateCharacterData } from '$lib/engine/character-migration';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, `/login?callbackUrl=${encodeURIComponent(event.url.pathname)}`);
	}

	const db = await getDb(event);
	const userId = await ensureUser(event);

	const row = await db
		.select()
		.from(investigators)
		.where(and(eq(investigators.id, event.params.id), eq(investigators.userId, userId)))
		.get();

	if (!row) throw error(404, 'Investigator not found');

	const occupations = getOccupations();
	const skills = getSkills();
	const contentPack = getContentPack();
	const equipment = getEquipment();

	return {
		investigator: {
			id: row.id,
			character: migrateCharacterData(JSON.parse(row.data)) as CoCCharacterData
		},
		contentPack,
		occupations,
		skills,
		equipment
	};
};
