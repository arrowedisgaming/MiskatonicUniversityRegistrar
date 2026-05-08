/**
 * Investigator sheet visibility and add-skill-picker filtering (pure, no UI).
 */

import type { CoCCharacterData, CoCSkillAllocation } from '$lib/types/character';
import type { CoCSkillDefinition } from '$lib/types/content-pack';
import { resolveSkillBaseValue, createSkillAllocation } from './skills';

export function shouldShowInvestigatorSkillOnSheet(skill: CoCSkillAllocation): boolean {
	if (skill.isOccupation) return true;
	if (skill.total > skill.baseValue) return true;
	return (
		!skill.isOccupation &&
		skill.total === skill.baseValue &&
		skill.allocations.length === 0
	);
}

/**
 * Build the full skill list for Play Mode: every era-appropriate skill at its
 * current value (or base value if never allocated). Unallocated specializations
 * are omitted — a player must pick a specialty before there's anything to roll.
 */
export function buildPlayModeSkills(
	character: CoCCharacterData,
	allDefs: CoCSkillDefinition[]
): CoCSkillAllocation[] {
	const eraDefs = allDefs.filter(
		(d) => d.eras.includes('all') || d.eras.includes(character.era)
	);
	// Use a Set (not Map) so duplicate customizable skills (e.g. two Language (Other)
	// rows with the same skillId but different customName) are all preserved.
	const allocatedIds = new Set(character.skills.map((s) => s.skillId));

	const result: CoCSkillAllocation[] = [...character.skills];
	for (const def of eraDefs) {
		if (allocatedIds.has(def.id)) continue;
		if (def.isSpecialization) continue;
		const base = resolveSkillBaseValue(def, character.characteristics.values);
		result.push(createSkillAllocation(def.id, base, [], false));
	}
	return result;
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
