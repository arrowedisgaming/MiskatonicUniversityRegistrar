import { describe, it, expect } from 'vitest';
import {
	calculateHP,
	calculateMP,
	calculateStartingSanity,
	calculateMaxSanity,
	calculateDamageBonusAndBuild,
	calculateMoveRate,
	getAgeModifier,
	calculateAllDerived
} from '$lib/engine/derived-stats';
import type { DamageBonusBuildEntry, AgeModifierEntry } from '$lib/types/content-pack';

const DB_BUILD_TABLE: DamageBonusBuildEntry[] = [
	{ minSum: 2, maxSum: 64, damageBonus: '-2', build: -2 },
	{ minSum: 65, maxSum: 84, damageBonus: '-1', build: -1 },
	{ minSum: 85, maxSum: 124, damageBonus: '0', build: 0 },
	{ minSum: 125, maxSum: 164, damageBonus: '+1D4', build: 1 },
	{ minSum: 165, maxSum: 204, damageBonus: '+1D6', build: 2 }
];

const AGE_MODIFIERS: AgeModifierEntry[] = [
	{ minAge: 15, maxAge: 19, strConDexDeduction: 5, appDeduction: 0, eduImprovementChecks: 0, moveRateDeduction: 0, special: 'deduct-str-or-siz' },
	{ minAge: 20, maxAge: 39, strConDexDeduction: 0, appDeduction: 0, eduImprovementChecks: 1, moveRateDeduction: 0, special: null },
	{ minAge: 40, maxAge: 49, strConDexDeduction: 5, appDeduction: 5, eduImprovementChecks: 2, moveRateDeduction: 1, special: null },
	{ minAge: 50, maxAge: 59, strConDexDeduction: 10, appDeduction: 10, eduImprovementChecks: 3, moveRateDeduction: 2, special: null },
	{ minAge: 60, maxAge: 69, strConDexDeduction: 20, appDeduction: 15, eduImprovementChecks: 4, moveRateDeduction: 3, special: null },
	{ minAge: 70, maxAge: 79, strConDexDeduction: 40, appDeduction: 20, eduImprovementChecks: 4, moveRateDeduction: 4, special: null },
	{ minAge: 80, maxAge: 89, strConDexDeduction: 80, appDeduction: 25, eduImprovementChecks: 4, moveRateDeduction: 5, special: null }
];

describe('calculateHP', () => {
	it('returns (CON + SIZ) / 10 rounded down', () => {
		expect(calculateHP(60, 65)).toBe(12);  // 125 / 10 = 12.5 → 12
		expect(calculateHP(50, 50)).toBe(10);
		expect(calculateHP(40, 45)).toBe(8);   // 85 / 10 = 8.5 → 8
		expect(calculateHP(80, 80)).toBe(16);
	});
});

describe('calculateMP', () => {
	it('returns POW / 5 rounded down', () => {
		expect(calculateMP(65)).toBe(13);
		expect(calculateMP(50)).toBe(10);
		expect(calculateMP(42)).toBe(8);
	});
});

describe('calculateStartingSanity', () => {
	it('equals POW', () => {
		expect(calculateStartingSanity(65)).toBe(65);
		expect(calculateStartingSanity(40)).toBe(40);
	});
});

describe('calculateMaxSanity', () => {
	it('returns 99 minus Cthulhu Mythos', () => {
		expect(calculateMaxSanity(0)).toBe(99);
		expect(calculateMaxSanity(15)).toBe(84);
		expect(calculateMaxSanity(50)).toBe(49);
	});
});

describe('calculateDamageBonusAndBuild', () => {
	it('returns -2 DB and -2 Build for STR+SIZ 2-64', () => {
		const result = calculateDamageBonusAndBuild(15, 40, DB_BUILD_TABLE);
		expect(result.damageBonus).toBe('-2');
		expect(result.build).toBe(-2);
	});

	it('returns -1 DB and -1 Build for STR+SIZ 65-84', () => {
		const result = calculateDamageBonusAndBuild(30, 40, DB_BUILD_TABLE);
		expect(result.damageBonus).toBe('-1');
		expect(result.build).toBe(-1);
	});

	it('returns 0 DB and 0 Build for STR+SIZ 85-124', () => {
		const result = calculateDamageBonusAndBuild(50, 60, DB_BUILD_TABLE);
		expect(result.damageBonus).toBe('0');
		expect(result.build).toBe(0);
	});

	it('returns +1D4 DB and 1 Build for STR+SIZ 125-164', () => {
		const result = calculateDamageBonusAndBuild(70, 70, DB_BUILD_TABLE);
		expect(result.damageBonus).toBe('+1D4');
		expect(result.build).toBe(1);
	});

	it('returns +1D6 DB and 2 Build for STR+SIZ 165-204', () => {
		const result = calculateDamageBonusAndBuild(90, 80, DB_BUILD_TABLE);
		expect(result.damageBonus).toBe('+1D6');
		expect(result.build).toBe(2);
	});
});

describe('calculateMoveRate', () => {
	it('returns 9 when both DEX and STR >= SIZ', () => {
		expect(calculateMoveRate(60, 60, 50, null)).toBe(9);
	});

	it('returns 8 when only STR >= SIZ', () => {
		expect(calculateMoveRate(60, 40, 50, null)).toBe(8);
	});

	it('returns 8 when only DEX >= SIZ', () => {
		expect(calculateMoveRate(40, 60, 50, null)).toBe(8);
	});

	it('returns 7 when both STR and DEX < SIZ', () => {
		expect(calculateMoveRate(40, 40, 60, null)).toBe(7);
	});

	it('applies age modifier deduction', () => {
		const ageMod = AGE_MODIFIERS.find((m) => m.minAge === 40)!;
		expect(calculateMoveRate(60, 60, 50, ageMod)).toBe(8); // 9 - 1
	});

	it('does not go below 1', () => {
		const ageMod = AGE_MODIFIERS.find((m) => m.minAge === 80)!;
		expect(calculateMoveRate(40, 40, 60, ageMod)).toBe(2); // 7 - 5
	});
});

describe('getAgeModifier', () => {
	it('returns correct bracket for age 25', () => {
		const mod = getAgeModifier(25, AGE_MODIFIERS);
		expect(mod?.minAge).toBe(20);
		expect(mod?.strConDexDeduction).toBe(0);
	});

	it('returns correct bracket for age 55', () => {
		const mod = getAgeModifier(55, AGE_MODIFIERS);
		expect(mod?.minAge).toBe(50);
		expect(mod?.strConDexDeduction).toBe(10);
	});

	it('returns null for age outside range', () => {
		expect(getAgeModifier(10, AGE_MODIFIERS)).toBeNull();
		expect(getAgeModifier(95, AGE_MODIFIERS)).toBeNull();
	});
});

describe('calculateAllDerived', () => {
	it('computes all derived stats for a standard investigator', () => {
		const chars = { str: 60, con: 65, dex: 50, int: 70, pow: 55, app: 45, siz: 60, edu: 75 };
		const result = calculateAllDerived(chars, 30, 0, DB_BUILD_TABLE, AGE_MODIFIERS);

		expect(result.hp).toBe(12);       // (65 + 60) / 10 = 12.5 → 12
		expect(result.mp).toBe(11);       // 55 / 5 = 11
		expect(result.startingSanity).toBe(55);
		expect(result.maxSanity).toBe(99);
		expect(result.damageBonus).toBe('0'); // STR + SIZ = 120, in 85-124
		expect(result.build).toBe(0);
		expect(result.moveRate).toBe(8);  // STR(60) >= SIZ(60) but DEX(50) < SIZ(60) → 8
	});
});
