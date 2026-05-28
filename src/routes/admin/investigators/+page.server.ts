import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { listInvestigators, parseListSort, type SortDir } from '$lib/server/admin-queries';

function parsePage(raw: string | null): number {
	const page = Number.parseInt(raw ?? '1', 10);
	return Number.isFinite(page) ? page : 1;
}

function parseDir(raw: string | null): SortDir | undefined {
	if (raw === 'asc' || raw === 'desc') return raw;
	return undefined;
}

export const load: PageServerLoad = async (event) => {
	const db = await getDb(event);
	const search = event.url.searchParams.get('q')?.trim() || undefined;
	const userId = event.url.searchParams.get('userId')?.trim() || undefined;
	const sort = event.url.searchParams.get('sort') ?? undefined;
	const dir = parseDir(event.url.searchParams.get('dir'));
	const page = parsePage(event.url.searchParams.get('page'));
	const result = await listInvestigators(db, {
		search,
		userId,
		page,
		sort,
		dir
	});
	const parsed = parseListSort(
		sort,
		dir,
		['name', 'owner', 'era', 'occupation', 'status', 'created', 'updated'],
		'updated'
	);
	return { ...result, search: search ?? '', userId: userId ?? '', sort: parsed.sort, dir: parsed.dir };
};
