import { describe, it, expect } from 'vitest';
import {
	filterOccupationsByEra,
	getOccupationSkillLists,
	getSkillsByGroup,
	INTERPERSONAL_SKILLS,
	COMBAT_SKILL_GROUPS
} from '$lib/engine/occupation-filter';
import type { CoCOccupationDefinition, CoCSkillDefinition } from '$lib/types/content-pack';

const skill = (overrides: Partial<CoCSkillDefinition>): CoCSkillDefinition => ({
	id: 'spot-hidden',
	name: 'Spot Hidden',
	baseValue: 25,
	category: 'investigation',
	isSpecialization: false,
	eras: ['all'],
	...overrides
});

const occupation = (overrides: Partial<CoCOccupationDefinition>): CoCOccupationDefinition => ({
	id: 'detective',
	name: 'Detective',
	eras: ['1920s'],
	creditRating: { min: 20, max: 50 },
	skillPointFormula: { terms: [{ characteristic: 'edu', multiplier: 4 }] },
	occupationSkills: [],
	personalChoiceCount: 1,
	...overrides
});

describe('filterOccupationsByEra', () => {
	it('returns occupations whose eras include the requested era', () => {
		const occs = [
			occupation({ id: 'a', eras: ['1920s'] }),
			occupation({ id: 'b', eras: ['modern'] }),
			occupation({ id: 'c', eras: ['1920s', 'modern'] })
		];
		expect(filterOccupationsByEra(occs, '1920s').map((o) => o.id)).toEqual(['a', 'c']);
		expect(filterOccupationsByEra(occs, 'modern').map((o) => o.id)).toEqual(['b', 'c']);
	});

	it('treats "all" as a wildcard era', () => {
		const occs = [occupation({ id: 'wild', eras: ['all'] })];
		expect(filterOccupationsByEra(occs, '1920s').map((o) => o.id)).toEqual(['wild']);
		expect(filterOccupationsByEra(occs, 'modern').map((o) => o.id)).toEqual(['wild']);
	});

	it('returns an empty list when no occupation matches', () => {
		expect(filterOccupationsByEra([occupation({ eras: ['modern'] })], '1920s')).toEqual([]);
	});
});

describe('getOccupationSkillLists', () => {
	const skills = [
		skill({ id: 'spot-hidden' }),
		skill({ id: 'library-use' }),
		skill({ id: 'persuade' })
	];

	it('separates required from optional occupation skills', () => {
		const occ = occupation({
			occupationSkills: [
				{ skillId: 'spot-hidden', required: true },
				{ skillId: 'library-use', required: true },
				{ skillId: 'persuade', required: false }
			]
		});
		const { required, optional } = getOccupationSkillLists(occ, skills);
		expect(required.map((s) => s.id)).toEqual(['spot-hidden', 'library-use']);
		expect(optional.map((s) => s.id)).toEqual(['persuade']);
	});

	it('drops occupation entries that reference unknown skills', () => {
		const occ = occupation({
			occupationSkills: [
				{ skillId: 'spot-hidden', required: true },
				{ skillId: 'unknown-skill', required: true }
			]
		});
		const { required } = getOccupationSkillLists(occ, skills);
		expect(required.map((s) => s.id)).toEqual(['spot-hidden']);
	});
});

describe('getSkillsByGroup', () => {
	it('returns only specializations in the named group', () => {
		const skills = [
			skill({ id: 'science-biology', isSpecialization: true, specializationGroup: 'science' }),
			skill({ id: 'science-physics', isSpecialization: true, specializationGroup: 'science' }),
			skill({ id: 'art-painting', isSpecialization: true, specializationGroup: 'art' }),
			skill({ id: 'spot-hidden', isSpecialization: false })
		];
		expect(getSkillsByGroup('science', skills).map((s) => s.id)).toEqual([
			'science-biology',
			'science-physics'
		]);
	});
});

describe('filterOccupationsByEra — gaslight', () => {
	it('returns gaslight-tagged occupations', () => {
		const occs = [
			occupation({ id: 'a', eras: ['gaslight'] }),
			occupation({ id: 'b', eras: ['1920s'] }),
			occupation({ id: 'c', eras: ['gaslight', '1920s'] }),
			occupation({ id: 'd', eras: ['all'] })
		];
		const result = filterOccupationsByEra(occs, 'gaslight').map((o) => o.id);
		expect(result).toContain('a');
		expect(result).not.toContain('b');
		expect(result).toContain('c');
		expect(result).toContain('d'); // 'all' wildcard
	});
});

describe('skill group constants', () => {
	it('expose the four interpersonal skills used by occupation choice slots', () => {
		expect(INTERPERSONAL_SKILLS).toHaveLength(4);
		expect(INTERPERSONAL_SKILLS).toContain('charm');
		expect(INTERPERSONAL_SKILLS).toContain('persuade');
	});

	it('expose the combat specialization groups', () => {
		expect(COMBAT_SKILL_GROUPS).toEqual(['fighting', 'firearms']);
	});
});
