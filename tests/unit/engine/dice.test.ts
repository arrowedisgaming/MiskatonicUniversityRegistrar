import { describe, it, expect } from 'vitest';
import { rollDie, rollDice, rollSum, roll3d6x5, roll2d6plus6x5, rollLuck } from '$lib/engine/dice';

describe('rollDie', () => {
	it('returns a value between 1 and sides (inclusive)', () => {
		for (let i = 0; i < 100; i++) {
			const result = rollDie(6);
			expect(result).toBeGreaterThanOrEqual(1);
			expect(result).toBeLessThanOrEqual(6);
		}
	});

	it('returns 1 for a d1', () => {
		expect(rollDie(1)).toBe(1);
	});
});

describe('rollDice', () => {
	it('returns the correct number of dice', () => {
		expect(rollDice(3, 6)).toHaveLength(3);
		expect(rollDice(5, 10)).toHaveLength(5);
	});

	it('each die is in range', () => {
		const results = rollDice(10, 20);
		for (const r of results) {
			expect(r).toBeGreaterThanOrEqual(1);
			expect(r).toBeLessThanOrEqual(20);
		}
	});
});

describe('rollSum', () => {
	it('returns correct total for rolled dice', () => {
		const { rolls, total } = rollSum(3, 6);
		expect(rolls).toHaveLength(3);
		expect(total).toBe(rolls.reduce((a, b) => a + b, 0));
	});
});

describe('roll3d6x5', () => {
	it('returns a value in the range 15-90', () => {
		for (let i = 0; i < 100; i++) {
			const { total } = roll3d6x5();
			expect(total).toBeGreaterThanOrEqual(15);
			expect(total).toBeLessThanOrEqual(90);
			expect(total % 5).toBe(0);
		}
	});

	it('returns exactly 3 individual die results', () => {
		const { rolls } = roll3d6x5();
		expect(rolls).toHaveLength(3);
	});
});

describe('roll2d6plus6x5', () => {
	it('returns a value in the range 40-90', () => {
		for (let i = 0; i < 100; i++) {
			const { total } = roll2d6plus6x5();
			expect(total).toBeGreaterThanOrEqual(40);
			expect(total).toBeLessThanOrEqual(90);
			expect(total % 5).toBe(0);
		}
	});

	it('returns exactly 2 individual die results', () => {
		const { rolls } = roll2d6plus6x5();
		expect(rolls).toHaveLength(2);
	});
});

describe('rollLuck', () => {
	it('returns a value in the range 15-90', () => {
		for (let i = 0; i < 100; i++) {
			const { total } = rollLuck();
			expect(total).toBeGreaterThanOrEqual(15);
			expect(total).toBeLessThanOrEqual(90);
		}
	});
});
