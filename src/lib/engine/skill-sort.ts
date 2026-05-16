import type { CoCSkillAllocation } from '$lib/types/character';

export type SkillSortMode = 'alphabetical' | 'rating';
export type SkillSortDirection = 'asc' | 'desc';

function compareNames(a: string, b: string): number {
	return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function sortSkillsForDisplay(
	skills: CoCSkillAllocation[],
	mode: SkillSortMode,
	direction: SkillSortDirection,
	displayName: (skill: CoCSkillAllocation) => string
): CoCSkillAllocation[] {
	const sign = direction === 'asc' ? 1 : -1;
	return skills.slice().sort((a, b) => {
		const nameA = displayName(a);
		const nameB = displayName(b);

		if (mode === 'rating') {
			const rating = a.total - b.total;
			if (rating !== 0) return rating * sign;
			return compareNames(nameA, nameB);
		}

		return compareNames(nameA, nameB) * sign;
	});
}
