/**
 * Occupation filtering by era and mode.
 * Pure functions — no side effects.
 */

import type { CoCOccupationDefinition, CoCSkillDefinition } from '$lib/types/content-pack';
import type { CustomSkillDef } from '$lib/types/character';

/** Filter occupations to those available in the given era */
export function filterOccupationsByEra(
	occupations: CoCOccupationDefinition[],
	era: string
): CoCOccupationDefinition[] {
	return occupations.filter(
		(occ) => occ.eras.some((e) => e === era || e === 'all')
	);
}

/** Get the required and optional occupation skills for a given occupation */
export function getOccupationSkillLists(
	occupation: CoCOccupationDefinition,
	allSkills: CoCSkillDefinition[]
): {
	required: CoCSkillDefinition[];
	optional: CoCSkillDefinition[];
} {
	const skillMap = new Map(allSkills.map((s) => [s.id, s]));
	const required: CoCSkillDefinition[] = [];

	for (const entry of occupation.occupationSkills) {
		if (entry.required) {
			const skill = skillMap.get(entry.skillId);
			if (skill) required.push(skill);
		}
	}

	// Optional skills are all non-required occupation skills
	const optional: CoCSkillDefinition[] = [];
	for (const entry of occupation.occupationSkills) {
		if (!entry.required) {
			const skill = skillMap.get(entry.skillId);
			if (skill) optional.push(skill);
		}
	}

	return { required, optional };
}

/** The four interpersonal skills a player can choose from */
export const INTERPERSONAL_SKILLS = ['charm', 'fast-talk', 'intimidate', 'persuade'];

/** Combat skill groups for occupation choice slots */
export const COMBAT_SKILL_GROUPS = ['fighting', 'firearms'];

/** True when the occupation slot represents a player-defined custom occupation */
export function isCustomOccupation(occupationId: string): boolean {
	return occupationId === 'custom';
}

/**
 * Resolve the display name of a skill, checking custom defs before the content pack.
 * Falls back to prettifying the skillId if neither source has the skill.
 */
export function resolveSkillDisplayName(
	skillId: string,
	customSkillDefs: CustomSkillDef[],
	allSkills: CoCSkillDefinition[]
): string {
	const custom = customSkillDefs.find((d) => d.id === skillId);
	if (custom) return custom.name;
	const pack = allSkills.find((s) => s.id === skillId);
	if (pack) return pack.name;
	return skillId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/** Get all skill definitions that match a specialization group */
export function getSkillsByGroup(
	group: string,
	allSkills: CoCSkillDefinition[]
): CoCSkillDefinition[] {
	return allSkills.filter(
		(s) => s.isSpecialization && s.specializationGroup === group
	);
}
