import type { CharacteristicId } from './common';

/** Content pack manifest (index.json) */
export interface CoCContentPack {
	id: string;
	name: string;
	version: string;
	description: string;
	system: string;
	license: string;
	authors: string[];
	files: {
		skills: string;
		occupations: string;
		equipment: string;
	};
	eras: EraDefinition[];
	characteristicMethods: CharacteristicMethod[];
	characteristicRolls: Record<CharacteristicId, string>;
	quickFireArrays?: number[][];
	damageBonusBuildTable: DamageBonusBuildEntry[];
	ageModifiers: AgeModifierEntry[];
	wealthTables: Record<string, WealthEntry[]>;
	/** @deprecated use wealthTables[era] */
	wealthTable?: WealthEntry[];
}

export interface EraDefinition {
	id: string;
	name: string;
	description: string;
	currencyUnit: string;
	currencySymbol: string;
}

export interface CharacteristicMethod {
	id: CharacteristicMethodId;
	name: string;
	description: string;
}

export type CharacteristicMethodId =
	| 'roll'
	| 'arrange-rolls'
	| 'point-buy'
	| 'quick-fire'
	| 'low-roll-modifier'
	| 'human-potential';

export interface DamageBonusBuildEntry {
	minSum: number;
	maxSum: number;
	damageBonus: string;
	build: number;
}

export interface AgeModifierEntry {
	minAge: number;
	maxAge: number;
	physicalDeduction: number;
	physicalDeductionTargets: CharacteristicId[];
	/** @deprecated use physicalDeduction */
	strConDexDeduction?: number;
	appDeduction: number;
	eduDeduction: number;
	eduImprovementChecks: number;
	moveRateDeduction: number;
	special: string | null;
}

export interface WealthEntry {
	minCR: number;
	maxCR: number;
	livingStandard: string;
	spendingLevel: number;
	cashMultiplier?: number;
	cashFixed?: number;
	assetsMultiplier?: number;
	assetsFixed?: number;
	assetsLabel?: string;
	/** @deprecated use livingStandard */
	spendingLevelLabel?: string;
	/** @deprecated use cashMultiplier/cashFixed */
	cash?: number;
}

/** Skill definition from skills.json */
export interface CoCSkillDefinition {
	id: string;
	name: string;
	baseValue: number;
	category: string;
	isSpecialization: boolean;
	specializationGroup?: string;
	specializationLabel?: string;
	isCustomizable?: boolean;
	eras: string[];
	uncommon?: boolean;
	/** e.g. "dex/2" for Dodge, "edu" for Own Language */
	derivedBase?: string;
	/** If true, points cannot be allocated (e.g. Cthulhu Mythos) */
	noPointAllocation?: boolean;
}

/** Occupation definition from occupations.json */
export interface CoCOccupationDefinition {
	id: string;
	name: string;
	eras: string[];
	creditRating: { min: number; max: number };
	skillPointFormula: SkillPointFormula;
	occupationSkills: OccupationSkillEntry[];
	/** How many "any" skills the player can choose */
	personalChoiceCount: number;
	/** How many interpersonal skills (Charm/Fast Talk/Intimidate/Persuade) to pick */
	interpersonalChoiceCount?: number;
	/** How many combat skills (Fighting/Firearms) to pick */
	combatChoiceCount?: number;
	/** How many Science specializations to pick */
	scienceChoiceCount?: number;
	suggestedContacts?: string;
}

export interface SkillPointFormula {
	/** Fixed terms, e.g. [{characteristic: "edu", multiplier: 4}] */
	terms: { characteristic: CharacteristicId; multiplier: number }[];
	/** Choice terms, e.g. [{options: ["str", "dex"], multiplier: 2}] */
	choiceTerms?: { options: CharacteristicId[]; multiplier: number }[];
}

export interface OccupationSkillEntry {
	skillId: string;
	required: boolean;
}

/** Equipment definitions from equipment.json */
export interface CoCEquipmentPack {
	weapons: WeaponDefinition[];
	commonItems: Record<string, string[]>;
}

export interface WeaponDefinition {
	name: string;
	damage: string;
	range: string;
	attacksPerRound: string;
	ammo?: number;
	malfunction?: number | null;
}
