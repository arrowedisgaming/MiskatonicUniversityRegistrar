import { describe, it, expect } from 'vitest';
import {
	rollAllCharacteristics,
	rollResultsToValues,
	halfValue,
	fifthValue,
	validateCharacteristics
} from '$lib/engine/characteristics';
import { ALL_CHARACTERISTICS, ROLL_3D6, ROLL_2D6_PLUS_6 } from '$lib/types/common';

describe('rollAllCharacteristics', () => {
	it('returns results for all 8 characteristics', () => {
		const results = rollAllCharacteristics();
		expect(results).toHaveLength(8);
		const charIds = results.map((r) => r.characteristic);
		for (const c of ALL_CHARACTERISTICS) {
			expect(charIds).toContain(c);
		}
	});

	it('3d6×5 characteristics are in range 15-90', () => {
		const results = rollAllCharacteristics();
		for (const r of results) {
			if (ROLL_3D6.includes(r.characteristic)) {
				expect(r.total).toBeGreaterThanOrEqual(15);
				expect(r.total).toBeLessThanOrEqual(90);
			}
		}
	});

	it('(2d6+6)×5 characteristics are in range 40-90', () => {
		const results = rollAllCharacteristics();
		for (const r of results) {
			if (ROLL_2D6_PLUS_6.includes(r.characteristic)) {
				expect(r.total).toBeGreaterThanOrEqual(40);
				expect(r.total).toBeLessThanOrEqual(90);
			}
		}
	});
});

describe('rollResultsToValues', () => {
	it('converts results array to record', () => {
		const results = rollAllCharacteristics();
		const values = rollResultsToValues(results);
		expect(Object.keys(values)).toHaveLength(8);
		for (const r of results) {
			expect(values[r.characteristic]).toBe(r.total);
		}
	});
});

describe('halfValue', () => {
	it('returns floor of score / 2', () => {
		expect(halfValue(65)).toBe(32);
		expect(halfValue(50)).toBe(25);
		expect(halfValue(75)).toBe(37);
		expect(halfValue(15)).toBe(7);
		expect(halfValue(1)).toBe(0);
	});
});

describe('fifthValue', () => {
	it('returns floor of score / 5', () => {
		expect(fifthValue(65)).toBe(13);
		expect(fifthValue(50)).toBe(10);
		expect(fifthValue(75)).toBe(15);
		expect(fifthValue(15)).toBe(3);
		expect(fifthValue(1)).toBe(0);
	});
});

describe('validateCharacteristics', () => {
	it('accepts valid characteristic values', () => {
		const values = { str: 50, con: 60, dex: 45, int: 65, pow: 55, app: 40, siz: 60, edu: 70 };
		const result = validateCharacteristics(values);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('rejects 3d6×5 characteristics below 15', () => {
		const values = { str: 10, con: 60, dex: 45, int: 65, pow: 55, app: 40, siz: 60, edu: 70 };
		const result = validateCharacteristics(values);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('STR');
	});

	it('rejects (2d6+6)×5 characteristics below 40', () => {
		const values = { str: 50, con: 60, dex: 45, int: 30, pow: 55, app: 40, siz: 60, edu: 70 };
		const result = validateCharacteristics(values);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('INT');
	});

	it('rejects characteristics above 90', () => {
		const values = { str: 95, con: 60, dex: 45, int: 65, pow: 55, app: 40, siz: 60, edu: 70 };
		const result = validateCharacteristics(values);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('STR');
	});
});
