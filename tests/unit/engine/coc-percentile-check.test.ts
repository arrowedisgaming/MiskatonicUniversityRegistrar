import { describe, it, expect } from 'vitest';
import { evaluateCoC7ePercentileCheck } from '$lib/engine/coc-percentile-check';

describe('evaluateCoC7ePercentileCheck', () => {
	const skill50 = { target: 50, half: 25, fifth: 10 };

	it('critical on 01', () => {
		const r = evaluateCoC7ePercentileCheck({ rawRoll: 1, ...skill50 });
		expect(r.outcome).toBe('critical');
		expect(r.effectiveRoll).toBe(1);
		expect(r.isFumble).toBe(false);
	});

	it('tiers at boundaries for skill 50', () => {
		expect(evaluateCoC7ePercentileCheck({ rawRoll: 10, ...skill50 }).outcome).toBe('extreme');
		expect(evaluateCoC7ePercentileCheck({ rawRoll: 25, ...skill50 }).outcome).toBe('hard');
		expect(evaluateCoC7ePercentileCheck({ rawRoll: 50, ...skill50 }).outcome).toBe('regular');
		expect(evaluateCoC7ePercentileCheck({ rawRoll: 51, ...skill50 }).outcome).toBe('failure');
	});

	it('fumble on failed roll of 100', () => {
		const r = evaluateCoC7ePercentileCheck({ rawRoll: 100, ...skill50 });
		expect(r.outcome).toBe('failure');
		expect(r.isFumble).toBe(true);
	});

	it('fumble when skill < 50 and raw roll is 96–99 on failure', () => {
		const low = { target: 40, half: 20, fifth: 8 };
		const r96 = evaluateCoC7ePercentileCheck({ rawRoll: 96, ...low });
		expect(r96.outcome).toBe('failure');
		expect(r96.isFumble).toBe(true);
	});

	it('no fumble on 96 when skill is 50+', () => {
		const r = evaluateCoC7ePercentileCheck({ rawRoll: 96, ...skill50 });
		expect(r.outcome).toBe('failure');
		expect(r.isFumble).toBe(false);
	});

	it('rejects invalid rawRoll', () => {
		expect(() => evaluateCoC7ePercentileCheck({ rawRoll: 0, ...skill50 })).toThrow(RangeError);
		expect(() => evaluateCoC7ePercentileCheck({ rawRoll: 101, ...skill50 })).toThrow(RangeError);
		expect(() => evaluateCoC7ePercentileCheck({ rawRoll: 1.5, ...skill50 })).toThrow(RangeError);
	});

	it('roll of 100 is always failure + fumble even at high skill', () => {
		// Without explicit roll===100 handling, target>=100 would short-circuit to 'regular'
		// because the success ladder hits roll<=target before any 100-fails check.
		const skill100 = { target: 100, half: 50, fifth: 20 };
		const r = evaluateCoC7ePercentileCheck({ rawRoll: 100, ...skill100 });
		expect(r.outcome).toBe('failure');
		expect(r.isFumble).toBe(true);

		const skill120 = { target: 120, half: 60, fifth: 24 };
		const r2 = evaluateCoC7ePercentileCheck({ rawRoll: 100, ...skill120 });
		expect(r2.outcome).toBe('failure');
		expect(r2.isFumble).toBe(true);
	});

	it('full fumble band 96–99 fumbles only when skill < 50', () => {
		const skill49 = { target: 49, half: 24, fifth: 9 };
		for (const roll of [96, 97, 98, 99]) {
			const r = evaluateCoC7ePercentileCheck({ rawRoll: roll, ...skill49 });
			expect(r.outcome).toBe('failure');
			expect(r.isFumble).toBe(true);
		}
		// At skill exactly 50, 96-99 fail without fumbling.
		for (const roll of [96, 97, 98, 99]) {
			const r = evaluateCoC7ePercentileCheck({ rawRoll: roll, ...skill50 });
			expect(r.outcome).toBe('failure');
			expect(r.isFumble).toBe(false);
		}
	});

	it('roll of 1 is critical even when fifth equals 1 (skill 5)', () => {
		const skill5 = { target: 5, half: 2, fifth: 1 };
		const r = evaluateCoC7ePercentileCheck({ rawRoll: 1, ...skill5 });
		expect(r.outcome).toBe('critical');
		expect(r.isFumble).toBe(false);
	});

	it('exact-fifth roll is extreme (skill 25, roll 5)', () => {
		const skill25 = { target: 25, half: 12, fifth: 5 };
		const r = evaluateCoC7ePercentileCheck({ rawRoll: 5, ...skill25 });
		expect(r.outcome).toBe('extreme');
	});
});
