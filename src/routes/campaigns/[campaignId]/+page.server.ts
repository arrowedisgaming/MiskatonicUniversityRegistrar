import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import { getCampaignForUser } from '$lib/server/campaign/campaign';
import {
	listCampaignRolls,
	summarizeCampaignDashboard
} from '$lib/server/campaign/rolls';
import { getEquipment } from '$lib/server/content/loader';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, `/login?callbackUrl=${encodeURIComponent(event.url.pathname)}`);
	}
	const db = await getDb(event);
	const userId = await ensureUser(event);

	const cr = await getCampaignForUser(db, { campaignId: event.params.campaignId, userId });
	if (!cr.ok) throw error(cr.status, cr.message);

	// Initial dashboard + roll log so first paint is fully populated.
	// Polling on the client tops these up after 5s. Pass the userId so each
	// vitals row carries the `belongsToCaller` flag the UI uses to gate the
	// "Open full sheet" link — the sheet route only loads investigators
	// owned by the caller, so linking another member's id would 404.
	const [dashboard, rolls] = await Promise.all([
		summarizeCampaignDashboard(db, cr.campaign.id, userId),
		listCampaignRolls(db, { campaignId: cr.campaign.id, limit: 50 })
	]);

	// Equipment pack feeds the Keeper inventory autocomplete. Only sent to
	// keepers — players have no UI that reads it on this page, so we save
	// the bandwidth.
	const equipment = cr.role === 'keeper' ? getEquipment() : null;

	return {
		campaign: {
			id: cr.campaign.id,
			name: cr.campaign.name,
			description: cr.campaign.description,
			isOpen: cr.campaign.isOpen,
			// share token only surfaced to the keeper — players never see it
			shareId: cr.role === 'keeper' ? cr.campaign.shareId : null
		},
		role: cr.role,
		dashboard,
		rolls,
		equipment
	};
};
