/**
 * Server-side game-rule enforcement for final investigator saves.
 *
 * Drafts skip these checks so the wizard can persist partial state.
 * Final saves (isDraft=false) must obey CoC 7e rules: skill point budgets
 * must not exceed what occupation + INT allow, derived stats must not exceed
 * what characteristics support, and Credit Rating must fall in the
 * occupation's range.
 */

import type { CoCCharacterData } from '$lib/types/character';
import type { CharacteristicId } from '$lib/types/common';
import { getOccupations, getContentPack } from '$lib/server/content/loader';
import {
	calculateOccupationSkillPoints,
	calculatePersonalInterestPoints,
	validateSkillAllocation
} from '$lib/engine/skills';
import { calculateAllDerived } from '$lib/engine/derived-stats';
import { describeWeaponDiceLimitViolations } from '$lib/engine/weapon-damage-roll';

export type ValidationResult = { valid: true } | { valid: false; errors: string[] };

export function validateFinalInvestigator(char: CoCCharacterData): ValidationResult {
	const errors: string[] = [];

	if (!char.occupation) {
		errors.push('Final investigator must have an occupation');
		return { valid: false, errors };
	}

	const occupation = getOccupations().find((o) => o.id === char.occupation!.occupationId);
	if (!occupation) {
		errors.push(`Unknown occupation: ${char.occupation.occupationId}`);
		return { valid: false, errors };
	}

	const characteristics = char.characteristics.values as Record<CharacteristicId, number>;
	for (const id of ['str', 'con', 'dex', 'int', 'pow', 'app', 'siz', 'edu'] as const) {
		const v = characteristics[id];
		if (typeof v !== 'number' || !Number.isFinite(v)) {
			errors.push(`Characteristic ${id.toUpperCase()} is missing or not a finite number`);
		}
	}
	if (errors.length > 0) return { valid: false, errors };

	const totalOccupationPoints = calculateOccupationSkillPoints(
		occupation.skillPointFormula,
		characteristics,
		char.occupation.formulaChoices as Record<string, CharacteristicId>
	);
	const totalPersonalPoints = calculatePersonalInterestPoints(characteristics.int);
	if (!Number.isFinite(totalOccupationPoints) || !Number.isFinite(totalPersonalPoints)) {
		errors.push('Skill point budget could not be computed — check formula choices');
		return { valid: false, errors };
	}

	// Eligible occupation-skill set:
	//  - explicit required + listed-optional skills from the occupation
	//  - Credit Rating (always payable from occupation points)
	//  - any skill the player has marked isOccupation: true (their chosen slot picks
	//    for personalChoiceCount / interpersonalChoiceCount / combatChoiceCount /
	//    scienceChoiceCount). The total point budget still bounds abuse.
	const eligible = new Set<string>([
		...occupation.occupationSkills.map((s) => s.skillId),
		'credit-rating'
	]);
	for (const skill of char.skills) {
		if (skill.isOccupation) eligible.add(skill.skillId);
	}
	const skillCheck = validateSkillAllocation(
		char.skills,
		totalOccupationPoints,
		totalPersonalPoints,
		occupation.creditRating,
		eligible
	);

	if (!skillCheck.valid) errors.push(...skillCheck.errors);

	const cthulhuMythos = char.skills.find((s) => s.skillId === 'cthulhu-mythos')?.total ?? 0;
	const pack = getContentPack();
	const derived = calculateAllDerived(
		characteristics,
		char.age,
		cthulhuMythos,
		pack.damageBonusBuildTable,
		pack.ageModifiers
	);

	if (char.derivedStats.hp.max > derived.hp) {
		errors.push(`HP max ${char.derivedStats.hp.max} exceeds engine-derived ${derived.hp}`);
	}
	if (char.derivedStats.mp.max > derived.mp) {
		errors.push(`MP max ${char.derivedStats.mp.max} exceeds engine-derived ${derived.mp}`);
	}
	if (char.derivedStats.sanity.max > derived.maxSanity) {
		errors.push(
			`Sanity max ${char.derivedStats.sanity.max} exceeds engine-derived ${derived.maxSanity}`
		);
	}
	if (char.derivedStats.sanity.startingValue > derived.startingSanity) {
		errors.push(
			`Starting Sanity ${char.derivedStats.sanity.startingValue} exceeds engine-derived ${derived.startingSanity}`
		);
	}
	if (char.derivedStats.moveRate > derived.moveRate) {
		errors.push(
			`Move Rate ${char.derivedStats.moveRate} exceeds engine-derived ${derived.moveRate}`
		);
	}
	if (char.derivedStats.build !== derived.build) {
		errors.push(`Build ${char.derivedStats.build} does not match engine-derived ${derived.build}`);
	}

	const weaponDiceMsg = describeWeaponDiceLimitViolations(char);
	if (weaponDiceMsg) errors.push(weaponDiceMsg);

	return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
