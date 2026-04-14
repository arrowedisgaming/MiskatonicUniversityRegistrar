import { describe, it, expect } from 'vitest';
import { calculateStartingWealth } from '$lib/engine/finances';
import type { WealthEntry } from '$lib/types/content-pack';

const WEALTH_TABLE: WealthEntry[] = [
	{ minCR: 0, maxCR: 9, spendingLevel: 'Penniless', cash: 0.5, assetsMultiplier: 0 },
	{ minCR: 10, maxCR: 49, spendingLevel: 'Average', cash: 2, assetsMultiplier: 10 },
	{ minCR: 50, maxCR: 89, spendingLevel: 'Wealthy', cash: 5, assetsMultiplier: 50 },
	{ minCR: 90, maxCR: 98, spendingLevel: 'Rich', cash: 20, assetsMultiplier: 500 },
	{ minCR: 99, maxCR: 99, spendingLevel: 'Super Rich', cash: 50, assetsMultiplier: 5000 }
];

describe('calculateStartingWealth', () => {
	it('returns Penniless for CR 0-9', () => {
		const result = calculateStartingWealth(5, WEALTH_TABLE);
		expect(result.spendingLevel).toBe('Penniless');
		expect(result.cash).toBe(3); // 0.5 * 5 = 2.5 → rounded to 3
		expect(result.assets).toBe(0);
	});

	it('returns Average for CR 30', () => {
		const result = calculateStartingWealth(30, WEALTH_TABLE);
		expect(result.spendingLevel).toBe('Average');
		expect(result.cash).toBe(60); // 2 * 30
		expect(result.assets).toBe(300); // 10 * 30
	});

	it('returns Wealthy for CR 60', () => {
		const result = calculateStartingWealth(60, WEALTH_TABLE);
		expect(result.spendingLevel).toBe('Wealthy');
		expect(result.cash).toBe(300); // 5 * 60
		expect(result.assets).toBe(3000); // 50 * 60
	});

	it('returns Rich for CR 95', () => {
		const result = calculateStartingWealth(95, WEALTH_TABLE);
		expect(result.spendingLevel).toBe('Rich');
		expect(result.cash).toBe(1900); // 20 * 95
		expect(result.assets).toBe(47500); // 500 * 95
	});

	it('returns Super Rich for CR 99', () => {
		const result = calculateStartingWealth(99, WEALTH_TABLE);
		expect(result.spendingLevel).toBe('Super Rich');
		expect(result.cash).toBe(4950); // 50 * 99
		expect(result.assets).toBe(495000); // 5000 * 99
	});

	it('handles unknown CR gracefully', () => {
		const result = calculateStartingWealth(100, WEALTH_TABLE);
		expect(result.spendingLevel).toBe('Unknown');
	});
});
