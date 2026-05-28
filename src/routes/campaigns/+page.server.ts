import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import { listCampaignsForUser } from '$lib/server/campaign/campaign';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, `/login?callbackUrl=${encodeURIComponent(event.url.pathname)}`);
	}
	const db = await getDb(event);
	const userId = await ensureUser(event);
	const campaigns = await listCampaignsForUser(db, userId);
	return { campaigns };
};
