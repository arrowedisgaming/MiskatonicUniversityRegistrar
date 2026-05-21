import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
	getDailyEventCounts,
	getOverviewStats,
	getProviderBreakdown
} from '$lib/server/admin-queries';

export const load: PageServerLoad = async (event) => {
	const db = await getDb(event);
	const [overview, providers, logins, creations, pdfs] = await Promise.all([
		getOverviewStats(db),
		getProviderBreakdown(db),
		getDailyEventCounts(db, 'login', 30),
		getDailyEventCounts(db, 'investigator_created', 30),
		getDailyEventCounts(db, 'pdf_generated', 30)
	]);
	return { overview, providers, logins, creations, pdfs };
};
