/**
 * Investigator sheet visibility and add-skill-picker filtering (pure, no UI).
 */

import type { CoCSkillAllocation } from '$lib/types/character';
import type { CoCSkillDefinition } from '$lib/types/content-pack';

export function shouldShowInvestigatorSkillOnSheet(skill: CoCSkillAllocation): boolean {
	if (skill.isOccupation) return true;
	if (skill.total > skill.baseValue) return true;
	return (
		!skill.isOccupation &&
		skill.total === skill.baseValue &&
		skill.allocations.length === 0
	);
}

export function skillDefMatchesInvestigatorEra(def: CoCSkillDefinition, era: string): boolean {
	return def.eras.some((e) => e === 'all' || e === era);
}

export function filterSkillDefsForSheetAddPicker(
	defs: CoCSkillDefinition[],
	era: string,
	options: { hideUncommonAndRestricted: boolean; existingSkillIds: ReadonlySet<string> }
): CoCSkillDefinition[] {
	return defs.filter((d) => {
		if (!skillDefMatchesInvestigatorEra(d, era)) return false;
		// Customizable defs (e.g. Other Language, Art/Craft) can appear multiple times
		// with different customName values, so don't filter them by id presence.
		if (!d.isCustomizable && options.existingSkillIds.has(d.id)) return false;
		if (options.hideUncommonAndRestricted) {
			if (d.uncommon) return false;
			if (d.noPointAllocation) return false;
		}
		return true;
	});
}

export function skillDefMatchesSheetAddSearch(def: CoCSkillDefinition, query: string): boolean {
	const trimmed = query.trim().toLowerCase();
	if (!trimmed) return true;
	const haystack = `${def.name} ${def.id.replace(/-/g, ' ')} ${def.category}`.toLowerCase();
	const tokens = trimmed.split(/\s+/).filter(Boolean);
	return tokens.every((t) => haystack.includes(t));
}
