/**
 * Pure dice math — no animation, no side effects.
 *
 * RNG is injectable so tests can drive deterministic outcomes. The default RNG
 * uses crypto.getRandomValues with rejection sampling to avoid modulo bias,
 * falling back to Math.random in environments that lack crypto.
 */

/** Returns a uniformly random integer in [1, sides]. */
export type Rng = (sides: number) => number;

export const cryptoRng: Rng = (sides: number) => {
	if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
		const max = Math.floor(0x100000000 / sides) * sides;
		const array = new Uint32Array(1);
		let value: number;
		do {
			globalThis.crypto.getRandomValues(array);
			value = array[0];
		} while (value >= max);
		return (value % sides) + 1;
	}
	return Math.floor(Math.random() * sides) + 1;
};

/** Build a deterministic RNG from a fixed result sequence — for tests only. */
export function sequenceRng(values: number[]): Rng {
	let i = 0;
	return () => {
		if (i >= values.length) {
			throw new Error(`sequenceRng exhausted after ${values.length} draws`);
		}
		return values[i++];
	};
}

/** Roll a single die with the given number of sides */
export function rollDie(sides: number, rng: Rng = cryptoRng): number {
	return rng(sides);
}

/** Roll multiple dice and return individual results */
export function rollDice(count: number, sides: number, rng: Rng = cryptoRng): number[] {
	return Array.from({ length: count }, () => rng(sides));
}

/** Roll NdS and return the sum */
export function rollSum(
	count: number,
	sides: number,
	rng: Rng = cryptoRng
): { rolls: number[]; total: number } {
	const rolls = rollDice(count, sides, rng);
	return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

/** Roll 3d6 × 5 (for STR, CON, DEX, APP, POW) */
export function roll3d6x5(rng: Rng = cryptoRng): { rolls: number[]; total: number } {
	const { rolls, total } = rollSum(3, 6, rng);
	return { rolls, total: total * 5 };
}

/** Roll (2d6+6) × 5 (for SIZ, INT, EDU) */
export function roll2d6plus6x5(rng: Rng = cryptoRng): { rolls: number[]; total: number } {
	const { rolls, total } = rollSum(2, 6, rng);
	return { rolls, total: (total + 6) * 5 };
}

/** Roll Luck: 3d6 × 5 */
export function rollLuck(rng: Rng = cryptoRng): { rolls: number[]; total: number } {
	return roll3d6x5(rng);
}
