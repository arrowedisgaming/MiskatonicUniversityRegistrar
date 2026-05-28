import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { listRecentAudit, parseListSort, type SortDir } from '$lib/server/admin-queries';

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
	const sort = event.url.searchParams.get('sort') ?? undefined;
	const dir = parseDir(event.url.searchParams.get('dir'));
	const page = parsePage(event.url.searchParams.get('page'));
	const result = await listRecentAudit(db, { page, sort, dir });
	const parsed = parseListSort(sort, dir, ['when', 'who', 'method', 'path', 'ip'], 'when');
	return { ...result, sort: parsed.sort, dir: parsed.dir };
};
