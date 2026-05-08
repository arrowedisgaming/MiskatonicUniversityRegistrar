import { describe, it, expect } from 'vitest';
import {
	applyAgeAdjustments,
	makeEduImprovementCheck,
	makeYouthLuckAdjustment,
	recomputeEduImprovementChecks
} from '$lib/engine/age-adjustments';
import type { AgeModifierEntry } from '$lib/types/content-pack';

const AGE_MODIFIERS: AgeModifierEntry[] = [
	{ minAge: 15, maxAge: 19, physicalDeduction: 5, physicalDeductionTargets: ['str', 'siz'], appDeduction: 0, eduDeduction: 5, eduImprovementChecks: 0, moveRateDeduction: 0, special: 'youth' },
	{ minAge: 20, maxAge: 39, physicalDeduction: 0, physicalDeductionTargets: [], appDeduction: 0, eduDeduction: 0, eduImprovementChecks: 1, moveRateDeduction: 0, special: null },
	{ minAge: 40, maxAge: 49, physicalDeduction: 5, physicalDeductionTargets: ['str', 'con', 'dex'], appDeduction: 5, eduDeduction: 0, eduImprovementChecks: 2, moveRateDeduction: 1, special: null },
	{ minAge: 50, maxAge: 59, physicalDeduction: 10, physicalDeductionTargets: ['str', 'con', 'dex'], appDeduction: 10, eduDeduction: 0, eduImprovementChecks: 3, moveRateDeduction: 2, special: null },
	{ minAge: 60, maxAge: 69, physicalDeduction: 20, physicalDeductionTargets: ['str', 'con', 'dex'], appDeduction: 15, eduDeduction: 0, eduImprovementChecks: 4, moveRateDeduction: 3, special: null },
	{ minAge: 70, maxAge: 79, physicalDeduction: 40, physicalDeductionTargets: ['str', 'con', 'dex'], appDeduction: 20, eduDeduction: 0, eduImprovementChecks: 4, moveRateDeduction: 4, special: null },
	{ minAge: 80, maxAge: 89, physicalDeduction: 80, physicalDeductionTargets: ['str', 'con', 'dex'], appDeduction: 25, eduDeduction: 0, eduImprovementChecks: 4, moveRateDeduction: 5, special: null }
];

const BASE = { str: 60, con: 60, dex: 60, int: 60, pow: 60, app: 60, siz: 60, edu: 60 };

describe('applyAgeAdjustments', () => {
	it('applies 15-19 physical, EDU, and Luck requirements', () => {
		const luck = makeYouthLuckAdjustment([1, 1, 1], [6, 6, 6]);
		const result = applyAgeAdjustments(BASE, 17, AGE_MODIFIERS, { str: 2, siz: 3 }, [], luck);

		expect(result.errors).toEqual([]);
		expect(result.values.str).toBe(58);
		expect(result.values.siz).toBe(57);
		expect(result.values.edu).toBe(55);
		expect(result.luckAdjustment?.chosenTotal).toBe(90);
	});

	it('requires the exact physical deduction total', () => {
		const result = applyAgeAdjustments(BASE, 45, AGE_MODIFIERS, { str: 3 }, [
			makeEduImprovementCheck(60, 80, 4),
			makeEduImprovementCheck(64, 50, null)
		]);

		expect(result.errors.some((error) => error.includes('exactly 5'))).toBe(true);
	});

	it('applies EDU improvement checks sequentially and caps at 99', () => {
		const result = applyAgeAdjustments({ ...BASE, edu: 95 }, 40, AGE_MODIFIERS, { str: 5 }, [
			makeEduImprovementCheck(95, 96, 8),
			makeEduImprovementCheck(99, 100, 5)
		]);

		expect(result.errors).toEqual([]);
		expect(result.values.edu).toBe(99);
		expect(result.values.app).toBe(55);
	});

	it('covers older age brackets with correct deductions', () => {
		const result = applyAgeAdjustments(BASE, 80, AGE_MODIFIERS, { str: 30, con: 25, dex: 25 }, [
			makeEduImprovementCheck(60, 10, null),
			makeEduImprovementCheck(60, 10, null),
			makeEduImprovementCheck(60, 10, null),
			makeEduImprovementCheck(60, 10, null)
		]);

		expect(result.errors).toEqual([]);
		expect(result.values.str).toBe(30);
		expect(result.values.con).toBe(35);
		expect(result.values.dex).toBe(35);
		expect(result.values.app).toBe(35);
	});
});

describe('recomputeEduImprovementChecks', () => {
	it('replays existing checks deterministically from a starting EDU', () => {
		const checks = [
			makeEduImprovementCheck(60, 80, 4),  // success → 64
			makeEduImprovementCheck(64, 50, null), // miss
			makeEduImprovementCheck(64, 70, 6)   // success → 70
		];
		const replayed = recomputeEduImprovementChecks(60, checks);
		expect(replayed).toEqual(checks);
	});

	it('caps resultingEdu at 99 even when accumulated improvements would exceed it', () => {
		const replayed = recomputeEduImprovementChecks(95, [
			makeEduImprovementCheck(95, 96, 8),  // 95 + 8 = 103, capped to 99
			makeEduImprovementCheck(99, 100, 5)  // 99 + 5 = 104, still capped
		]);
		expect(replayed[0].resultingEdu).toBe(99);
		expect(replayed[1].resultingEdu).toBe(99);
	});

	it('returns a stable prefix when trimmed (age-bracket shrink case)', () => {
		const fullChecks = [
			makeEduImprovementCheck(60, 80, 4),
			makeEduImprovementCheck(64, 70, 3),
			makeEduImprovementCheck(67, 90, 5)
		];
		const trimmed = recomputeEduImprovementChecks(60, fullChecks.slice(0, 1));
		expect(trimmed.length).toBe(1);
		expect(trimmed[0].resultingEdu).toBe(fullChecks[0].resultingEdu);
	});

	it('clamps malformed roll values into the legal range without crashing', () => {
		const garbage = [
			{ ...makeEduImprovementCheck(60, 80, 4), roll: 999, improvementRoll: 99 }
		];
		const replayed = recomputeEduImprovementChecks(60, garbage);
		expect(replayed[0].roll).toBeLessThanOrEqual(100);
		expect(replayed[0].roll).toBeGreaterThanOrEqual(1);
		expect(replayed[0].improvementRoll === null || replayed[0].improvementRoll <= 10).toBe(true);
	});
});
