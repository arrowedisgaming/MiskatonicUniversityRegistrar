import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { investigators } from '$lib/server/db/schema';
import { ensureUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import type { CoCCharacterData } from '$lib/types/character';
import { getOccupations } from '$lib/server/content/loader';
import { exportToJSON } from '$lib/export/json-export';
import { exportToMarkdown } from '$lib/export/markdown-export';
import { migrateCharacterData } from '$lib/engine/character-migration';

/** GET /api/export/:id?format=json|md
 *  PDF is generated client-side via pdfmake (see sheet page).
 */
export const GET: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(db);
	const format = event.url.searchParams.get('format') ?? 'json';

	const row = await db
		.select()
		.from(investigators)
		.where(and(eq(investigators.id, event.params.id), eq(investigators.userId, userId)))
		.get();

	if (!row) throw error(404, 'Investigator not found');

	const character = migrateCharacterData(JSON.parse(row.data)) as CoCCharacterData;
	const occupations = getOccupations();
	const occupationName = occupations.find((o) => o.id === character.occupation?.occupationId)?.name ?? 'Unknown';
	const safeName = (character.name || 'investigator').replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');

	switch (format) {
		case 'json': {
			const exported = exportToJSON(character);
			return json(exported, {
				headers: {
					'Content-Disposition': `attachment; filename="${safeName}.json"`
				}
			});
		}

		case 'md': {
			const markdown = exportToMarkdown(character, occupationName);
			return new Response(markdown, {
				headers: {
					'Content-Type': 'text/markdown; charset=utf-8',
					'Content-Disposition': `attachment; filename="${safeName}.md"`
				}
			});
		}

		default:
			throw error(400, `Unknown format: ${format}. Use json or md. PDF is generated client-side.`);
	}
};
