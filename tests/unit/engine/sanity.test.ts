import { describe, expect, it } from 'vitest';
import {
	applySanLoss,
	dailyLossSoFar,
	dailySanThreshold,
	parseSanLossFormula,
	resetSanDay,
	rollSanLoss
} from '$lib/engine/sanity';
import type { PlayRollHistoryEntry } from '$lib/types/character';

describe('sanity tools', () => {
	it('parses and rolls simple SAN loss formulas', () => {
		const formula = parseSanLossFormula('0/1D6');
		expect(rollSanLoss(formula, 'success')).toEqual({ amount: 0, rolls: [] });
		expect(rollSanLoss(formula, 'failure', () => 4)).toEqual({ amount: 4, rolls: [4] });
	});

	it('rejects malformed formulas', () => {
		expect(() => parseSanLossFormula('1D6')).toThrow();
		expect(() => parseSanLossFormula('1D3/1D10+2')).toThrow();
	});

	it('flags temporary and indefinite suggestions when thresholds are crossed', () => {
		expect(
			applySanLoss(
				{ currentSanity: 50, maxSanity: 80, dailySanStart: 50, dailyLossSoFar: 5 },
				5
			)
		).toEqual({ sanAfter: 45, triggeredTemporary: true, triggeredIndefinite: true });
	});

	it('rejects flat SAN loss values above the schema cap', () => {
		expect(() => parseSanLossFormula('0/500')).toThrow();
		expect(() => parseSanLossFormula('150/1D6')).toThrow();
		// In-range flat values still parse.
		const formula = parseSanLossFormula('0/100');
		expect(rollSanLoss(formula, 'failure')).toEqual({ amount: 100, rolls: [] });
	});

	it('rejects dice SAN loss formulas whose maximum roll exceeds the schema cap', () => {
		// 2D100 (max 200), 20D6 (max 120), 11D10 (max 110) all exceed 100.
		expect(() => parseSanLossFormula('0/2D100')).toThrow();
		expect(() => parseSanLossFormula('0/20D6')).toThrow();
		expect(() => parseSanLossFormula('0/11D10')).toThrow();
		// Common in-range dice formulas still work.
		expect(() => parseSanLossFormula('0/1D100')).not.toThrow();
		expect(() => parseSanLossFormula('1D3/1D8')).not.toThrow();
		expect(() => parseSanLossFormula('0/10D10')).not.toThrow(); // 10×10 = 100 exactly
	});

	it('counts only positive losses toward the daily cumulative threshold, ignoring rewards', () => {
		const reset = resetSanDay(50, new Date('2026-05-15T10:00:00.000Z'));
		expect(reset.dailySanStart).toBe(50);
		expect(dailySanThreshold(reset.dailySanStart)).toBe(10);

		const history: PlayRollHistoryEntry[] = [
			{
				id: 'loss-2',
				at: '2026-05-15T12:00:00.000Z',
				targetKind: 'sanLoss',
				source: 'Second',
				formula: null,
				successAmount: null,
				failureAmount: null,
				applied: 4,
				triggeredTemporary: false,
				triggeredIndefinite: false,
				sanBefore: 48,
				sanAfter: 44
			},
			{
				id: 'reward',
				at: '2026-05-15T11:00:00.000Z',
				targetKind: 'sanLoss',
				source: 'Development reward',
				formula: null,
				successAmount: null,
				failureAmount: null,
				applied: -2,
				triggeredTemporary: false,
				triggeredIndefinite: false,
				sanBefore: 46,
				sanAfter: 48
			},
			{
				id: 'loss-1',
				at: '2026-05-15T10:30:00.000Z',
				targetKind: 'sanLoss',
				source: 'First',
				formula: null,
				successAmount: null,
				failureAmount: null,
				applied: 6,
				triggeredTemporary: true,
				triggeredIndefinite: false,
				sanBefore: 52,
				sanAfter: 46
			}
		];

		// Losses 4 + 6 = 10; the -2 reward affects current SAN but must not
		// reduce cumulative daily loss for the indefinite-insanity threshold.
		expect(dailyLossSoFar(history, reset.dailySanResetAt)).toBe(10);
	});
});
