import type { LayoutServerLoad } from './$types';
import { checkIsAdmin } from '$lib/server/admin';

export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();
	const isAdmin = session?.user ? await checkIsAdmin(event) : false;
	return { session, isAdmin };
};
