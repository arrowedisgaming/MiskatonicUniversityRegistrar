import type { CharacteristicId, Era, Mode } from './common';
import type { CharacteristicMethodId } from './content-pack';
import type { CoCPercentileOutcome } from '$lib/engine/coc-percentile-check';

/** Schema version for character data migration */
export const CHARACTER_SCHEMA_VERSION = 5;

/** Play-mode percentile d100 checks (Characteristics & skills). */
export interface PlayRollHistoryPercentileEntry {
	id: string;
	at: string;
	targetKind: 'characteristic' | 'skill';
	characteristicId?: CharacteristicId;
	skillId?: string;
	skillDisplayLabel?: string | null;
	target: number;
	half: number;
	fifth: number;
	rawRoll: number;
	effectiveRoll: number;
	outcome: CoCPercentileOutcome;
	isFumble: boolean;
}

/** Play-mode weapon damage roll (summed dice + optional flat). */
export interface PlayRollHistoryWeaponDamageEntry {
	id: string;
	at: string;
	targetKind: 'weaponDamage';
	weaponName: string;
	formula: string;
	segmentLabel?: string | null;
	total: number;
	detail: string;
}

export type PlayRollHistoryEntry = PlayRollHistoryPercentileEntry | PlayRollHistoryWeaponDamageEntry;

export type { CoCPercentileOutcome };

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

	// Homebrew / supplement skill definitions (not in content pack)
	customSkillDefs: CustomSkillDef[];

	// Backstory
	backstory: BackstoryData;

	// Equipment & Finances
	equipment: EquipmentData;

	/** Play mode d100 checks — newest entries appended by the client */
	playRollHistory: PlayRollHistoryEntry[];

	// Wizard state
	isDraft: boolean;
	wizardStep: number;
}

export interface CharacteristicsData {
	method: CharacteristicMethodId;
	/** Final values after all modifiers */
	values: Record<CharacteristicId, number>;
	/** Values before age modifiers */
	baseValues: Record<CharacteristicId, number>;
	/** Individual die results if rolled */
	rolls: Record<CharacteristicId, number[]> | null;
	/** Age adjustments applied */
	ageAdjustments: AgeAdjustment[];
	/** EDU improvement checks applied for age */
	eduImprovementChecks: EduImprovementCheck[];
	/** Luck change caused by age rules */
	luckAdjustment: LuckAdjustment | null;
}

export interface AgeAdjustment {
	characteristic: CharacteristicId;
	amount: number;
	reason: string;
}

export interface EduImprovementCheck {
	roll: number;
	success: boolean;
	improvementRoll: number | null;
	improvement: number;
	resultingEdu: number;
	source?: 'rolled' | 'manual';
}

export interface LuckAdjustment {
	reason: string;
	rollSets: number[][];
	chosenTotal: number;
}

export interface DerivedStatsData {
	hp: { max: number; current: number };
	mp: { max: number; current: number };
	sanity: { max: number; current: number; startingValue: number };
	luck: { max: number; current: number; rolls: number[] | null; rollSets?: number[][] | null; reason?: string | null };
	damageBonus: string;
	build: number;
	moveRate: number;
}

export interface OccupationData {
	occupationId: string;
	/** If the occupation formula has a choice (e.g. STR or DEX), which was picked */
	formulaChoices: Record<string, CharacteristicId>;
	/** Display name for custom occupations (occupationId === 'custom') */
	customName?: string;
	/** User-entered skill point budget for custom occupations */
	customSkillPoints?: number;
	/** Skills the player tagged as occupation skills for custom occupations */
	customOccupationSkills?: string[];
}

/** User-defined skill not in the content pack (homebrew / supplements) */
export interface CustomSkillDef {
	id: string;
	name: string;
	baseValue: number;
	isOccupation?: boolean;
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
	personalDescription: string;
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
	assetsList: AssetItem[];
	cash: number;
	assets: number;
	assetsLabel: string;
	livingStandard: string;
	spendingLevel: number;
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

export interface AssetItem {
	name: string;
	value: number;
	type: string;
	description?: string;
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
			ageAdjustments: [],
			eduImprovementChecks: [],
			luckAdjustment: null
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
		customSkillDefs: [],
		backstory: {
			personalDescription: '',
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
			assetsList: [],
			cash: 0,
			assets: 0,
			assetsLabel: '',
			livingStandard: '',
			spendingLevel: 0
		},
		playRollHistory: [],
		isDraft: true,
		wizardStep: 0
	};
}
