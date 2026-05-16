import { fifthValue } from './characteristics';
import type { Rng } from './dice';
import { cryptoRng, rollDie } from './dice';
import type { PlayRollHistoryEntry } from '$lib/types/character';

export type DiceExpr = { kind: 'flat'; value: number } | { kind: 'dice'; count: number; sides: number };
export type ParsedSanLossFormula = { success: DiceExpr; failure: DiceExpr };

const SUPPORTED_SAN_DICE = new Set([3, 4, 6, 8, 10, 12, 20, 100]);
// Matches the upper bound on `applied` / `successAmount` / `failureAmount` in
// `playRollHistorySanLoss` (see `src/lib/schemas/character.schema.ts`).
// Accepting flat values above this would write an entry the server rejects,
// stranding the character in unsavable state.
export const SAN_LOSS_FLAT_MAX = 100;

function parseDiceExpr(input: string): DiceExpr | null {
	const trimmed = input.trim().toLowerCase();
	const flat = /^(\d+)$/.exec(trimmed);
	if (flat) {
		const value = Number(flat[1]);
		if (value < 0 || value > SAN_LOSS_FLAT_MAX) return null;
		return { kind: 'flat', value };
	}

	const dice = /^(\d*)d(\d+)$/.exec(trimmed);
	if (!dice) return null;
	const count = dice[1] ? Number(dice[1]) : 1;
	const sides = Number(dice[2]);
	if (
		!Number.isInteger(count) ||
		!Number.isInteger(sides) ||
		count < 1 ||
		count > 20 ||
		!SUPPORTED_SAN_DICE.has(sides)
	) {
		return null;
	}
	// Reject formulas whose maximum roll exceeds the schema bound for
	// `applied` / `successAmount` / `failureAmount` (see SAN_LOSS_FLAT_MAX).
	// Otherwise an unlucky 2D100 or 20D6 would apply locally, then the server
	// rejects the save — same stranded-state bug as flat values >100.
	if (count * sides > SAN_LOSS_FLAT_MAX) return null;
	return { kind: 'dice', count, sides };
}

export function parseSanLossFormula(input: string): ParsedSanLossFormula {
	const parts = input.split('/');
	if (parts.length !== 2) {
		throw new Error('Use SAN loss as success/failure, such as 0/1D6.');
	}
	const success = parseDiceExpr(parts[0]);
	const failure = parseDiceExpr(parts[1]);
	if (!success || !failure) {
		throw new Error('SAN loss supports whole numbers or dice like 1D6.');
	}
	return { success, failure };
}

export function rollDiceExpr(expr: DiceExpr, rng: Rng = cryptoRng): { amount: number; rolls: number[] } {
	if (expr.kind === 'flat') return { amount: expr.value, rolls: [] };
	const rolls = Array.from({ length: expr.count }, () => rollDie(expr.sides, rng));
	return { amount: rolls.reduce((sum, n) => sum + n, 0), rolls };
}

export function rollSanLoss(
	formula: ParsedSanLossFormula,
	outcomeKind: 'success' | 'failure',
	rng: Rng = cryptoRng
): { amount: number; rolls: number[] } {
	return rollDiceExpr(formula[outcomeKind], rng);
}

export function resetSanDay(currentSanity: number, now: Date = new Date()): {
	dailySanStart: number;
	dailySanResetAt: string;
} {
	return {
		dailySanStart: Math.max(0, Math.trunc(currentSanity)),
		dailySanResetAt: now.toISOString()
	};
}

export function dailySanThreshold(dailySanStart: number | null | undefined): number {
	return fifthValue(Math.max(0, Math.trunc(dailySanStart ?? 0)));
}

export function dailyLossSoFar(
	playRollHistory: PlayRollHistoryEntry[],
	dailySanResetAt: string | null | undefined
): number {
	if (!dailySanResetAt) return 0;
	const reset = Date.parse(dailySanResetAt);
	if (!Number.isFinite(reset)) return 0;

	// Sum only positive losses since the daily reset. Negative `applied` values
	// represent SAN rewards (e.g., crossing 90% in a skill via development) and
	// affect `currentSanity` but must NOT cancel cumulative daily loss for the
	// one-fifth indefinite-insanity check — a player who lost 6 and gained 2
	// has still lost 6 toward today's threshold, not 4.
	return playRollHistory.reduce((sum, entry) => {
		if (entry.targetKind !== 'sanLoss') return sum;
		if (entry.applied <= 0) return sum;
		const at = Date.parse(entry.at);
		if (!Number.isFinite(at) || at < reset) return sum;
		return sum + entry.applied;
	}, 0);
}

export function applySanLoss(
	state: {
		currentSanity: number;
		maxSanity: number;
		dailySanStart: number | null;
		dailyLossSoFar: number;
	},
	amount: number
): { sanAfter: number; triggeredTemporary: boolean; triggeredIndefinite: boolean } {
	const applied = Math.max(0, Math.trunc(amount));
	const sanAfter = Math.max(0, Math.min(state.maxSanity, state.currentSanity - applied));
	const threshold = dailySanThreshold(state.dailySanStart);
	return {
		sanAfter,
		triggeredTemporary: applied >= 5,
		triggeredIndefinite:
			state.dailySanStart !== null && threshold > 0 && state.dailyLossSoFar + applied >= threshold
	};
}
