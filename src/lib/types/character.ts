import type { CharacteristicId, Era, Mode } from './common';

/** Schema version for character data migration */
export const CHARACTER_SCHEMA_VERSION = 1;

/** Complete investigator data stored as JSON blob */
export interface CoCCharacterData {
	schemaVersion: number;

	// Campaign settings
	era: Era;
	mode: Mode;
	contentPackId: string;

	// Identity
	name: string;
	age: number;
	gender: string;
	pronouns: string;
	residence: string;
	birthplace: string;
	portraitUrl: string;

	// Characteristics with audit trail
	characteristics: CharacteristicsData;

	// Derived stats (auto-calculated but tracked for in-play use)
	derivedStats: DerivedStatsData;

	// Occupation
	occupation: OccupationData | null;

	// Skills with auditable allocations
	skills: CoCSkillAllocation[];

	// Backstory
	backstory: BackstoryData;

	// Equipment & Finances
	equipment: EquipmentData;

	// Wizard state
	isDraft: boolean;
	wizardStep: number;
}

export interface CharacteristicsData {
	method: 'roll';
	/** Final values after all modifiers */
	values: Record<CharacteristicId, number>;
	/** Values before age modifiers */
	baseValues: Record<CharacteristicId, number>;
	/** Individual die results if rolled */
	rolls: Record<CharacteristicId, number[]> | null;
	/** Age adjustments applied */
	ageAdjustments: AgeAdjustment[];
}

export interface AgeAdjustment {
	characteristic: CharacteristicId | 'str-or-siz';
	amount: number;
	reason: string;
}

export interface DerivedStatsData {
	hp: { max: number; current: number };
	mp: { max: number; current: number };
	sanity: { max: number; current: number; startingValue: number };
	luck: { max: number; current: number; rolls: number[] | null };
	damageBonus: string;
	build: number;
	moveRate: number;
}

export interface OccupationData {
	occupationId: string;
	/** If the occupation formula has a choice (e.g. STR or DEX), which was picked */
	formulaChoices: Record<string, CharacteristicId>;
}

export interface CoCSkillAllocation {
	skillId: string;
	/** User-provided name for customizable specializations */
	customName: string | null;
	baseValue: number;
	allocations: SkillPointAllocation[];
	isOccupation: boolean;
	total: number;
	half: number;
	fifth: number;
}

export interface SkillPointAllocation {
	points: number;
	source: 'occupation' | 'personal-interest' | 'experience';
	sourceLabel: string;
}

export interface BackstoryData {
	ideologyBeliefs: string;
	significantPeople: string;
	meaningfulLocations: string;
	treasuredPossessions: string;
	traits: string;
	injuriesScars: string;
	phobiasManias: string;
	arcaneTomesSpellsArtifacts: string;
	encountersWithStrangeEntities: string;
	keyConnection: string;
}

export interface EquipmentData {
	items: EquipmentItem[];
	weapons: CharacterWeapon[];
	cash: number;
	assets: string;
	spendingLevel: string;
}

export interface EquipmentItem {
	name: string;
	quantity: number;
	notes: string;
}

export interface CharacterWeapon {
	name: string;
	damage: string;
	range: string;
	attacksPerRound: string;
	ammo: number | null;
	malfunction: number | null;
}

/** Factory for a blank character */
export function createBlankCharacter(): CoCCharacterData {
	return {
		schemaVersion: CHARACTER_SCHEMA_VERSION,
		era: '1920s',
		mode: 'standard',
		contentPackId: 'coc7e',
		name: '',
		age: 25,
		gender: '',
		pronouns: '',
		residence: '',
		birthplace: '',
		portraitUrl: '',
		characteristics: {
			method: 'roll',
			values: { str: 0, con: 0, dex: 0, int: 0, pow: 0, app: 0, siz: 0, edu: 0 },
			baseValues: { str: 0, con: 0, dex: 0, int: 0, pow: 0, app: 0, siz: 0, edu: 0 },
			rolls: null,
			ageAdjustments: []
		},
		derivedStats: {
			hp: { max: 0, current: 0 },
			mp: { max: 0, current: 0 },
			sanity: { max: 0, current: 0, startingValue: 0 },
			luck: { max: 0, current: 0, rolls: null },
			damageBonus: '0',
			build: 0,
			moveRate: 0
		},
		occupation: null,
		skills: [],
		backstory: {
			ideologyBeliefs: '',
			significantPeople: '',
			meaningfulLocations: '',
			treasuredPossessions: '',
			traits: '',
			injuriesScars: '',
			phobiasManias: '',
			arcaneTomesSpellsArtifacts: '',
			encountersWithStrangeEntities: '',
			keyConnection: ''
		},
		equipment: {
			items: [],
			weapons: [],
			cash: 0,
			assets: '',
			spendingLevel: ''
		},
		isDraft: true,
		wizardStep: 0
	};
}
