/**
 * Occupation filtering by era and mode.
 * Pure functions — no side effects.
 */

import type { CoCOccupationDefinition, CoCSkillDefinition } from '$lib/types/content-pack';

/** Filter occupations to those available in the given era */
export function filterOccupationsByEra(
	occupations: CoCOccupationDefinition[],
	era: string
): CoCOccupationDefinition[] {
	return occupations.filter(
		(occ) => occ.eras.includes(era) || occ.eras.includes('all')
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

/** Get all skill definitions that match a specialization group */
export function getSkillsByGroup(
	group: string,
	allSkills: CoCSkillDefinition[]
): CoCSkillDefinition[] {
	return allSkills.filter(
		(s) => s.isSpecialization && s.specializationGroup === group
	);
}
