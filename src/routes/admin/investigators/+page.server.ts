import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { listInvestigators } from '$lib/server/admin-queries';

export const load: PageServerLoad = async (event) => {
	const db = await getDb(event);
	const search = event.url.searchParams.get('q')?.trim() || undefined;
	const userId = event.url.searchParams.get('userId')?.trim() || undefined;
	const page = Number.parseInt(event.url.searchParams.get('page') ?? '1', 10);
	const result = await listInvestigators(db, {
		search,
		userId,
		page: Number.isFinite(page) ? page : 1
	});
	return { ...result, search: search ?? '', userId: userId ?? '' };
};
