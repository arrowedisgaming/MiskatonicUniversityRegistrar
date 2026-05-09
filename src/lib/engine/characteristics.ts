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

// ────────────────────────────────────────────────────────────────────────────
// Wizard-method helpers (Point Buy & Quick Fire)
// ────────────────────────────────────────────────────────────────────────────

/** Total points to distribute in the Point Buy method. */
export const POINT_BUY_TOTAL = 460;
export const POINT_BUY_MIN = 15;
export const POINT_BUY_MAX = 90;
export const POINT_BUY_RECOMMENDED_MIN_INT_SIZ = 40;

/** Fixed value pool for the Quick Fire method (each value used exactly once). */
export const QUICK_FIRE_VALUES: readonly number[] = [40, 50, 50, 50, 60, 60, 70, 80] as const;

export interface PointBuyStatus {
	total: number;
	remaining: number;
	allInRange: boolean;
	totalCorrect: boolean;
	valid: boolean;
}

export function pointBuyStatus(values: Record<CharacteristicId, number>): PointBuyStatus {
	const list = Object.values(values);
	const total = list.reduce((sum, v) => sum + v, 0);
	const allInRange = list.every((v) => v >= POINT_BUY_MIN && v <= POINT_BUY_MAX);
	const totalCorrect = total === POINT_BUY_TOTAL;
	return {
		total,
		remaining: POINT_BUY_TOTAL - total,
		allInRange,
		totalCorrect,
		valid: allInRange && totalCorrect
	};
}

/** Build a count-map from the canonical Quick Fire pool. */
function quickFireCountTemplate(): Map<number, number> {
	const counts = new Map<number, number>();
	for (const v of QUICK_FIRE_VALUES) {
		counts.set(v, (counts.get(v) ?? 0) + 1);
	}
	return counts;
}

/**
 * True when the eight assigned values match the Quick Fire pool by count
 * (i.e. each pool value used exactly once across the eight characteristics).
 */
export function isQuickFireAssignment(values: Record<CharacteristicId, number>): boolean {
	const target = quickFireCountTemplate();
	const seen = new Map<number, number>();
	for (const v of Object.values(values)) {
		seen.set(v, (seen.get(v) ?? 0) + 1);
	}
	if (seen.size !== target.size) return false;
	for (const [value, count] of target) {
		if (seen.get(value) !== count) return false;
	}
	return true;
}

/**
 * Available counts for each pool value given the current assignments — i.e.
 * how many of each value are still unused. A select widget can use this to
 * decide which pool values to disable for a given stat (the stat's own
 * current value is always selectable).
 */
export function quickFireAvailableCounts(
	values: Record<CharacteristicId, number>
): Map<number, number> {
	const remaining = quickFireCountTemplate();
	for (const v of Object.values(values)) {
		if (remaining.has(v)) {
			remaining.set(v, (remaining.get(v) ?? 0) - 1);
		}
	}
	return remaining;
}

/**
 * Generation-token guard: returns true when `token` still matches `current`,
 * i.e. no invalidation has happened since the token was snapshotted. Used by
 * the wizard's reconcileAutomaticRolls() to abort an in-flight async
 * sequence (Luck / EDU rolls) when the player edits the allocation, switches
 * methods, or changes age while dice are animating.
 *
 * Pure so the re-entrancy guard can be reasoned about and tested in
 * isolation from the Svelte component lifecycle.
 */
export function isReconcileTokenFresh(token: number | undefined, current: number): boolean {
	return token === undefined || token === current;
}

/**
 * Apply a Quick Fire pick at `target` to value `nextValue`, swapping the
 * previous holder of `nextValue` (if any) into `target`'s old value so the
 * pool counts stay satisfied. If `target` is its own previous holder, no swap.
 */
export function quickFireSwapAssignment(
	values: Record<CharacteristicId, number>,
	target: CharacteristicId,
	nextValue: number
): Record<CharacteristicId, number> {
	const previousValue = values[target];
	if (previousValue === nextValue) return values;

	// If `nextValue` is already used elsewhere AND its remaining count is zero,
	// find a stat (other than target) currently holding it and swap.
	const counts = quickFireAvailableCounts(values);
	const exhausted = (counts.get(nextValue) ?? 0) <= 0;
	const updated = { ...values, [target]: nextValue };

	if (exhausted) {
		const swapKey = (Object.keys(values) as CharacteristicId[]).find(
			(k) => k !== target && values[k] === nextValue
		);
		if (swapKey) {
			updated[swapKey] = previousValue;
		}
	}
	return updated;
}
