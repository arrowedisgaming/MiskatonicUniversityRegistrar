/**
 * Pure dice math — no animation, no side effects.
 * Uses crypto.getRandomValues for better randomness.
 */

/** Roll a single die with the given number of sides (rejection sampling to avoid modulo bias) */
export function rollDie(sides: number): number {
	if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
		const max = Math.floor(0x100000000 / sides) * sides; // largest multiple of sides that fits in u32
		const array = new Uint32Array(1);
		let value: number;
		do {
			globalThis.crypto.getRandomValues(array);
			value = array[0];
		} while (value >= max); // reject values that would cause bias
		return (value % sides) + 1;
	}
	return Math.floor(Math.random() * sides) + 1;
}

/** Roll multiple dice and return individual results */
export function rollDice(count: number, sides: number): number[] {
	return Array.from({ length: count }, () => rollDie(sides));
}

/** Roll NdS and return the sum */
export function rollSum(count: number, sides: number): { rolls: number[]; total: number } {
	const rolls = rollDice(count, sides);
	return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

/** Roll 3d6 × 5 (for STR, CON, DEX, APP, POW) */
export function roll3d6x5(): { rolls: number[]; total: number } {
	const { rolls, total } = rollSum(3, 6);
	return { rolls, total: total * 5 };
}

/** Roll (2d6+6) × 5 (for SIZ, INT, EDU) */
export function roll2d6plus6x5(): { rolls: number[]; total: number } {
	const { rolls, total } = rollSum(2, 6);
	return { rolls, total: (total + 6) * 5 };
}

/** Roll Luck: 3d6 × 5 */
export function rollLuck(): { rolls: number[]; total: number } {
	return roll3d6x5();
}
