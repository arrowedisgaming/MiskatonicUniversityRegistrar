import { z } from 'zod';
import { playerEmittedRollEntrySchema } from './character.schema';

const CAMPAIGN_NAME_MAX = 120;
const CAMPAIGN_DESCRIPTION_MAX = 2000;

// Equipment-shape limits mirror src/lib/schemas/character.schema.ts:283-303 —
// keep them in sync so a delta that passes here cannot fail the full
// character schema during the post-merge re-validation in inventory.ts.
const weaponDelta = z.object({
	name: z.string().min(1).max(200),
	damage: z.string().max(50),
	range: z.string().max(50),
	attacksPerRound: z.string().max(50),
	ammo: z.number().nullable(),
	malfunction: z.number().nullable()
});

const itemDelta = z.object({
	name: z.string().min(1).max(200),
	quantity: z.number().int().min(1).max(9999),
	notes: z.string().max(1000).default('')
});

export const createCampaignSchema = z.object({
	name: z.string().min(1).max(CAMPAIGN_NAME_MAX),
	description: z.string().max(CAMPAIGN_DESCRIPTION_MAX).default('')
});

export const updateCampaignSchema = z.object({
	name: z.string().min(1).max(CAMPAIGN_NAME_MAX).optional(),
	description: z.string().max(CAMPAIGN_DESCRIPTION_MAX).optional(),
	isOpen: z.boolean().optional()
});

export const joinCampaignSchema = z.object({
	investigatorId: z.string().min(1).max(64)
});

/**
 * Append-roll payload. The `entry` is validated against the same strict
 * per-kind schema the character save path uses — no passthrough, no
 * silently-stored extra fields, no oversized strings.
 *
 * `investigatorName` is deliberately NOT in this schema even though the
 * column on `campaign_rolls` requires one — Codex flagged that trusting a
 * client-supplied display name lets a player forge attribution in the
 * shared roll log. The endpoint reads the canonical name from the joined
 * `investigators` row instead.
 */
export const appendRollSchema = z.object({
	entry: playerEmittedRollEntrySchema
});

export const inventoryDeltaSchema = z
	.object({
		expectedUpdatedAt: z.number().int(),
		add: z.object({
			weapons: z.array(weaponDelta).max(20).optional(),
			items: z.array(itemDelta).max(50).optional(),
			cashDelta: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional()
		})
	})
	.refine(
		(d) =>
			(d.add.weapons?.length ?? 0) > 0 ||
			(d.add.items?.length ?? 0) > 0 ||
			(typeof d.add.cashDelta === 'number' && d.add.cashDelta !== 0),
		{ message: 'Delta must include at least one weapon, item, or non-zero cashDelta' }
	);
