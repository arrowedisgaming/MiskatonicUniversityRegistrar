import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getContentPack, getOccupations, getSkills } from '$lib/server/content/loader';
import { loadSharedInvestigator } from '$lib/server/investigator/share';

/**
 * Public read-only investigator view, looked up by share token.
 *
 * Intentionally:
 *   - does NOT call `ensureUser` — anonymous visitors must be able to load.
 *   - looks up by `shareId` + `isPublic = true` — owner can revoke instantly.
 *   - returns no `userId` and no internal primary `id` — the share token is
 *     the only identifier the visitor ever sees.
 */
export const load: PageServerLoad = async (event) => {
	const db = await getDb(event);

	const payload = await loadSharedInvestigator(db, event.params.shareId);
	if (!payload) throw error(404, 'Shared investigator not found');

	return {
		character: payload.character,
		contentPack: getContentPack(),
		occupations: getOccupations(),
		skills: getSkills()
	};
};
