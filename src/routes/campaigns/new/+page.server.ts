import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, `/login?callbackUrl=${encodeURIComponent(event.url.pathname)}`);
	}
	return {};
};
