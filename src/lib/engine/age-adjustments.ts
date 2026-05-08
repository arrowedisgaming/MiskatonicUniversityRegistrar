/**
 * Age adjustment rules for standard CoC 7e investigator creation.
 * Pure helpers accept rolled check results so UI/tests can control randomness.
 */

import type { CharacteristicId } from '$lib/types/common';
import type { AgeModifierEntry } from '$lib/types/content-pack';
import type { AgeAdjustment, EduImprovementCheck, LuckAdjustment } from '$lib/types/character';
import { rollDie } from './dice';

export type PhysicalDeductions = Partial<Record<CharacteristicId, number>>;

export interface AgeAdjustmentResult {
	values: Record<CharacteristicId, number>;
	ageAdjustments: AgeAdjustment[];
	eduImprovementChecks: EduImprovementCheck[];
	luckAdjustment: LuckAdjustment | null;
	errors: string[];
}

export function getAgeRule(age: number, ageModifiers: AgeModifierEntry[]): AgeModifierEntry | null {
	return ageModifiers.find((m) => age >= m.minAge && age <= m.maxAge) ?? null;
}

export function requiredPhysicalDeduction(rule: AgeModifierEntry | null): number {
	return rule?.physicalDeduction ?? rule?.strConDexDeduction ?? 0;
}

export function physicalDeductionTargets(rule: AgeModifierEntry | null): CharacteristicId[] {
	return rule?.physicalDeductionTargets ?? (rule?.special === 'deduct-str-or-siz' ? ['str', 'siz'] : ['str', 'con', 'dex']);
}

export function totalDeductions(deductions: PhysicalDeductions): number {
	return Object.values(deductions).reduce((sum, value) => sum + Math.max(0, value ?? 0), 0);
}

export function applyAgeAdjustments(
	baseValues: Record<CharacteristicId, number>,
	age: number,
	ageModifiers: AgeModifierEntry[],
	physicalDeductions: PhysicalDeductions,
	eduChecks: EduImprovementCheck[],
	luckAdjustment: LuckAdjustment | null = null
): AgeAdjustmentResult {
	const rule = getAgeRule(age, ageModifiers);
	const values = { ...baseValues };
	const ageAdjustments: AgeAdjustment[] = [];
	const errors: string[] = [];

	if (!rule) {
		return {
			values,
			ageAdjustments,
			eduImprovementChecks: [],
			luckAdjustment: null,
			errors: ['Age must be between 15 and 89 for standard investigator creation.']
		};
	}

	const requiredDeduction = requiredPhysicalDeduction(rule);
	const targets = physicalDeductionTargets(rule);
	const usedDeduction = totalDeductions(physicalDeductions);

	if (usedDeduction !== requiredDeduction) {
		errors.push(`Distribute exactly ${requiredDeduction} age deduction point${requiredDeduction === 1 ? '' : 's'}.`);
	}

	for (const [characteristic, rawAmount] of Object.entries(physicalDeductions) as [CharacteristicId, number][]) {
		const amount = Math.max(0, rawAmount ?? 0);
		if (amount === 0) continue;
		if (!targets.includes(characteristic)) {
			errors.push(`${characteristic.toUpperCase()} is not eligible for this age deduction.`);
			continue;
		}
		values[characteristic] = Math.max(0, values[characteristic] - amount);
		ageAdjustments.push({ characteristic, amount: -amount, reason: `Age ${age} physical adjustment` });
	}

	if (rule.appDeduction > 0) {
		values.app = Math.max(0, values.app - rule.appDeduction);
		ageAdjustments.push({ characteristic: 'app', amount: -rule.appDeduction, reason: `Age ${age} appearance adjustment` });
	}

	if (rule.eduDeduction > 0) {
		values.edu = Math.max(0, values.edu - rule.eduDeduction);
		ageAdjustments.push({ characteristic: 'edu', amount: -rule.eduDeduction, reason: `Age ${age} education adjustment` });
	}

	if (eduChecks.length !== rule.eduImprovementChecks) {
		errors.push(`Roll ${rule.eduImprovementChecks} EDU improvement check${rule.eduImprovementChecks === 1 ? '' : 's'}.`);
	}

	for (const check of eduChecks.slice(0, rule.eduImprovementChecks)) {
		if (check.success && check.improvement > 0) {
			const previous = values.edu;
			values.edu = Math.min(99, values.edu + check.improvement);
			ageAdjustments.push({
				characteristic: 'edu',
				amount: values.edu - previous,
				reason: `Age ${age} EDU improvement check`
			});
		}
	}

	if (rule.special === 'youth' && !luckAdjustment) {
		errors.push('Roll Luck twice and keep the higher value for ages 15-19.');
	}

	return {
		values,
		ageAdjustments,
		eduImprovementChecks: eduChecks.slice(0, rule.eduImprovementChecks),
		luckAdjustment: rule.special === 'youth' ? luckAdjustment : null,
		errors
	};
}

export function makeEduImprovementCheck(
	currentEdu: number,
	roll: number,
	improvementRoll: number | null,
	source: EduImprovementCheck['source'] = 'rolled'
): EduImprovementCheck {
	const success = roll > currentEdu;
	const improvement = success ? improvementRoll ?? 0 : 0;
	return {
		roll,
		success,
		improvementRoll: success ? improvementRoll : null,
		improvement,
		resultingEdu: Math.min(99, currentEdu + improvement),
		source
	};
}

export function rollEduImprovementCheck(currentEdu: number): EduImprovementCheck {
	const roll = rollDie(100);
	const improvementRoll = roll > currentEdu ? rollDie(10) : null;
	return makeEduImprovementCheck(currentEdu, roll, improvementRoll);
}

export function recomputeEduImprovementChecks(
	startingEdu: number,
	checks: EduImprovementCheck[]
): EduImprovementCheck[] {
	let currentEdu = startingEdu;
	return checks.map((check) => {
		const next = makeEduImprovementCheck(
			currentEdu,
			Math.max(1, Math.min(100, Math.trunc(check.roll || 1))),
			check.improvementRoll === null
				? null
				: Math.max(1, Math.min(10, Math.trunc(check.improvementRoll || 1))),
			check.source ?? 'rolled'
		);
		currentEdu = next.resultingEdu;
		return next;
	});
}

export function makeYouthLuckAdjustment(firstRolls: number[], secondRolls: number[]): LuckAdjustment {
	const firstTotal = firstRolls.reduce((sum, roll) => sum + roll, 0) * 5;
	const secondTotal = secondRolls.reduce((sum, roll) => sum + roll, 0) * 5;
	return {
		reason: 'Age 15-19 Luck uses the higher of two rolls.',
		rollSets: [firstRolls, secondRolls],
		chosenTotal: Math.max(firstTotal, secondTotal)
	};
}
