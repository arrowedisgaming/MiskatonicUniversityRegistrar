import { describe, expect, it } from 'vitest';
import { sortSkillsForDisplay } from '$lib/engine/skill-sort';
import type { CoCSkillAllocation } from '$lib/types/character';

function skill(skillId: string, total: number, customName: string | null = null): CoCSkillAllocation {
	return {
		skillId,
		customName,
		baseValue: 0,
		allocations: [],
		isOccupation: false,
		total,
		half: Math.floor(total / 2),
		fifth: Math.floor(total / 5)
	};
}

describe('sortSkillsForDisplay', () => {
	const rows = [
		skill('spot-hidden', 55),
		skill('firearms', 70, 'Rifle'),
		skill('anthropology', 70),
		skill('accounting', 20)
	];

	const names: Record<string, string> = {
		'spot-hidden': 'Spot Hidden',
		firearms: 'Firearms',
		anthropology: 'Anthropology',
		accounting: 'Accounting'
	};

	function label(row: CoCSkillAllocation): string {
		const base = names[row.skillId] ?? row.skillId;
		return row.customName ? `${base} (${row.customName})` : base;
	}

	it('sorts alphabetically in either direction', () => {
		expect(sortSkillsForDisplay(rows, 'alphabetical', 'asc', label).map(label)).toEqual([
			'Accounting',
			'Anthropology',
			'Firearms (Rifle)',
			'Spot Hidden'
		]);
		expect(sortSkillsForDisplay(rows, 'alphabetical', 'desc', label).map(label)).toEqual([
			'Spot Hidden',
			'Firearms (Rifle)',
			'Anthropology',
			'Accounting'
		]);
	});

	it('sorts rating ties alphabetically ascending', () => {
		expect(sortSkillsForDisplay(rows, 'rating', 'desc', label).map(label)).toEqual([
			'Anthropology',
			'Firearms (Rifle)',
			'Spot Hidden',
			'Accounting'
		]);
	});
});
