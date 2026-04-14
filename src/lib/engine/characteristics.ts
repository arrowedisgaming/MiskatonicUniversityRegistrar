/**
 * Characteristic generation and manipulation.
 * Pure functions — no side effects.
 */

import type { CharacteristicId } from '$lib/types/common';
import { ROLL_3D6, ROLL_2D6_PLUS_6 } from '$lib/types/common';
import { roll3d6x5, roll2d6plus6x5 } from './dice';

export interface CharacteristicRollResult {
	characteristic: CharacteristicId;
	rolls: number[];
	total: number;
}

/** Roll all eight characteristics using the standard CoC 7e method */
export function rollAllCharacteristics(): CharacteristicRollResult[] {
	const results: CharacteristicRollResult[] = [];

	for (const char of ROLL_3D6) {
		const { rolls, total } = roll3d6x5();
		results.push({ characteristic: char, rolls, total });
	}

	for (const char of ROLL_2D6_PLUS_6) {
		const { rolls, total } = roll2d6plus6x5();
		results.push({ characteristic: char, rolls, total });
	}

	return results;
}

/** Convert roll results to a values record */
export function rollResultsToValues(
	results: CharacteristicRollResult[]
): Record<CharacteristicId, number> {
	const values = {} as Record<CharacteristicId, number>;
	for (const r of results) {
		values[r.characteristic] = r.total;
	}
	return values;
}

/** Convert roll results to a rolls record */
export function rollResultsToRolls(
	results: CharacteristicRollResult[]
): Record<CharacteristicId, number[]> {
	const rolls = {} as Record<CharacteristicId, number[]>;
	for (const r of results) {
		rolls[r.characteristic] = r.rolls;
	}
	return rolls;
}

/** Half value (round down) — core CoC 7e mechanic */
export function halfValue(score: number): number {
	return Math.floor(score / 2);
}

/** Fifth value (round down) — core CoC 7e mechanic */
export function fifthValue(score: number): number {
	return Math.floor(score / 5);
}

/**
 * Validate that a set of characteristic values is within legal range.
 * 3d6×5 characteristics: 15-90
 * (2d6+6)×5 characteristics: 40-90
 */
export function validateCharacteristics(
	values: Record<CharacteristicId, number>
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	for (const char of ROLL_3D6) {
		const v = values[char];
		if (v < 15 || v > 90) {
			errors.push(`${char.toUpperCase()} must be between 15 and 90 (got ${v})`);
		}
	}

	for (const char of ROLL_2D6_PLUS_6) {
		const v = values[char];
		if (v < 40 || v > 90) {
			errors.push(`${char.toUpperCase()} must be between 40 and 90 (got ${v})`);
		}
	}

	return { valid: errors.length === 0, errors };
}
