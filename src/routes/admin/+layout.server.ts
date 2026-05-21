import type { LayoutServerLoad } from './$types';
import { ensureAdmin } from '$lib/server/admin';

export const load: LayoutServerLoad = async (event) => {
	await ensureAdmin(event);
	const session = await event.locals.auth();

	event.setHeaders({
		'X-Robots-Tag': 'noindex, nofollow, noarchive',
		'Cache-Control': 'no-store, private, max-age=0'
	});

	return { adminEmail: session?.user?.email ?? null };
};
