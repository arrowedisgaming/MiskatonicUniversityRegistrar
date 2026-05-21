import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import { recordEvent } from '$lib/server/analytics';

/**
 * POST /api/events/pdf — best-effort tracking pixel for client-side PDF exports.
 * Called fire-and-forget from PDFExportButton after the download is triggered.
 * Always returns 204; never reveals validation failures so it can't be probed.
 */
export const POST: RequestHandler = async (event) => {
	try {
		const userId = await ensureUser(event);
		const db = await getDb(event);
		await recordEvent(db, { userId, eventType: 'pdf_generated' });
	} catch {
		// Swallow — analytics must never affect user UX, and we don't want this
		// endpoint to leak auth state to unauthenticated callers.
	}
	return new Response(null, { status: 204 });
};
