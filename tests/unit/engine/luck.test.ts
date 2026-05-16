import { describe, expect, it } from 'vitest';
import { clampLuckCurrent } from '$lib/engine/luck';

describe('clampLuckCurrent', () => {
	it('caps current Luck at 99 and floors at 0', () => {
		expect(clampLuckCurrent(105)).toBe(99);
		expect(clampLuckCurrent(-4)).toBe(0);
	});

	it('allows current Luck above starting Luck', () => {
		expect(clampLuckCurrent(73)).toBe(73);
	});
});
