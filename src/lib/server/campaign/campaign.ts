import { and, desc, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AppDb } from '$lib/server/db';
import { campaignMembers, campaigns, investigators } from '$lib/server/db/schema';
import { resolveCampaignRole } from './auth';

export interface CreateCampaignInput {
	keeperUserId: string;
	name: string;
	description?: string;
}

export async function createCampaign(
	db: AppDb,
	input: CreateCampaignInput,
	now: Date = new Date()
): Promise<{ id: string }> {
	const id = nanoid();
	await db.insert(campaigns).values({
		id,
		keeperUserId: input.keeperUserId,
		name: input.name,
		description: input.description ?? '',
		shareId: null,
		isOpen: true,
		createdAt: now,
		updatedAt: now
	});
	return { id };
}

export interface CampaignSummary {
	id: string;
	name: string;
	description: string;
	isOpen: boolean;
	hasShareLink: boolean;
	keeperUserId: string;
	role: 'keeper' | 'player';
	memberCount: number;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Lists every campaign the user can see — both ones they keep and ones
 * they're an active player in. Single query per role kept simple; if the
 * user is in N campaigns the merge cost is trivial.
 */
export async function listCampaignsForUser(
	db: AppDb,
	userId: string
): Promise<CampaignSummary[]> {
	const asKeeper = await db
		.select({
			id: campaigns.id,
			name: campaigns.name,
			description: campaigns.description,
			isOpen: campaigns.isOpen,
			shareId: campaigns.shareId,
			keeperUserId: campaigns.keeperUserId,
			createdAt: campaigns.createdAt,
			updatedAt: campaigns.updatedAt
		})
		.from(campaigns)
		.where(eq(campaigns.keeperUserId, userId))
		.orderBy(desc(campaigns.updatedAt));

	const asPlayer = await db
		.select({
			id: campaigns.id,
			name: campaigns.name,
			description: campaigns.description,
			isOpen: campaigns.isOpen,
			shareId: campaigns.shareId,
			keeperUserId: campaigns.keeperUserId,
			createdAt: campaigns.createdAt,
			updatedAt: campaigns.updatedAt
		})
		.from(campaignMembers)
		.innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
		.where(
			and(
				eq(campaignMembers.userId, userId),
				isNull(campaignMembers.leftAt)
			)
		)
		.orderBy(desc(campaigns.updatedAt));

	// Member counts in one batch
	const allIds = new Set<string>();
	for (const c of asKeeper) allIds.add(c.id);
	for (const c of asPlayer) allIds.add(c.id);

	const counts = new Map<string, number>();
	if (allIds.size > 0) {
		const rows = await db
			.select({
				campaignId: campaignMembers.campaignId,
				id: campaignMembers.id,
				leftAt: campaignMembers.leftAt
			})
			.from(campaignMembers)
			.where(isNull(campaignMembers.leftAt));
		for (const r of rows) {
			if (allIds.has(r.campaignId)) {
				counts.set(r.campaignId, (counts.get(r.campaignId) ?? 0) + 1);
			}
		}
	}

	const seen = new Set<string>();
	const result: CampaignSummary[] = [];

	for (const c of asKeeper) {
		seen.add(c.id);
		result.push({
			id: c.id,
			name: c.name,
			description: c.description,
			isOpen: c.isOpen,
			hasShareLink: c.shareId !== null,
			keeperUserId: c.keeperUserId,
			role: 'keeper',
			memberCount: counts.get(c.id) ?? 0,
			createdAt: c.createdAt,
			updatedAt: c.updatedAt
		});
	}
	for (const c of asPlayer) {
		if (seen.has(c.id)) continue; // Keeper rows already pushed
		result.push({
			id: c.id,
			name: c.name,
			description: c.description,
			isOpen: c.isOpen,
			hasShareLink: c.shareId !== null,
			keeperUserId: c.keeperUserId,
			role: 'player',
			memberCount: counts.get(c.id) ?? 0,
			createdAt: c.createdAt,
			updatedAt: c.updatedAt
		});
	}

	return result;
}

export async function getCampaignForUser(
	db: AppDb,
	params: { campaignId: string; userId: string }
): Promise<
	| {
			ok: true;
			campaign: typeof campaigns.$inferSelect;
			role: 'keeper' | 'player';
	  }
	| { ok: false; status: 404 | 403; message: string }
> {
	const campaign = await db
		.select()
		.from(campaigns)
		.where(eq(campaigns.id, params.campaignId))
		.get();
	if (!campaign) return { ok: false, status: 404, message: 'Campaign not found' };

	const role = await resolveCampaignRole(db, params);
	if (role === null) return { ok: false, status: 404, message: 'Campaign not found' };
	if (role === 'none') return { ok: false, status: 403, message: 'Not a member' };

	return { ok: true, campaign, role };
}

export async function deleteCampaign(
	db: AppDb,
	params: { campaignId: string; userId: string }
): Promise<{ ok: true } | { ok: false; status: 404 | 403; message: string }> {
	const campaign = await db
		.select({ keeperUserId: campaigns.keeperUserId })
		.from(campaigns)
		.where(eq(campaigns.id, params.campaignId))
		.get();
	if (!campaign) return { ok: false, status: 404, message: 'Campaign not found' };
	if (campaign.keeperUserId !== params.userId) {
		return { ok: false, status: 403, message: 'Keeper only' };
	}
	// Cascade delete handles members + rolls
	await db.delete(campaigns).where(eq(campaigns.id, params.campaignId));
	return { ok: true };
}

export interface UpdateCampaignInput {
	name?: string;
	description?: string;
	isOpen?: boolean;
}

export async function updateCampaign(
	db: AppDb,
	params: { campaignId: string; userId: string },
	input: UpdateCampaignInput,
	now: Date = new Date()
): Promise<{ ok: true } | { ok: false; status: 404 | 403; message: string }> {
	const campaign = await db
		.select({ keeperUserId: campaigns.keeperUserId })
		.from(campaigns)
		.where(eq(campaigns.id, params.campaignId))
		.get();
	if (!campaign) return { ok: false, status: 404, message: 'Campaign not found' };
	if (campaign.keeperUserId !== params.userId) {
		return { ok: false, status: 403, message: 'Keeper only' };
	}

	const patch: Record<string, unknown> = { updatedAt: now };
	if (input.name !== undefined) patch.name = input.name;
	if (input.description !== undefined) patch.description = input.description;
	if (input.isOpen !== undefined) patch.isOpen = input.isOpen;

	await db.update(campaigns).set(patch).where(eq(campaigns.id, params.campaignId));
	return { ok: true };
}

export type CampaignRow = typeof campaigns.$inferSelect;
export type InvestigatorRow = typeof investigators.$inferSelect;
