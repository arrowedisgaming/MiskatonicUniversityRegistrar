/**
 * Zod validation for bundled CoC 7e content-pack JSON.
 * Parsed once at server boot to fail loudly on malformed game data.
 */

import { z } from 'zod';

const characteristicId = z.enum(['str', 'con', 'dex', 'int', 'pow', 'app', 'siz', 'edu']);

const eraDefinition = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string(),
	currencyUnit: z.string(),
	currencySymbol: z.string()
});

const characteristicMethod = z.object({
	id: z.enum(['roll', 'arrange-rolls', 'point-buy', 'quick-fire', 'low-roll-modifier', 'human-potential']),
	name: z.string().min(1),
	description: z.string()
});

const damageBonusBuildEntry = z.object({
	minSum: z.number().int(),
	maxSum: z.number().int(),
	damageBonus: z.string(),
	build: z.number().int()
});

const ageModifierEntry = z.object({
	minAge: z.number().int().min(0),
	maxAge: z.number().int().min(0),
	physicalDeduction: z.number().int().min(0),
	physicalDeductionTargets: z.array(characteristicId),
	strConDexDeduction: z.number().int().min(0).optional(),
	appDeduction: z.number().int().min(0),
	eduDeduction: z.number().int().min(0),
	eduImprovementChecks: z.number().int().min(0),
	moveRateDeduction: z.number().int().min(0),
	special: z.string().nullable()
});

const wealthEntry = z.object({
	minCR: z.number().int().min(0),
	maxCR: z.number().int().min(0),
	livingStandard: z.string().min(1),
	spendingLevel: z.number().min(0),
	cashMultiplier: z.number().optional(),
	cashFixed: z.number().optional(),
	assetsMultiplier: z.number().optional(),
	assetsFixed: z.number().optional(),
	assetsLabel: z.string().optional(),
	spendingLevelLabel: z.string().optional(),
	cash: z.number().optional()
});

export const contentPackSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	version: z.string().min(1),
	description: z.string(),
	system: z.string().min(1),
	license: z.string(),
	authors: z.array(z.string()),
	files: z.object({
		skills: z.string(),
		occupations: z.string(),
		equipment: z.string()
	}),
	eras: z.array(eraDefinition).min(1),
	characteristicMethods: z.array(characteristicMethod).min(1),
	characteristicRolls: z.record(characteristicId, z.string()),
	quickFireArrays: z.array(z.array(z.number().int())).optional(),
	damageBonusBuildTable: z.array(damageBonusBuildEntry).min(1),
	ageModifiers: z.array(ageModifierEntry).min(1),
	wealthTables: z.record(z.string(), z.array(wealthEntry)),
	wealthTable: z.array(wealthEntry).optional()
});

export const skillDefinitionSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	baseValue: z.number().int().min(0).max(99),
	category: z.string().min(1),
	isSpecialization: z.boolean(),
	specializationGroup: z.string().optional(),
	specializationLabel: z.string().optional(),
	isCustomizable: z.boolean().optional(),
	eras: z.array(z.string().min(1)).min(1),
	uncommon: z.boolean().optional(),
	derivedBase: z.string().optional(),
	noPointAllocation: z.boolean().optional()
});

export const skillsSchema = z.array(skillDefinitionSchema);

const skillPointFormulaSchema = z.object({
	terms: z.array(
		z.object({
			characteristic: characteristicId,
			multiplier: z.number().int().positive()
		})
	),
	choiceTerms: z
		.array(
			z.object({
				options: z.array(characteristicId).min(1),
				multiplier: z.number().int().positive()
			})
		)
		.optional()
});

const occupationSkillEntrySchema = z.object({
	skillId: z.string().min(1),
	required: z.boolean()
});

export const occupationDefinitionSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	eras: z.array(z.string().min(1)).min(1),
	creditRating: z.object({
		min: z.number().int().min(0).max(99),
		max: z.number().int().min(0).max(99)
	}),
	skillPointFormula: skillPointFormulaSchema,
	occupationSkills: z.array(occupationSkillEntrySchema),
	personalChoiceCount: z.number().int().min(0),
	interpersonalChoiceCount: z.number().int().min(0).optional(),
	combatChoiceCount: z.number().int().min(0).optional(),
	scienceChoiceCount: z.number().int().min(0).optional(),
	suggestedContacts: z.string().optional()
});

export const occupationsSchema = z.array(occupationDefinitionSchema);

const weaponDefinitionSchema = z.object({
	name: z.string().min(1),
	damage: z.string(),
	range: z.string(),
	attacksPerRound: z.string(),
	ammo: z.number().int().min(0).optional(),
	malfunction: z.number().int().min(0).nullable().optional()
});

export const equipmentSchema = z.object({
	weapons: z.array(weaponDefinitionSchema),
	commonItems: z.record(z.string(), z.array(z.string()))
});
