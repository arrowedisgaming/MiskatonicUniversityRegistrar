import type { CoCCharacterData } from '$lib/types/character';

export type BackstoryKey = keyof CoCCharacterData['backstory'];

export interface BackstoryFieldDef {
	key: BackstoryKey;
	label: string;
}

/**
 * Canonical backstory field order + labels used across UI and exports.
 * Keep this list stable: it defines presentation order and "priority".
 */
export const BACKSTORY_FIELDS: readonly BackstoryFieldDef[] = [
	{ key: 'personalDescription', label: 'Personal Description' },
	{ key: 'ideologyBeliefs', label: 'Ideology / Beliefs' },
	{ key: 'significantPeople', label: 'Significant People' },
	{ key: 'meaningfulLocations', label: 'Meaningful Locations' },
	{ key: 'treasuredPossessions', label: 'Treasured Possessions' },
	{ key: 'traits', label: 'Traits' },
	{ key: 'injuriesScars', label: 'Injuries / Scars' },
	{ key: 'phobiasManias', label: 'Phobias / Manias' },
	{ key: 'arcaneTomesSpellsArtifacts', label: 'Arcane Tomes / Spells / Artifacts' },
	{ key: 'encountersWithStrangeEntities', label: 'Encounters With Strange Entities' },
	{ key: 'keyConnection', label: 'Key Connection' }
] as const;

export const BACKSTORY_KEYS: readonly BackstoryKey[] = BACKSTORY_FIELDS.map((f) => f.key);

/**
 * PDF historically printed only these four fields. We keep them as the top
 * priority set (always rendered, even if empty), then fill remaining space with
 * other non-empty backstory fields.
 */
export const PDF_BACKSTORY_PRIMARY_KEYS: readonly BackstoryKey[] = [
	'ideologyBeliefs',
	'significantPeople',
	'traits',
	'keyConnection'
] as const;

/**
 * Backstory prioritization for the one-page PDF.
 *
 * Goal: **fewer fields with more usable text**. These are the "headline" fields
 * that most clearly communicate who the investigator is and what drives them.
 *
 * Rules:
 * - The PDF will always try to print these first, **in this order**, skipping
 *   empties.
 * - Any remaining slots are filled from other non-empty backstory fields (again
 *   in canonical `BACKSTORY_FIELDS` order).
 */
export const PDF_BACKSTORY_PRIORITY_KEYS: readonly BackstoryKey[] = [
	'personalDescription',
	'ideologyBeliefs',
	'significantPeople',
	'keyConnection',
	'traits'
] as const;

export const BACKSTORY_LABEL_BY_KEY: Readonly<Record<BackstoryKey, string>> = Object.freeze(
	BACKSTORY_FIELDS.reduce(
		(acc, f) => {
			acc[f.key] = f.label;
			return acc;
		},
		{} as Record<BackstoryKey, string>
	)
);

