import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Bookmarks to the old full-page dice settings land here. */
export const load: PageLoad = () => {
	throw redirect(302, '/');
};
