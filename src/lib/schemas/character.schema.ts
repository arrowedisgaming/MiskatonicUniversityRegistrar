/**
 * Zod validation for CoCCharacterData at API boundaries.
 * Validates structure without reimplementing all game rules.
 */

import { z } from 'zod';

const skillPointAllocation = z.object({
	points: z.number().int().min(0).max(99),
	source: z.enum(['occupation', 'personal-interest', 'experience']),
	sourceLabel: z.string().max(200)
});

const skillAllocation = z.object({
	skillId: z.string().min(1).max(100),
	customName: z.string().max(200).nullable(),
	baseValue: z.number().int().min(0).max(99),
	allocations: z.array(skillPointAllocation).max(20),
	isOccupation: z.boolean(),
	total: z.number().int().min(0).max(99),
	half: z.number().int().min(0),
	fifth: z.number().int().min(0)
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
	method: z.enum(['roll', 'arrange-rolls', 'point-buy', 'quick-fire', 'low-roll-modifier', 'human-potential']),
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
	portraitUrl: z.string().max(2048),
	characteristics: characteristicsData,
	derivedStats: derivedStatsData,
	occupation: z.object({
		occupationId: z.string().min(1).max(100),
		// Keys are formula-term indices ("0", "1", ...); values must be one of the
		// eight characteristic IDs so calculateOccupationSkillPoints cannot receive
		// undefined → NaN and silently bypass the budget check.
		formulaChoices: z.record(z.string().max(20), characteristicId)
	}).nullable(),
	skills: z.array(skillAllocation).max(200),
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
		cash: z.number().min(0).max(1_000_000_000),
		assets: z.number().min(0).max(1_000_000_000),
		assetsLabel: z.string().max(200),
		livingStandard: z.string().max(100),
		spendingLevel: z.number().min(0).max(1_000_000)
	}),
	isDraft: z.boolean(),
	wizardStep: z.number().int().min(0).max(20)
});

export const createInvestigatorSchema = z.object({
	character: cocCharacterDataSchema
});
