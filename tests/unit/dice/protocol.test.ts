import { describe, expect, it } from 'vitest';
import {
	makeDiceRollRequest,
	toRendererNotation,
	validateDiceGroup
} from '$lib/dice/protocol';

describe('dice visual protocol', () => {
	it('converts multiple dice groups to predetermined renderer notation', () => {
		const request = makeDiceRollRequest([
			{ count: 3, sides: 6, results: [1, 4, 6] },
			{ count: 1, sides: 10, results: [9] }
		]);

		expect(toRendererNotation(request)).toEqual({
			notation: '3d6+1d10@1,4,6,9',
			results: [1, 4, 6, 9]
		});
	});

	it('expands d100 values to percentile dice for the renderer', () => {
		const request = makeDiceRollRequest([
			{ count: 3, sides: 100, results: [1, 73, 100] }
		]);

		expect(toRendererNotation(request)).toEqual({
			notation: '3d100+3d10@100,70,100,1,3,10',
			results: [100, 70, 100, 1, 3, 10]
		});
	});

	it('rejects impossible die results', () => {
		expect(() => validateDiceGroup({ count: 1, sides: 6, results: [7] })).toThrow(RangeError);
	});

	it('handles empty no-op requests', () => {
		const request = makeDiceRollRequest([{ count: 0, sides: 6, results: [] }]);

		expect(toRendererNotation(request)).toEqual({ notation: '0', results: [] });
	});
});
