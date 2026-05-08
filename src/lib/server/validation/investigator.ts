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
import { isCustomOccupation } from '$lib/engine/occupation-filter';

export type ValidationResult = { valid: true } | { valid: false; errors: string[] };
export type InvestigatorValidationPhase = 'creation' | 'play';

export function validateFinalInvestigator(
	char: CoCCharacterData,
	options: { phase?: InvestigatorValidationPhase } = {}
): ValidationResult {
	const errors: string[] = [];
	const phase = options.phase ?? 'play';

	if (!char.occupation) {
		errors.push('Final investigator must have an occupation');
		return { valid: false, errors };
	}

	const isCustomOcc = isCustomOccupation(char.occupation.occupationId);
	const occupation = isCustomOcc
		? null
		: getOccupations().find((o) => o.id === char.occupation!.occupationId);
	if (!isCustomOcc && !occupation) {
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

	const totalOccupationPoints = isCustomOcc
		? (char.occupation.customSkillPoints ?? 0)
		: calculateOccupationSkillPoints(
				occupation!.skillPointFormula,
				characteristics,
				char.occupation.formulaChoices as Record<string, CharacteristicId>
			);
	const totalPersonalPoints = calculatePersonalInterestPoints(characteristics.int);
	if (!Number.isFinite(totalOccupationPoints) || !Number.isFinite(totalPersonalPoints)) {
		errors.push('Skill point budget could not be computed — check formula choices');
		return { valid: false, errors };
	}

	// Eligible occupation-skill set.
	// Authority for custom-skill eligibility is customSkillDefs[].isOccupation (written at
	// creation time), never the allocation-level isOccupation flag from the same payload.
	const customDefIds = new Set(char.customSkillDefs.map((d) => d.id));
	const eligibleCustomDefs = new Set(
		char.customSkillDefs.filter((d) => d.isOccupation).map((d) => d.id)
	);

	const eligible = new Set<string>();
	if (isCustomOcc) {
		const tagged = char.occupation.customOccupationSkills ?? [];
		if (tagged.length > 0) {
			// Tagged mode: only the tagged skill ids + credit-rating + custom defs marked occupation
			for (const s of tagged) eligible.add(s);
			eligible.add('credit-rating');
			for (const id of eligibleCustomDefs) eligible.add(id);
		} else {
			// Open mode: every skill the player allocated to is eligible
			for (const skill of char.skills) eligible.add(skill.skillId);
			for (const id of eligibleCustomDefs) eligible.add(id);
		}
	} else {
		for (const s of occupation!.occupationSkills) eligible.add(s.skillId);
		eligible.add('credit-rating');
		// Trust isOccupation for content-pack skills (personal choice-slot picks);
		// for homebrew custom defs, rely on customSkillDefs[].isOccupation instead.
		for (const skill of char.skills) {
			if (skill.isOccupation && !customDefIds.has(skill.skillId)) {
				eligible.add(skill.skillId);
			}
		}
		for (const id of eligibleCustomDefs) eligible.add(id);
	}

	// Custom occupations have no credit rating constraint — accept any value 0–99.
	const creditRatingRange = isCustomOcc ? { min: 0, max: 99 } : occupation!.creditRating;
	const skillCheck = validateSkillAllocation(
		char.skills,
		totalOccupationPoints,
		totalPersonalPoints,
		creditRatingRange,
		eligible,
		{ maxSkillTotal: phase === 'creation' ? 90 : 99 }
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

	const blankWeaponCount = char.equipment.weapons.filter((w) => !w.name.trim()).length;
	if (blankWeaponCount > 0) {
		errors.push(
			`Remove or name ${blankWeaponCount} blank weapon row${blankWeaponCount === 1 ? '' : 's'} before finalizing`
		);
	}

	return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
