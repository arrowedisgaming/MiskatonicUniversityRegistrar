import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { listUsers } from '$lib/server/admin-queries';

export const load: PageServerLoad = async (event) => {
	const db = await getDb(event);
	const search = event.url.searchParams.get('q')?.trim() || undefined;
	const page = Number.parseInt(event.url.searchParams.get('page') ?? '1', 10);
	const result = await listUsers(db, { search, page: Number.isFinite(page) ? page : 1 });
	return { ...result, search: search ?? '' };
};
