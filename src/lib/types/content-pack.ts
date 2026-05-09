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
		names?: string;
		backstoryTables?: string;
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

/** Methods the wizard can currently render and edit. */
export type CharacteristicMethodId = 'point-buy' | 'quick-fire' | 'roll';

/**
 * Method ids that previously existed in the wizard but are no longer editable
 * directly. Preserved in storage so historical investigators retain their
 * generation provenance — the sheet view can label them, and the user is
 * forced through an explicit conversion when opening the wizard for editing.
 */
export type LegacyCharacteristicMethodId = 'arrange-rolls' | 'low-roll-modifier' | 'human-potential';

/** Method id that may appear in stored character JSON (current + legacy). */
export type StoredCharacteristicMethodId = CharacteristicMethodId | LegacyCharacteristicMethodId;

export const CHARACTERISTIC_METHOD_IDS: readonly CharacteristicMethodId[] = ['point-buy', 'quick-fire', 'roll'] as const;

export const LEGACY_CHARACTERISTIC_METHOD_IDS: readonly LegacyCharacteristicMethodId[] = ['arrange-rolls', 'low-roll-modifier', 'human-potential'] as const;

export const STORED_CHARACTERISTIC_METHOD_IDS: readonly StoredCharacteristicMethodId[] = [
	...CHARACTERISTIC_METHOD_IDS,
	...LEGACY_CHARACTERISTIC_METHOD_IDS
] as const;

/** True when the value is a wizard-editable method id. */
export function isCharacteristicMethodId(value: unknown): value is CharacteristicMethodId {
	return value === 'point-buy' || value === 'quick-fire' || value === 'roll';
}

/** True when the value is any stored method id (current or legacy). */
export function isStoredCharacteristicMethodId(value: unknown): value is StoredCharacteristicMethodId {
	return isCharacteristicMethodId(value)
		|| value === 'arrange-rolls' || value === 'low-roll-modifier' || value === 'human-potential';
}

/**
 * Coerce any incoming value to a *stored* method id without losing legacy
 * provenance. Truly unknown values (undefined, malformed strings, numbers)
 * fall back to point-buy as a last-resort default. This is the boundary used
 * by JSON migration / persistence — it never rewrites known legacy ids.
 */
export function normalizeStoredMethod(value: unknown): StoredCharacteristicMethodId {
	return isStoredCharacteristicMethodId(value) ? value : 'point-buy';
}

/**
 * Resolve any stored method to a wizard-editable id. Legacy methods that the
 * wizard can no longer render fall back to point-buy as the editable proxy —
 * but only at edit time; the original is preserved in storage until the user
 * explicitly saves a new allocation.
 */
export function editableCharacteristicMethod(value: unknown): CharacteristicMethodId {
	return isCharacteristicMethodId(value) ? value : 'point-buy';
}

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
	socialClass?: 'upper' | 'middle' | 'working' | 'criminal' | 'any';
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

export interface NameTableEntry {
	era: string;
	region: string;
	gender: string;
	given: string[];
	family: string[];
}

export interface BackstoryTableEntry {
	field: string;
	entries: string[];
}
