import { describe, it, expect } from 'vitest';
import { calculateStartingWealth } from '$lib/engine/finances';
import type { WealthEntry } from '$lib/types/content-pack';

const WEALTH_TABLE: WealthEntry[] = [
	{ minCR: 0, maxCR: 0, livingStandard: 'Penniless', spendingLevel: 0.5, cashFixed: 0.5, assetsFixed: 0, assetsLabel: 'None' },
	{ minCR: 1, maxCR: 9, livingStandard: 'Poor', spendingLevel: 2, cashMultiplier: 1, assetsMultiplier: 10 },
	{ minCR: 10, maxCR: 49, livingStandard: 'Average', spendingLevel: 10, cashMultiplier: 2, assetsMultiplier: 50 },
	{ minCR: 50, maxCR: 89, livingStandard: 'Wealthy', spendingLevel: 50, cashMultiplier: 5, assetsMultiplier: 500 },
	{ minCR: 90, maxCR: 98, livingStandard: 'Rich', spendingLevel: 250, cashMultiplier: 20, assetsMultiplier: 2000 },
	{ minCR: 99, maxCR: 99, livingStandard: 'Super Rich', spendingLevel: 5000, cashFixed: 50000, assetsFixed: 5000000, assetsLabel: '$5M+' }
];

describe('calculateStartingWealth', () => {
	it('returns Poor for CR 1-9', () => {
		const result = calculateStartingWealth(5, WEALTH_TABLE);
		expect(result.livingStandard).toBe('Poor');
		expect(result.spendingLevel).toBe(2);
		expect(result.cash).toBe(5);
		expect(result.assets).toBe(50);
	});

	it('returns Penniless for CR 0', () => {
		const result = calculateStartingWealth(0, WEALTH_TABLE);
		expect(result.livingStandard).toBe('Penniless');
		expect(result.spendingLevel).toBe(0.5);
		expect(result.cash).toBe(0.5);
		expect(result.assets).toBe(0);
		expect(result.assetsLabel).toBe('None');
	});

	it('returns Average for CR 30', () => {
		const result = calculateStartingWealth(30, WEALTH_TABLE);
		expect(result.livingStandard).toBe('Average');
		expect(result.spendingLevel).toBe(10);
		expect(result.cash).toBe(60); // 2 * 30
		expect(result.assets).toBe(1500); // 50 * 30
	});

	it('returns Wealthy for CR 60', () => {
		const result = calculateStartingWealth(60, WEALTH_TABLE);
		expect(result.livingStandard).toBe('Wealthy');
		expect(result.cash).toBe(300); // 5 * 60
		expect(result.assets).toBe(30000); // 500 * 60
	});

	it('returns Rich for CR 95', () => {
		const result = calculateStartingWealth(95, WEALTH_TABLE);
		expect(result.livingStandard).toBe('Rich');
		expect(result.cash).toBe(1900); // 20 * 95
		expect(result.assets).toBe(190000); // 2000 * 95
	});

	it('returns Super Rich for CR 99', () => {
		const result = calculateStartingWealth(99, WEALTH_TABLE);
		expect(result.livingStandard).toBe('Super Rich');
		expect(result.spendingLevel).toBe(5000);
		expect(result.cash).toBe(50000);
		expect(result.assets).toBe(5000000);
		expect(result.assetsLabel).toBe('$5M+');
	});

	it('handles unknown CR gracefully', () => {
		const result = calculateStartingWealth(100, WEALTH_TABLE);
		expect(result.livingStandard).toBe('Unknown');
	});
});
