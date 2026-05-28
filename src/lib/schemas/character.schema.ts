/**
 * Zod validation for CoCCharacterData at API boundaries.
 * Validates structure without reimplementing all game rules.
 */

import { z } from 'zod';

const skillPointAllocation = z.object({
	points: z.number().int().min(0).max(500),
	source: z.enum(['occupation', 'personal-interest', 'experience']),
	sourceLabel: z.string().max(200)
});

const skillAllocation = z.object({
	skillId: z.string().min(1).max(100),
	customName: z.string().max(200).nullable(),
	baseValue: z.number().int().min(0).max(99),
	// Cap is intentionally generous: per-roll Play Mode development appends a
	// new `experience` entry per successful dev roll (see `applyDevelopedSkillTotal`
	// in `src/routes/sheet/[id]/+page.svelte`). A long-running investigator may
	// develop the same skill many times; 200 entries is roughly an entire
	// campaign of weekly sessions per skill.
	allocations: z.array(skillPointAllocation).max(200),
	isOccupation: z.boolean(),
	total: z.number().int().min(0).max(500),
	half: z.number().int().min(0).max(250),
	fifth: z.number().int().min(0).max(100)
});

const characteristicId = z.enum(['str', 'con', 'dex', 'int', 'pow', 'app', 'siz', 'edu']);

const characteristicValueMap = z.object({
	str: z.number().int().min(0).max(99),
	con: z.number().int().min(0).max(99),
	dex: z.number().int().min(0).max(99),
	int: z.number().int().min(0).max(99),
	pow: z.number().int().min(0).max(99),
	app: z.number().int().min(0).max(99),
	siz: z.number().int().min(0).max(99),
	edu: z.number().int().min(0).max(99)
});

const characteristicsData = z.object({
	// Accept current and legacy method ids. Legacy ids (arrange-rolls,
	// low-roll-modifier, human-potential) are preserved verbatim in storage so
	// the sheet view retains generation provenance. The wizard resolves legacy
	// ids to point-buy only at edit-time via editableCharacteristicMethod() —
	// not here, where we want the round-trip to be lossless.
	method: z.enum(['point-buy', 'quick-fire', 'roll', 'arrange-rolls', 'low-roll-modifier', 'human-potential']),
	values: characteristicValueMap,
	baseValues: characteristicValueMap,
	rolls: z.record(z.string().max(20), z.array(z.number()).max(20)).nullable(),
	ageAdjustments: z.array(z.object({
		characteristic: z.string().max(20),
		amount: z.number(),
		reason: z.string().max(200)
	})).max(20),
	eduImprovementChecks: z.array(z.object({
		roll: z.number().int().min(1).max(100),
		success: z.boolean(),
		improvementRoll: z.number().int().min(1).max(10).nullable(),
		improvement: z.number().int().min(0),
		resultingEdu: z.number().int().min(0).max(99)
	})).max(20).default([]),
	luckAdjustment: z.object({
		reason: z.string().max(200),
		rollSets: z.array(z.array(z.number().int().min(1).max(6)).max(10)).max(20),
		chosenTotal: z.number().int().min(0).max(99)
	}).nullable().default(null)
});

const derivedStatsData = z.object({
	hp: z.object({ max: z.number().int().min(0).max(999), current: z.number().int() }),
	mp: z.object({ max: z.number().int().min(0).max(999), current: z.number().int() }),
	sanity: z.object({
		max: z.number().int().min(0).max(99),
		current: z.number().int(),
		startingValue: z.number().int().min(0).max(99)
	}),
	luck: z.object({
		max: z.number().int().min(0).max(99),
		current: z.number().int(),
		rolls: z.array(z.number()).max(10).nullable(),
		rollSets: z.array(z.array(z.number()).max(10)).max(20).nullable().optional(),
		reason: z.string().max(200).nullable().optional()
	}),
	damageBonus: z.string().max(20),
	build: z.number().int(),
	moveRate: z.number().int().min(0).max(20)
});

const BACKSTORY_FIELD_MAX = 5000;

const PLAY_ROLL_HISTORY_MAX = 10_000;

const playRollHistoryPercentile = z.object({
	id: z.string().min(1).max(80),
	at: z.string().max(40),
	targetKind: z.enum(['characteristic', 'skill']),
	characteristicId: characteristicId.optional(),
	skillId: z.string().max(100).optional(),
	skillDisplayLabel: z.string().max(200).nullable().optional(),
	target: z.number().int().min(0).max(500),
	half: z.number().int().min(0).max(250),
	fifth: z.number().int().min(0).max(100),
	rawRoll: z.number().int().min(1).max(100),
	effectiveRoll: z.number().int().min(1).max(100),
	outcome: z.enum(['critical', 'extreme', 'hard', 'regular', 'failure']),
	isFumble: z.boolean(),
	bonusDieCount: z.number().int().min(0).max(2).optional(),
	penaltyDieCount: z.number().int().min(0).max(2).optional()
});

const playRollHistoryWeaponDamage = z.object({
	id: z.string().min(1).max(80),
	at: z.string().max(40),
	targetKind: z.literal('weaponDamage'),
	weaponName: z.string().max(200),
	formula: z.string().max(80),
	segmentLabel: z.string().max(80).nullable().optional(),
	total: z.number().int(),
	detail: z.string().max(2000)
});

const playRollHistorySkillDevelopment = z.object({
	id: z.string().min(1).max(80),
	at: z.string().max(40),
	targetKind: z.literal('skillDevelopment'),
	skillId: z.string().min(1).max(100),
	customName: z.string().max(200).nullable(),
	skillDisplayLabel: z.string().max(200),
	beforeTotal: z.number().int().min(0).max(500),
	improvementRoll: z.number().int().min(1).max(10).nullable(),
	improvement: z.number().int().min(0).max(10),
	afterTotal: z.number().int().min(0).max(500),
	eligibilityRoll: z.number().int().min(1).max(100),
	eligibilityPassed: z.boolean(),
	sanityRewardRolls: z.array(z.number().int().min(1).max(6)).max(2).nullable().optional(),
	sanityRewardTotal: z.number().int().min(0).max(12).nullable().optional()
});

const playRollHistorySanCheck = z.object({
	id: z.string().min(1).max(80),
	at: z.string().max(40),
	targetKind: z.literal('sanCheck'),
	target: z.number().int().min(0).max(99),
	rawRoll: z.number().int().min(1).max(100),
	effectiveRoll: z.number().int().min(1).max(100),
	outcome: z.enum(['critical', 'extreme', 'hard', 'regular', 'failure']),
	isFumble: z.boolean(),
	lossApplied: z.boolean()
});

const playRollHistorySanLoss = z.object({
	id: z.string().min(1).max(80),
	at: z.string().max(40),
	targetKind: z.literal('sanLoss'),
	source: z.string().max(200),
	formula: z.string().max(80).nullable(),
	successAmount: z.number().int().min(0).max(100).nullable(),
	failureAmount: z.number().int().min(0).max(100).nullable(),
	applied: z.number().int().min(-12).max(100),
	triggeredTemporary: z.boolean(),
	triggeredIndefinite: z.boolean(),
	sanBefore: z.number().int().min(0).max(99),
	sanAfter: z.number().int().min(0).max(99)
});

const diceSides = z.union([
	z.literal(3),
	z.literal(4),
	z.literal(6),
	z.literal(8),
	z.literal(10),
	z.literal(12),
	z.literal(20),
	z.literal(100)
]);

const playRollHistoryGenericDice = z.object({
	id: z.string().min(1).max(80),
	at: z.string().max(40),
	targetKind: z.literal('genericDice'),
	sides: diceSides,
	count: z.number().int().min(1).max(20),
	modifier: z.number().int().min(-999).max(999),
	rolls: z.array(z.number().int().min(1).max(100)).min(1).max(20),
	total: z.number().int().min(-999).max(3000),
	label: z.string().max(200).nullable().optional(),
	groups: z
		.array(
			z.object({
				count: z.number().int().min(1).max(20),
				sides: diceSides,
				rolls: z.array(z.number().int().min(1).max(100)).min(1).max(20)
			})
		)
		.min(1)
		.max(8)
		.optional()
});

/**
 * Strict, per-kind validators for the player-emittable roll-history entries.
 * Exported so the campaign roll endpoint can reuse them — letting the campaign
 * API reject the same oversized / malformed payloads the character-save path
 * already rejects, without duplicating the per-field caps.
 *
 * Note: the keeper-inventory variant is intentionally NOT in this union — it
 * is server-emitted only and must never be acceptable on a player POST.
 */
const playRollHistoryEntry = z.union([
	playRollHistoryPercentile,
	playRollHistoryWeaponDamage,
	playRollHistorySkillDevelopment,
	playRollHistorySanCheck,
	playRollHistorySanLoss,
	playRollHistoryGenericDice
]);

export const playerEmittedRollEntrySchema = playRollHistoryEntry;

const skillDevelopmentMark = z.object({
	id: z.string().min(1).max(80),
	skillId: z.string().min(1).max(100),
	customName: z.string().max(200).nullable(),
	skillDisplayLabel: z.string().max(200),
	source: z.enum(['automatic', 'manual']),
	sourceRollId: z.string().max(80).nullable().optional(),
	at: z.string().max(40)
});

const playTrackingData = z.object({
	dailySanStart: z.number().int().min(0).max(99).nullable(),
	dailySanResetAt: z.string().max(40).nullable(),
	insanity: z.object({
		temporary: z.boolean(),
		indefinite: z.boolean(),
		boutOfMadness: z.boolean()
	})
});
const assetItem = z.object({
	name: z.string().min(1).max(200),
	value: z.number().min(0).max(1_000_000_000),
	type: z.string().max(100),
	description: z.string().max(1000).optional()
});

export const cocCharacterDataSchema = z.object({
	schemaVersion: z.number().int().positive(),
	era: z.string().min(1).max(100),
	mode: z.string().min(1).max(100),
	contentPackId: z.string().min(1).max(100),
	name: z.string().max(200),
	age: z.number().int().min(1).max(120),
	gender: z.string().max(100),
	pronouns: z.string().max(100),
	residence: z.string().max(200),
	birthplace: z.string().max(200),
	portraitUrl: z.string().max(2048).transform((s) => s.trim()),
	characteristics: characteristicsData,
	derivedStats: derivedStatsData,
	occupation: z.object({
		occupationId: z.string().min(1).max(100),
		// Keys are formula-term indices ("0", "1", ...); values must be one of the
		// eight characteristic IDs so calculateOccupationSkillPoints cannot receive
		// undefined → NaN and silently bypass the budget check.
		formulaChoices: z.record(z.string().max(20), characteristicId),
		customName: z.string().max(200).optional(),
		customSkillPoints: z.number().int().min(0).max(9999).optional(),
		customOccupationSkills: z.array(z.string().min(1).max(100)).max(100).optional(),
		customizableResolutions: z.record(z.string().min(1).max(100), z.string().min(1).max(100)).optional()
	}).nullable(),
	skills: z.array(skillAllocation).max(200),
	customSkillDefs: z.array(z.object({
		id: z.string().min(1).max(100),
		name: z.string().min(1).max(200),
		baseValue: z.number().int().min(0).max(99),
		isOccupation: z.boolean().optional()
	})).max(50).default([]),
	backstory: z.object({
		personalDescription: z.string().max(BACKSTORY_FIELD_MAX).default(''),
		ideologyBeliefs: z.string().max(BACKSTORY_FIELD_MAX),
		significantPeople: z.string().max(BACKSTORY_FIELD_MAX),
		meaningfulLocations: z.string().max(BACKSTORY_FIELD_MAX),
		treasuredPossessions: z.string().max(BACKSTORY_FIELD_MAX),
		traits: z.string().max(BACKSTORY_FIELD_MAX),
		injuriesScars: z.string().max(BACKSTORY_FIELD_MAX),
		phobiasManias: z.string().max(BACKSTORY_FIELD_MAX),
		arcaneTomesSpellsArtifacts: z.string().max(BACKSTORY_FIELD_MAX),
		encountersWithStrangeEntities: z.string().max(BACKSTORY_FIELD_MAX),
		keyConnection: z.string().max(BACKSTORY_FIELD_MAX)
	}),
	equipment: z.object({
		items: z.array(z.object({
			name: z.string().max(200),
			quantity: z.number().int().min(0).max(9999),
			notes: z.string().max(1000)
		})).max(200),
		weapons: z.array(z.object({
			name: z.string().max(200),
			damage: z.string().max(50),
			range: z.string().max(50),
			attacksPerRound: z.string().max(50),
			ammo: z.number().nullable(),
			malfunction: z.number().nullable()
		})).max(50),
		assetsList: z.array(assetItem).max(50).default([]),
		cash: z.number().min(0).max(1_000_000_000),
		assets: z.number().min(0).max(1_000_000_000),
		assetsLabel: z.string().max(200),
		livingStandard: z.string().max(100),
		spendingLevel: z.number().min(0).max(1_000_000)
	}),
	playRollHistory: z.array(playRollHistoryEntry).max(PLAY_ROLL_HISTORY_MAX).default([]),
	skillDevelopmentMarks: z.array(skillDevelopmentMark).max(300).default([]),
	skillDevelopmentMilestones: z.array(z.string().max(300)).max(1000).default([]),
	playTracking: playTrackingData.default({
		dailySanStart: null,
		dailySanResetAt: null,
		insanity: { temporary: false, indefinite: false, boutOfMadness: false }
	}),
	isDraft: z.boolean(),
	wizardStep: z.number().int().min(0).max(20)
});

export const createInvestigatorSchema = z.object({
	character: cocCharacterDataSchema
});
