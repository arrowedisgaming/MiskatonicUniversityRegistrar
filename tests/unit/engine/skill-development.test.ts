import { describe, expect, it } from 'vitest';
import {
	crossed90ViaDevelopment,
	isMarkEligible,
	rollDevelopmentImprovement
} from '$lib/engine/skill-development';
import type { PlayRollHistoryPercentileEntry } from '$lib/types/character';

function entry(patch: Partial<PlayRollHistoryPercentileEntry> = {}): PlayRollHistoryPercentileEntry {
	return {
		id: 'roll-1',
		at: '2026-05-15T00:00:00.000Z',
		targetKind: 'skill',
		skillId: 'spot-hidden',
		skillDisplayLabel: 'Spot Hidden',
		target: 50,
		half: 25,
		fifth: 10,
		rawRoll: 40,
		effectiveRoll: 40,
		outcome: 'regular',
		isFumble: false,
		...patch
	};
}

describe('skill development', () => {
	it('marks successful eligible rolls without bonus dice', () => {
		expect(isMarkEligible('spot-hidden', null, entry())).toBe(true);
		expect(isMarkEligible('spot-hidden', null, entry({ bonusDieCount: 1 }))).toBe(false);
		expect(isMarkEligible('spot-hidden', null, entry({ outcome: 'failure' }))).toBe(false);
	});

	it('excludes Credit Rating, Cthulhu Mythos, and lost opposed rolls', () => {
		expect(isMarkEligible('credit-rating', null, entry())).toBe(false);
		expect(isMarkEligible('cthulhu-mythos', null, entry())).toBe(false);
		expect(isMarkEligible('spot-hidden', null, entry(), { wonOpposed: false })).toBe(false);
	});

	it('rolls improvement only when eligibility passes', () => {
		const rolls = [61, 4];
		expect(rollDevelopmentImprovement(60, () => rolls.shift()!)).toEqual({
			eligibilityRoll: 61,
			eligibilityPassed: true,
			improvementRoll: 4,
			improvement: 4,
			afterTotal: 64
		});
	});

	it('supports the over-95 improvement rule for skills above 100', () => {
		const rolls = [96, 7];
		const result = rollDevelopmentImprovement(120, () => rolls.shift()!);
		expect(result).toEqual({
			eligibilityRoll: 96,
			eligibilityPassed: true,
			improvementRoll: 7,
			improvement: 7,
			afterTotal: 127
		});
	});

	it('detects crossing 90 by development once', () => {
		expect(crossed90ViaDevelopment(89, 90)).toBe(true);
		expect(crossed90ViaDevelopment(90, 91)).toBe(false);
		expect(crossed90ViaDevelopment(80, 89)).toBe(false);
	});
});
