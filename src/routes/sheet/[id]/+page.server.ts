import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { investigators } from '$lib/server/db/schema';
import { ensureUser } from '$lib/server/auth';
import { checkIsAdmin, ensureAdminStepUp, recordAdminAccess } from '$lib/server/admin';
import { eq, and } from 'drizzle-orm';
import type { CoCCharacterData } from '$lib/types/character';
import { getContentPack, getEquipment, getOccupations, getSkills } from '$lib/server/content/loader';
import { migrateCharacterData } from '$lib/engine/character-migration';
import { listActiveMembershipsForInvestigator } from '$lib/server/campaign/membership';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, `/login?callbackUrl=${encodeURIComponent(event.url.pathname)}`);
	}

	const db = await getDb(event);
	const userId = await ensureUser(event);

	let row = await db
		.select()
		.from(investigators)
		.where(and(eq(investigators.id, event.params.id), eq(investigators.userId, userId)))
		.get();

	let adminView = false;
	if (!row) {
		// Admin override: allow viewing any investigator with a forensic audit
		// trail. The step-up window is enforced here so the override can't
		// bypass the same recency gate that protects /admin itself — a stale
		// session must re-auth before reading another user's data.
		const isAdmin = await checkIsAdmin(event);
		if (isAdmin) {
			await ensureAdminStepUp(event);
			row = await db
				.select()
				.from(investigators)
				.where(eq(investigators.id, event.params.id))
				.get();
			if (row) {
				adminView = row.userId !== userId;
				if (adminView) {
					await recordAdminAccess(event, userId);
				}
			}
		}
	}

	if (!row) throw error(404, 'Investigator not found');

	const occupations = getOccupations();
	const skills = getSkills();
	const contentPack = getContentPack();
	const equipment = getEquipment();

	// Active campaigns this investigator is in, so the sheet can mirror rolls
	// into each campaign log via emitCampaignRoll. Empty for solo play —
	// emitCampaignRoll iterates 0 times and is effectively a no-op.
	// Skipped for the admin-view path: a step-up admin shouldn't accidentally
	// leak rolls into other people's campaign logs by clicking around.
	const activeCampaigns = adminView
		? []
		: await listActiveMembershipsForInvestigator(db, { investigatorId: row.id });

	return {
		investigator: {
			id: row.id,
			character: migrateCharacterData(JSON.parse(row.data)) as CoCCharacterData,
			shareId: row.shareId,
			isPublic: row.isPublic,
			/**
			 * ms-since-epoch — passed back as `expectedUpdatedAt` on PUT so the
			 * player's auto-save can't silently overwrite a keeper-inventory push
			 * that landed between this load and the save. On 409 the sheet page
			 * refetches and retries; the play overlay survives because it lives
			 * in $state, not in the loader payload.
			 */
			updatedAt: row.updatedAt.getTime()
		},
		contentPack,
		occupations,
		skills,
		equipment,
		adminView,
		activeCampaigns
	};
};
