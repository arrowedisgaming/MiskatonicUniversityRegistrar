import { describe, expect, it } from 'vitest';
import type { CoCSkillAllocation } from '$lib/types/character';
import type { CoCSkillDefinition } from '$lib/types/content-pack';
import {
	filterSkillDefsForSheetAddPicker,
	shouldShowInvestigatorSkillOnSheet,
	skillDefMatchesInvestigatorEra,
	skillDefMatchesSheetAddSearch
} from '$lib/engine/investigator-sheet-skills';

function skill(partial: Partial<CoCSkillAllocation> & Pick<CoCSkillAllocation, 'skillId'>): CoCSkillAllocation {
	const baseValue = partial.baseValue ?? 5;
	return {
		skillId: partial.skillId,
		customName: partial.customName ?? null,
		baseValue,
		allocations: partial.allocations ?? [],
		isOccupation: partial.isOccupation ?? false,
		total: partial.total ?? baseValue,
		half: partial.half ?? 2,
		fifth: partial.fifth ?? 1
	};
}

describe('shouldShowInvestigatorSkillOnSheet', () => {
	it('shows occupation-listed skills even at base with no allocations', () => {
		expect(
			shouldShowInvestigatorSkillOnSheet(
				skill({ skillId: 'credit-rating', isOccupation: true, total: 30, baseValue: 30, allocations: [] })
			)
		).toBe(true);
	});

	it('shows non-occupation skills above base', () => {
		expect(
			shouldShowInvestigatorSkillOnSheet(
				skill({
					skillId: 'pilot',
					isOccupation: false,
					baseValue: 1,
					total: 45,
					allocations: [{ points: 44, source: 'experience', sourceLabel: 'Experience' }]
				})
			)
		).toBe(true);
	});

	it('shows sheet-added base-only skill (no allocations, not occupation)', () => {
		expect(
			shouldShowInvestigatorSkillOnSheet(
				skill({
					skillId: 'pilot',
					isOccupation: false,
					baseValue: 1,
					total: 1,
					allocations: []
				})
			)
		).toBe(true);
	});

});

describe('filterSkillDefsForSheetAddPicker', () => {
	const era = '1920s';
	const cleanDefs: CoCSkillDefinition[] = [
		{
			id: 'charm',
			name: 'Charm',
			baseValue: 15,
			category: 'social',
			isSpecialization: false,
			eras: ['all']
		},
		{
			id: 'demolitions',
			name: 'Demolitions',
			baseValue: 1,
			category: 'practical',
			isSpecialization: false,
			eras: ['all'],
			uncommon: true
		},
		{
			id: 'cthulhu-mythos',
			name: 'Cthulhu Mythos',
			baseValue: 0,
			category: 'academic',
			isSpecialization: false,
			eras: ['all'],
			noPointAllocation: true
		},
		{
			id: 'wrong-era',
			name: 'Future Era Only',
			baseValue: 5,
			category: 'practical',
			isSpecialization: false,
			eras: ['modern']
		},
		{
			id: 'language-other',
			name: 'Language (Other)',
			baseValue: 1,
			category: 'language',
			isSpecialization: true,
			isCustomizable: true,
			eras: ['all']
		}
	];

	it('drops wrong era and existing IDs', () => {
		const out = filterSkillDefsForSheetAddPicker(cleanDefs, era, {
			hideUncommonAndRestricted: false,
			existingSkillIds: new Set(['charm'])
		});
		expect(out.map((d) => d.id).sort()).toEqual(
			['demolitions', 'cthulhu-mythos', 'language-other'].sort()
		);
	});

	it('keeps customizable defs in the picker even when an existing row already uses that id', () => {
		const out = filterSkillDefsForSheetAddPicker(cleanDefs, era, {
			hideUncommonAndRestricted: false,
			existingSkillIds: new Set(['language-other'])
		});
		expect(out.map((d) => d.id)).toContain('language-other');
	});

	it('when hiding uncommon and restricted, mythos and demolitions disappear', () => {
		const out = filterSkillDefsForSheetAddPicker(cleanDefs, era, {
			hideUncommonAndRestricted: true,
			existingSkillIds: new Set()
		});
		expect(out.map((d) => d.id)).toContain('charm');
		expect(out.every((d) => d.id !== 'cthulhu-mythos' && d.id !== 'demolitions')).toBe(true);
	});
});

describe('skillDefMatchesInvestigatorEra', () => {
	it('matches all eras', () => {
		expect(
			skillDefMatchesInvestigatorEra(
				{ id: 'x', name: 'X', baseValue: 5, category: 'x', isSpecialization: false, eras: ['all'] },
				'1920s'
			)
		).toBe(true);
	});
	it('matches specific era', () => {
		expect(
			skillDefMatchesInvestigatorEra(
				{
					id: 'x',
					name: 'X',
					baseValue: 5,
					category: 'x',
					isSpecialization: false,
					eras: ['modern']
				},
				'modern'
			)
		).toBe(true);
	});
});

describe('skillDefMatchesSheetAddSearch', () => {
	const def: CoCSkillDefinition = {
		id: 'pilot',
		name: 'Pilot',
		baseValue: 1,
		category: 'practical',
		isSpecialization: false,
		eras: ['all']
	};
	it('empty query matches', () => {
		expect(skillDefMatchesSheetAddSearch(def, '')).toBe(true);
	});
	it('matches name tokens', () => {
		expect(skillDefMatchesSheetAddSearch(def, 'pil')).toBe(true);
		expect(skillDefMatchesSheetAddSearch(def, 'pilot')).toBe(true);
	});
	it('requires all tokens', () => {
		expect(skillDefMatchesSheetAddSearch(def, 'pil practical')).toBe(true);
		expect(skillDefMatchesSheetAddSearch(def, 'pil nomatch')).toBe(false);
	});
});
