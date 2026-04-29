/**
 * Skill point calculation, allocation, and validation.
 * Pure functions — no side effects.
 */

import type { CharacteristicId } from '$lib/types/common';
import type { SkillPointFormula, CoCSkillDefinition } from '$lib/types/content-pack';
import type { CoCSkillAllocation, SkillPointAllocation } from '$lib/types/character';
import { halfValue, fifthValue } from './characteristics';

/**
 * Calculate total occupation skill points from formula + characteristics.
 *
 * Example: EDU×4 → characteristics.edu * 4
 * Example: EDU×2 + APP×2 → (characteristics.edu * 2) + (characteristics.app * 2)
 * Example: EDU×2 + (STR or DEX)×2 → requires formulaChoices to resolve
 */
export function calculateOccupationSkillPoints(
	formula: SkillPointFormula,
	characteristics: Record<CharacteristicId, number>,
	formulaChoices?: Record<string, CharacteristicId>
): number {
	let total = 0;

	for (const term of formula.terms) {
		total += characteristics[term.characteristic] * term.multiplier;
	}

	if (formula.choiceTerms) {
		for (let i = 0; i < formula.choiceTerms.length; i++) {
			const choice = formula.choiceTerms[i];
			// Use the player's choice, or default to the first option
			const chosenChar = formulaChoices?.[String(i)] ?? choice.options[0];
			total += characteristics[chosenChar] * choice.multiplier;
		}
	}

	return total;
}

/**
 * Calculate personal interest skill points.
 * Personal Interest Points = INT × 2
 */
export function calculatePersonalInterestPoints(int: number): number {
	return int * 2;
}

/**
 * Resolve the effective base value for a skill, handling derived bases.
 * - Dodge: DEX / 2
 * - Language (Own): EDU
 */
export function resolveSkillBaseValue(
	skill: CoCSkillDefinition,
	characteristics: Record<CharacteristicId, number>
): number {
	if (!skill.derivedBase) return skill.baseValue;

	if (skill.derivedBase === 'dex/2') {
		return Math.floor(characteristics.dex / 2);
	}
	if (skill.derivedBase === 'edu') {
		return characteristics.edu;
	}

	return skill.baseValue;
}

/**
 * Compute a skill's total, half, and fifth from base + allocations.
 */
export function computeSkillValues(
	baseValue: number,
	allocations: SkillPointAllocation[]
): { total: number; half: number; fifth: number } {
	const totalAllocated = allocations.reduce((sum, a) => sum + a.points, 0);
	const total = baseValue + totalAllocated;
	return {
		total,
		half: halfValue(total),
		fifth: fifthValue(total)
	};
}

/**
 * Create a full skill allocation record.
 */
export function createSkillAllocation(
	skillId: string,
	baseValue: number,
	allocations: SkillPointAllocation[],
	isOccupation: boolean,
	customName?: string
): CoCSkillAllocation {
	const { total, half, fifth } = computeSkillValues(baseValue, allocations);
	return {
		skillId,
		customName: customName ?? null,
		baseValue,
		allocations,
		isOccupation,
		total,
		half,
		fifth
	};
}

/**
 * Validate the full skill allocation for an investigator.
 */
export function validateSkillAllocation(
	skills: CoCSkillAllocation[],
	totalOccupationPoints: number,
	totalPersonalPoints: number,
	creditRatingRange: { min: number; max: number },
	eligibleOccupationSkillIds?: Set<string>
): {
	valid: boolean;
	errors: string[];
	occupationPointsUsed: number;
	personalPointsUsed: number;
	occupationPointsRemaining: number;
	personalPointsRemaining: number;
} {
	const errors: string[] = [];
	let occupationPointsUsed = 0;
	let personalPointsUsed = 0;

	for (const skill of skills) {
		for (const alloc of skill.allocations) {
			if (alloc.source === 'occupation') {
				occupationPointsUsed += alloc.points;
				if (eligibleOccupationSkillIds && !eligibleOccupationSkillIds.has(skill.skillId)) {
					errors.push(`${skill.skillId} is not eligible for occupation points`);
				}
			} else if (alloc.source === 'personal-interest') {
				personalPointsUsed += alloc.points;
				if (skill.skillId === 'cthulhu-mythos' && alloc.points > 0) {
					errors.push('Cthulhu Mythos cannot receive personal interest points at creation');
				}
			}
		}

		// No individual skill can exceed 99
		if (skill.total > 99) {
			errors.push(`${skill.skillId} exceeds maximum of 99 (${skill.total})`);
		}
	}

	if (occupationPointsUsed > totalOccupationPoints) {
		errors.push(
			`Occupation points overspent: ${occupationPointsUsed}/${totalOccupationPoints}`
		);
	}

	if (personalPointsUsed > totalPersonalPoints) {
		errors.push(
			`Personal interest points overspent: ${personalPointsUsed}/${totalPersonalPoints}`
		);
	}

	// Validate Credit Rating is within occupation range
	const creditRating = skills.find((s) => s.skillId === 'credit-rating');
	if (!creditRating || creditRating.total === 0) {
		errors.push(`Credit Rating must be between ${creditRatingRange.min} and ${creditRatingRange.max}`);
	} else {
		if (creditRating.total < creditRatingRange.min) {
			errors.push(
				`Credit Rating ${creditRating.total} is below occupation minimum of ${creditRatingRange.min}`
			);
		}
		if (creditRating.total > creditRatingRange.max) {
			errors.push(
				`Credit Rating ${creditRating.total} exceeds occupation maximum of ${creditRatingRange.max}`
			);
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		occupationPointsUsed,
		personalPointsUsed,
		occupationPointsRemaining: totalOccupationPoints - occupationPointsUsed,
		personalPointsRemaining: totalPersonalPoints - personalPointsUsed
	};
}
