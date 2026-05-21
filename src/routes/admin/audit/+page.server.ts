import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { listRecentAudit } from '$lib/server/admin-queries';

export const load: PageServerLoad = async (event) => {
	const db = await getDb(event);
	const rows = await listRecentAudit(db, { limit: 200 });
	return { rows };
};
