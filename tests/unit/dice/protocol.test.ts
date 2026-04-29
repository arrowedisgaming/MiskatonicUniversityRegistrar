import { describe, expect, it } from 'vitest';
import {
	makeDiceRollRequest,
	toRendererNotation,
	userFacingResults,
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

	it('exposes user-facing d100 results without percentile expansion', () => {
		const request = makeDiceRollRequest([
			{ count: 3, sides: 100, results: [1, 73, 100] },
			{ count: 1, sides: 6, results: [4] }
		]);

		// Renderer notation uses the expanded tens/ones representation (10 numbers)
		expect(toRendererNotation(request).results).toHaveLength(7);
		// User-facing results stay in the original 1..100 form (4 numbers)
		expect(userFacingResults(request)).toEqual([1, 73, 100, 4]);
	});
});
