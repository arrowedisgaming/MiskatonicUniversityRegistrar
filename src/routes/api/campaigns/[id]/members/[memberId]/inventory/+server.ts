import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import { eq } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';
import { addItemsToMember } from '$lib/server/campaign/inventory';
import { inventoryDeltaSchema } from '$lib/schemas/campaign.schema';

/**
 * POST /api/campaigns/:id/members/:memberId/inventory
 * Body: { expectedUpdatedAt, add: { weapons?, items?, cashDelta? } }
 *
 * Server-side merge with optimistic concurrency — see
 * src/lib/server/campaign/inventory.ts for the rationale. The keeper's
 * display name is fetched server-side rather than trusted from the body so
 * the "Keeper added X" event in the campaign log can't be spoofed.
 */
export const POST: RequestHandler = async (event) => {
	const db = await getDb(event);
	const userId = await ensureUser(event);

	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw error(400, 'Request body is not valid JSON');
	}
	const parsed = inventoryDeltaSchema.safeParse(raw);
	if (!parsed.success) {
		throw error(400, `Invalid inventory delta: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
	}

	const keeper = await db
		.select({ name: users.name })
		.from(users)
		.where(eq(users.id, userId))
		.get();
	const keeperDisplayName = keeper?.name ?? 'Keeper';

	const result = await addItemsToMember(db, {
		campaignId: event.params.id,
		memberId: event.params.memberId,
		keeperUserId: userId,
		keeperDisplayName,
		delta: parsed.data.add,
		expectedUpdatedAt: parsed.data.expectedUpdatedAt
	});
	if (!result.ok) {
		// 409 carries currentUpdatedAt in the response so the keeper UI can
		// refetch and retry without a full reload.
		if (result.status === 409 && result.currentUpdatedAt !== undefined) {
			return json(
				{ message: result.message, currentUpdatedAt: result.currentUpdatedAt },
				{ status: 409 }
			);
		}
		throw error(result.status, result.message);
	}
	return json(
		{ newUpdatedAt: result.newUpdatedAt, rollId: result.rollId },
		{ status: 201 }
	);
};
