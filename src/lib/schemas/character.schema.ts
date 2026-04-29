/**
 * Zod validation for CoCCharacterData at API boundaries.
 * Validates structure without reimplementing all game rules.
 */

import { z } from 'zod';

const skillPointAllocation = z.object({
	points: z.number().int().min(0),
	source: z.enum(['occupation', 'personal-interest', 'experience']),
	sourceLabel: z.string()
});

const skillAllocation = z.object({
	skillId: z.string().min(1),
	customName: z.string().nullable(),
	baseValue: z.number().int().min(0).max(99),
	allocations: z.array(skillPointAllocation),
	isOccupation: z.boolean(),
	total: z.number().int().min(0).max(99),
	half: z.number().int().min(0),
	fifth: z.number().int().min(0)
});

const characteristicsData = z.object({
	method: z.enum(['roll', 'arrange-rolls', 'point-buy', 'quick-fire', 'low-roll-modifier', 'human-potential']),
	values: z.record(z.string(), z.number().int().min(0).max(99)),
	baseValues: z.record(z.string(), z.number().int().min(0).max(99)),
	rolls: z.record(z.string(), z.array(z.number())).nullable(),
	ageAdjustments: z.array(z.object({
		characteristic: z.string(),
		amount: z.number(),
		reason: z.string()
	})),
	eduImprovementChecks: z.array(z.object({
		roll: z.number().int().min(1).max(100),
		success: z.boolean(),
		improvementRoll: z.number().int().min(1).max(10).nullable(),
		improvement: z.number().int().min(0),
		resultingEdu: z.number().int().min(0).max(99)
	})).default([]),
	luckAdjustment: z.object({
		reason: z.string(),
		rollSets: z.array(z.array(z.number().int().min(1).max(6))),
		chosenTotal: z.number().int().min(0).max(99)
	}).nullable().default(null)
});

const derivedStatsData = z.object({
	hp: z.object({ max: z.number().int().min(0), current: z.number().int() }),
	mp: z.object({ max: z.number().int().min(0), current: z.number().int() }),
	sanity: z.object({ max: z.number().int().min(0), current: z.number().int(), startingValue: z.number().int().min(0) }),
	luck: z.object({
		max: z.number().int().min(0),
		current: z.number().int(),
		rolls: z.array(z.number()).nullable(),
		rollSets: z.array(z.array(z.number())).nullable().optional(),
		reason: z.string().nullable().optional()
	}),
	damageBonus: z.string(),
	build: z.number().int(),
	moveRate: z.number().int().min(0)
});

export const cocCharacterDataSchema = z.object({
	schemaVersion: z.number().int().positive(),
	era: z.string().min(1),
	mode: z.string().min(1),
	contentPackId: z.string().min(1),
	name: z.string(),
	age: z.number().int().min(1).max(120),
	gender: z.string(),
	pronouns: z.string(),
	residence: z.string(),
	birthplace: z.string(),
	portraitUrl: z.string(),
	characteristics: characteristicsData,
	derivedStats: derivedStatsData,
	occupation: z.object({
		occupationId: z.string().min(1),
		formulaChoices: z.record(z.string(), z.string())
	}).nullable(),
	skills: z.array(skillAllocation),
	backstory: z.object({
		personalDescription: z.string().default(''),
		ideologyBeliefs: z.string(),
		significantPeople: z.string(),
		meaningfulLocations: z.string(),
		treasuredPossessions: z.string(),
		traits: z.string(),
		injuriesScars: z.string(),
		phobiasManias: z.string(),
		arcaneTomesSpellsArtifacts: z.string(),
		encountersWithStrangeEntities: z.string(),
		keyConnection: z.string()
	}),
	equipment: z.object({
		items: z.array(z.object({ name: z.string(), quantity: z.number().int().min(0), notes: z.string() })),
		weapons: z.array(z.object({
			name: z.string(),
			damage: z.string(),
			range: z.string(),
			attacksPerRound: z.string(),
			ammo: z.number().nullable(),
			malfunction: z.number().nullable()
		})),
		cash: z.number().min(0),
		assets: z.number().min(0),
		assetsLabel: z.string(),
		livingStandard: z.string(),
		spendingLevel: z.number().min(0)
	}),
	isDraft: z.boolean(),
	wizardStep: z.number().int().min(0)
});

export const createInvestigatorSchema = z.object({
	character: cocCharacterDataSchema
});
