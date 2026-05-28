import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import {
	listJoinableInvestigators,
	resolveCampaignByShareId
} from '$lib/server/campaign/share';
import { eq, and, isNull } from 'drizzle-orm';
import { campaignMembers } from '$lib/server/db/schema';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		// Round-trip through login — verified at src/routes/login/+page.svelte:12
		throw redirect(303, `/login?callbackUrl=${encodeURIComponent(event.url.pathname)}`);
	}

	const db = await getDb(event);
	const userId = await ensureUser(event);

	const resolved = await resolveCampaignByShareId(db, event.params.shareId);
	if (!resolved.ok) throw error(resolved.status, resolved.message);

	// If the user already has any active membership in this campaign, send
	// them straight to the campaign page rather than offer to "join" again.
	const existing = await db
		.select({ id: campaignMembers.id })
		.from(campaignMembers)
		.where(
			and(
				eq(campaignMembers.campaignId, resolved.campaign.id),
				eq(campaignMembers.userId, userId),
				isNull(campaignMembers.leftAt)
			)
		)
		.get();
	if (existing) {
		throw redirect(303, `/campaigns/${resolved.campaign.id}`);
	}

	const investigators = await listJoinableInvestigators(db, {
		campaignId: resolved.campaign.id,
		userId
	});

	return {
		campaign: {
			id: resolved.campaign.id,
			name: resolved.campaign.name,
			description: resolved.campaign.description
		},
		shareId: event.params.shareId,
		investigators
	};
};
