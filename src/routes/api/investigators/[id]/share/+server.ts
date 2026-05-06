import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import {
	disableInvestigatorShare,
	enableInvestigatorShare
} from '$lib/server/investigator/share';

/**
 * POST /api/investigators/:id/share — enable sharing on a finished investigator.
 * Mints a fresh share token (rotate semantics: each enable replaces any prior token).
 * Refuses for drafts; the public read view is intended for completed sheets only.
 */
export const POST: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);

	const result = await enableInvestigatorShare(db, {
		investigatorId: event.params.id,
		userId
	});

	if (!result.ok) throw error(result.status, result.message);

	return json({
		shareId: result.shareId,
		shareUrl: `${event.url.origin}/s/${result.shareId}`
	});
};

/**
 * DELETE /api/investigators/:id/share — disable sharing.
 * Clears the token so the existing public URL stops resolving immediately.
 */
export const DELETE: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);

	const result = await disableInvestigatorShare(db, {
		investigatorId: event.params.id,
		userId
	});

	if (!result.ok) throw error(result.status, result.message);

	return new Response(null, { status: 204 });
};
