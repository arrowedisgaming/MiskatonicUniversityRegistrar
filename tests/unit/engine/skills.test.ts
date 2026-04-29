import { describe, it, expect } from 'vitest';
import {
	calculateOccupationSkillPoints,
	calculatePersonalInterestPoints,
	resolveSkillBaseValue,
	computeSkillValues,
	validateSkillAllocation,
	createSkillAllocation
} from '$lib/engine/skills';
import type { SkillPointFormula, CoCSkillDefinition } from '$lib/types/content-pack';
import type { CoCSkillAllocation } from '$lib/types/character';

describe('calculateOccupationSkillPoints', () => {
	it('calculates EDU×4 formula', () => {
		const formula: SkillPointFormula = { terms: [{ characteristic: 'edu', multiplier: 4 }] };
		const chars = { str: 50, con: 50, dex: 50, int: 50, pow: 50, app: 50, siz: 50, edu: 70 };
		expect(calculateOccupationSkillPoints(formula, chars)).toBe(280);
	});

	it('calculates EDU×2 + APP×2 formula', () => {
		const formula: SkillPointFormula = {
			terms: [
				{ characteristic: 'edu', multiplier: 2 },
				{ characteristic: 'app', multiplier: 2 }
			]
		};
		const chars = { str: 50, con: 50, dex: 50, int: 50, pow: 50, app: 60, siz: 50, edu: 70 };
		expect(calculateOccupationSkillPoints(formula, chars)).toBe(260); // 140 + 120
	});

	it('calculates EDU×2 + (STR or DEX)×2 with choice', () => {
		const formula: SkillPointFormula = {
			terms: [{ characteristic: 'edu', multiplier: 2 }],
			choiceTerms: [{ options: ['str', 'dex'], multiplier: 2 }]
		};
		const chars = { str: 70, con: 50, dex: 40, int: 50, pow: 50, app: 50, siz: 50, edu: 60 };

		// Choose STR
		expect(calculateOccupationSkillPoints(formula, chars, { '0': 'str' })).toBe(260); // 120 + 140

		// Choose DEX
		expect(calculateOccupationSkillPoints(formula, chars, { '0': 'dex' })).toBe(200); // 120 + 80

		// Default to first option (STR)
		expect(calculateOccupationSkillPoints(formula, chars)).toBe(260);
	});
});

describe('calculatePersonalInterestPoints', () => {
	it('returns INT × 2', () => {
		expect(calculatePersonalInterestPoints(70)).toBe(140);
		expect(calculatePersonalInterestPoints(40)).toBe(80);
		expect(calculatePersonalInterestPoints(90)).toBe(180);
	});
});

describe('resolveSkillBaseValue', () => {
	const chars = { str: 50, con: 50, dex: 60, int: 50, pow: 50, app: 50, siz: 50, edu: 75 };

	it('returns fixed base value for normal skills', () => {
		const skill: CoCSkillDefinition = {
			id: 'accounting', name: 'Accounting', baseValue: 5, category: 'academic',
			isSpecialization: false, eras: ['all']
		};
		expect(resolveSkillBaseValue(skill, chars)).toBe(5);
	});

	it('returns DEX/2 for Dodge', () => {
		const skill: CoCSkillDefinition = {
			id: 'dodge', name: 'Dodge', baseValue: 0, category: 'combat',
			isSpecialization: false, eras: ['all'], derivedBase: 'dex/2'
		};
		expect(resolveSkillBaseValue(skill, chars)).toBe(30); // 60 / 2
	});

	it('returns EDU for Own Language', () => {
		const skill: CoCSkillDefinition = {
			id: 'language-own', name: 'Language (Own)', baseValue: 0, category: 'academic',
			isSpecialization: false, eras: ['all'], derivedBase: 'edu'
		};
		expect(resolveSkillBaseValue(skill, chars)).toBe(75);
	});
});

describe('computeSkillValues', () => {
	it('computes total, half, and fifth from base + allocations', () => {
		const result = computeSkillValues(20, [
			{ points: 30, source: 'occupation', sourceLabel: 'Journalist' },
			{ points: 10, source: 'personal-interest', sourceLabel: 'Personal Interest' }
		]);
		expect(result.total).toBe(60);
		expect(result.half).toBe(30);
		expect(result.fifth).toBe(12);
	});

	it('handles zero allocations', () => {
		const result = computeSkillValues(25, []);
		expect(result.total).toBe(25);
		expect(result.half).toBe(12);
		expect(result.fifth).toBe(5);
	});
});

describe('createSkillAllocation', () => {
	it('creates a complete allocation record', () => {
		const alloc = createSkillAllocation(
			'firearms-handgun', 20,
			[{ points: 45, source: 'occupation', sourceLabel: 'Police Detective' }],
			true
		);
		expect(alloc.skillId).toBe('firearms-handgun');
		expect(alloc.total).toBe(65);
		expect(alloc.half).toBe(32);
		expect(alloc.fifth).toBe(13);
		expect(alloc.isOccupation).toBe(true);
		expect(alloc.customName).toBeNull();
	});
});

describe('validateSkillAllocation', () => {
	it('accepts valid allocation within budget', () => {
		const skills: CoCSkillAllocation[] = [
			createSkillAllocation('credit-rating', 0, [
				{ points: 40, source: 'occupation', sourceLabel: 'Test' }
			], true),
			createSkillAllocation('library-use', 20, [
				{ points: 30, source: 'occupation', sourceLabel: 'Test' }
			], true),
			createSkillAllocation('psychology', 10, [
				{ points: 20, source: 'personal-interest', sourceLabel: 'Personal' }
			], false)
		];

		const result = validateSkillAllocation(skills, 280, 140, { min: 30, max: 70 });
		expect(result.valid).toBe(true);
		expect(result.occupationPointsUsed).toBe(70);
		expect(result.personalPointsUsed).toBe(20);
	});

	it('rejects overspent occupation points', () => {
		const skills: CoCSkillAllocation[] = [
			createSkillAllocation('credit-rating', 0, [
				{ points: 300, source: 'occupation', sourceLabel: 'Test' }
			], true)
		];

		const result = validateSkillAllocation(skills, 280, 140, { min: 30, max: 70 });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('Occupation points'))).toBe(true);
	});

	it('rejects Credit Rating below occupation minimum', () => {
		const skills: CoCSkillAllocation[] = [
			createSkillAllocation('credit-rating', 0, [
				{ points: 10, source: 'occupation', sourceLabel: 'Test' }
			], true)
		];

		const result = validateSkillAllocation(skills, 280, 140, { min: 30, max: 70 });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('below occupation minimum'))).toBe(true);
	});

	it('rejects Credit Rating above occupation maximum', () => {
		const skills: CoCSkillAllocation[] = [
			createSkillAllocation('credit-rating', 0, [
				{ points: 80, source: 'occupation', sourceLabel: 'Test' }
			], true)
		];

		const result = validateSkillAllocation(skills, 280, 140, { min: 30, max: 70 });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('exceeds occupation maximum'))).toBe(true);
	});

	it('rejects skills exceeding 99', () => {
		const skills: CoCSkillAllocation[] = [
			createSkillAllocation('credit-rating', 0, [
				{ points: 50, source: 'occupation', sourceLabel: 'Test' }
			], true),
			createSkillAllocation('spot-hidden', 25, [
				{ points: 80, source: 'occupation', sourceLabel: 'Test' }
			], true)
		];

		const result = validateSkillAllocation(skills, 280, 140, { min: 30, max: 70 });
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('exceeds maximum of 99'))).toBe(true);
	});

	it('rejects occupation points on ineligible skills', () => {
		const skills: CoCSkillAllocation[] = [
			createSkillAllocation('credit-rating', 0, [
				{ points: 40, source: 'occupation', sourceLabel: 'Test' }
			], true),
			createSkillAllocation('pilot-aircraft', 1, [
				{ points: 30, source: 'occupation', sourceLabel: 'Test' }
			], false)
		];

		const result = validateSkillAllocation(
			skills,
			280,
			140,
			{ min: 30, max: 70 },
			new Set(['credit-rating', 'library-use'])
		);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('not eligible'))).toBe(true);
	});
});
