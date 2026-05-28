import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import { removeMember } from '$lib/server/campaign/membership';

/** DELETE /api/campaigns/:id/members/:memberId — keeper soft-removes a player */
export const DELETE: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);
	const r = await removeMember(db, {
		campaignId: event.params.id,
		memberId: event.params.memberId,
		keeperUserId: userId
	});
	if (!r.ok) throw error(r.status, r.message);
	return new Response(null, { status: 204 });
};
