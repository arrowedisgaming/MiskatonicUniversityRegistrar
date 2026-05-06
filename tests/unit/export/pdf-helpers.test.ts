import { describe, it, expect } from 'vitest';
import {
	buildSkillRows,
	computeDerivedBase,
	distributeIntoColumns,
	filterSkillsForEra,
	findOccupation,
	formatSkillName,
	getOccupationSkillIds,
	truncate
} from '$lib/export/pdf-helpers';
import { createBlankCharacter } from '$lib/types/character';
import type {
	CoCSkillDefinition,
	CoCOccupationDefinition
} from '$lib/types/content-pack';

const def = (over: Partial<CoCSkillDefinition>): CoCSkillDefinition => ({
	id: 'x',
	name: 'X',
	baseValue: 5,
	category: 'practical',
	isSpecialization: false,
	eras: ['all'],
	...over
});

describe('filterSkillsForEra', () => {
	it('keeps "all" skills regardless of era', () => {
		const skills = [def({ id: 'a' }), def({ id: 'b', eras: ['modern'] })];
		expect(filterSkillsForEra(skills, '1920s').map((s) => s.id)).toEqual(['a']);
		expect(filterSkillsForEra(skills, 'modern').map((s) => s.id)).toEqual(['a', 'b']);
	});
});

describe('computeDerivedBase', () => {
	const chars = createBlankCharacter().characteristics;
	chars.values = { str: 50, con: 60, dex: 70, int: 80, pow: 55, app: 65, siz: 60, edu: 75 };

	it('returns baseValue when no derivedBase set', () => {
		expect(computeDerivedBase(def({ baseValue: 25 }), chars)).toBe(25);
	});

	it('returns characteristic value for plain ref (e.g. "edu")', () => {
		expect(computeDerivedBase(def({ derivedBase: 'edu', baseValue: 0 }), chars)).toBe(75);
	});

	it('floor-divides for "dex/2" form', () => {
		expect(computeDerivedBase(def({ derivedBase: 'dex/2', baseValue: 0 }), chars)).toBe(35);
	});

	it('falls back to baseValue on unparseable derivedBase', () => {
		expect(computeDerivedBase(def({ derivedBase: 'nonsense*', baseValue: 11 }), chars)).toBe(11);
	});

	it('falls back to baseValue when characteristic unknown', () => {
		expect(computeDerivedBase(def({ derivedBase: 'xyz', baseValue: 9 }), chars)).toBe(9);
	});
});

describe('formatSkillName', () => {
	it('uses content-pack name when no allocation', () => {
		expect(formatSkillName(def({ name: 'Spot Hidden' }))).toBe('Spot Hidden');
	});

	it('prefers allocation customName when set', () => {
		const allocation = {
			skillId: 'art-craft-photography',
			customName: 'Art/Craft (Daguerreotype)',
			baseValue: 5,
			allocations: [],
			isOccupation: false,
			total: 50,
			half: 25,
			fifth: 10
		};
		expect(formatSkillName(def({ name: 'Art/Craft (Photography)' }), allocation)).toBe(
			'Art/Craft (Daguerreotype)'
		);
	});
});

describe('truncate', () => {
	it('returns original when within budget', () => {
		expect(truncate('hello', 10)).toBe('hello');
	});
	it('appends ellipsis when over budget', () => {
		expect(truncate('a long sentence', 8)).toBe('a long…');
	});
	it('handles empty string', () => {
		expect(truncate('', 5)).toBe('');
	});
	it('handles maxChars <= 0', () => {
		expect(truncate('hello', 0)).toBe('');
	});
});

describe('findOccupation / getOccupationSkillIds', () => {
	const occ: CoCOccupationDefinition = {
		id: 'librarian',
		name: 'Librarian',
		eras: ['all'],
		creditRating: { min: 9, max: 35 },
		skillPointFormula: { terms: [{ characteristic: 'edu', multiplier: 4 }] },
		occupationSkills: [
			{ skillId: 'library-use', required: true },
			{ skillId: 'language-other', required: false }
		],
		personalChoiceCount: 4
	};

	it('finds occupation by id', () => {
		expect(findOccupation([occ], 'librarian')?.name).toBe('Librarian');
	});
	it('returns null for missing id', () => {
		expect(findOccupation([occ], 'pirate')).toBeNull();
		expect(findOccupation([occ], null)).toBeNull();
	});
	it('extracts occupation skill ids', () => {
		const set = getOccupationSkillIds(occ);
		expect(set.has('library-use')).toBe(true);
		expect(set.has('language-other')).toBe(true);
		expect(set.has('spot-hidden')).toBe(false);
	});
	it('returns empty set when occupation null', () => {
		expect(getOccupationSkillIds(null).size).toBe(0);
	});
});

describe('distributeIntoColumns', () => {
	it('splits items so column 1 >= column 2 >= column 3', () => {
		const cols = distributeIntoColumns([1, 2, 3, 4, 5, 6, 7], 3);
		expect(cols.map((c) => c.length)).toEqual([3, 3, 1]);
	});
	it('handles empty input', () => {
		expect(distributeIntoColumns([], 3)).toEqual([[], [], []]);
	});
	it('clamps to item count rather than emitting trailing empty columns', () => {
		expect(distributeIntoColumns([1], 3)).toEqual([[1]]);
		expect(distributeIntoColumns([1, 2], 3)).toEqual([[1], [2]]);
	});
});

describe('buildSkillRows', () => {
	const character = createBlankCharacter();
	character.characteristics.values = {
		str: 50, con: 60, dex: 70, int: 80, pow: 55, app: 65, siz: 60, edu: 75
	};

	const skills: CoCSkillDefinition[] = [
		def({ id: 'spot-hidden', name: 'Spot Hidden', baseValue: 25, category: 'investigation' }),
		def({ id: 'dodge', name: 'Dodge', baseValue: 0, derivedBase: 'dex/2', category: 'combat' }),
		def({ id: 'language-own', name: 'Language (Own)', baseValue: 0, derivedBase: 'edu', category: 'social' }),
		def({ id: 'modern-only', name: 'Modern Only', eras: ['modern'], category: 'practical' }),
		def({
			id: 'art-craft-acting',
			name: 'Art/Craft (Acting)',
			baseValue: 5,
			category: 'practical',
			isSpecialization: true,
			specializationGroup: 'art-craft',
			specializationLabel: 'Acting'
		}),
		def({
			id: 'art-craft-photography',
			name: 'Art/Craft (Photography)',
			baseValue: 5,
			category: 'practical',
			isSpecialization: true,
			specializationGroup: 'art-craft',
			specializationLabel: 'Photography'
		})
	];

	const occupation: CoCOccupationDefinition = {
		id: 'librarian',
		name: 'Librarian',
		eras: ['all'],
		creditRating: { min: 9, max: 35 },
		skillPointFormula: { terms: [{ characteristic: 'edu', multiplier: 4 }] },
		occupationSkills: [{ skillId: 'spot-hidden', required: true }],
		personalChoiceCount: 4
	};

	it('filters to era-applicable skills', () => {
		const rows1920 = buildSkillRows(character, skills, occupation);
		expect(rows1920.find((r) => r.key === 'modern-only')).toBeUndefined();

		character.era = 'modern';
		const rowsModern = buildSkillRows(character, skills, occupation);
		expect(rowsModern.find((r) => r.key === 'modern-only')).toBeDefined();
		character.era = '1920s';
	});

	it('marks occupation skills from occupation definition even without allocation', () => {
		const rows = buildSkillRows(character, skills, occupation);
		const spot = rows.find((r) => r.key === 'spot-hidden');
		expect(spot?.isOccupation).toBe(true);
	});

	it('computes derived skill bases (dex/2, edu)', () => {
		const rows = buildSkillRows(character, skills, occupation);
		expect(rows.find((r) => r.key === 'dodge')?.value).toBe(35);
		expect(rows.find((r) => r.key === 'language-own')?.value).toBe(75);
	});

	it('collapses specialization groups into one blank slot when no allocations', () => {
		const rows = buildSkillRows(character, skills, occupation);
		const acRows = rows.filter((r) => r.category === 'practical' && r.displayName.startsWith('Art/Craft'));
		expect(acRows).toHaveLength(1);
		expect(acRows[0].isBlankSlot).toBe(true);
		expect(acRows[0].displayName).toContain('________');
	});

	it('renders allocation rows + one blank slot when group has allocations', () => {
		character.skills = [
			{
				skillId: 'art-craft-acting',
				customName: null,
				baseValue: 5,
				allocations: [{ points: 45, source: 'occupation', sourceLabel: 'Librarian' }],
				isOccupation: true,
				total: 50,
				half: 25,
				fifth: 10
			}
		];
		const rows = buildSkillRows(character, skills, occupation);
		const acRows = rows.filter((r) => r.displayName.includes('Art/Craft'));
		expect(acRows).toHaveLength(2);
		expect(acRows.some((r) => r.value === 50 && !r.isBlankSlot)).toBe(true);
		expect(acRows.some((r) => r.isBlankSlot)).toBe(true);
		character.skills = [];
	});
});
