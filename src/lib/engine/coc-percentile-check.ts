/**
 * Call of Cthulhu 7th Edition — standard percentile (d100) checks (roll under full/half/fifth).
 * Pure functions; no RNG here.
 */

export type CoCPercentileOutcome = 'critical' | 'extreme' | 'hard' | 'regular' | 'failure';

export interface CoCPercentileCheckResult {
	/** Same as the d100 result; kept for a stable result shape for callers and logs. */
	effectiveRoll: number;
	outcome: CoCPercentileOutcome;
	/** True only when the outcome is failure and RAW fumble conditions apply. */
	isFumble: boolean;
}

/**
 * @param target — Full skill or characteristic rating (regular success threshold).
 * @param half / fifth — Must match CoC rules (floor(skill/2), floor(skill/5)); caller supplies for consistency with sheet.
 */
export function evaluateCoC7ePercentileCheck(params: {
	rawRoll: number;
	target: number;
	half: number;
	fifth: number;
}): CoCPercentileCheckResult {
	const { rawRoll, target, half, fifth } = params;

	if (!Number.isInteger(rawRoll) || rawRoll < 1 || rawRoll > 100) {
		throw new RangeError(`rawRoll must be an integer from 1 to 100, got ${rawRoll}`);
	}

	const outcome = outcomeFromRoll(rawRoll, target, half, fifth);
	const isFumble = outcome === 'failure' && fumbleOnFailedRoll(rawRoll, target);

	return { effectiveRoll: rawRoll, outcome, isFumble };
}

function outcomeFromRoll(
	roll: number,
	target: number,
	half: number,
	fifth: number
): CoCPercentileOutcome {
	if (roll === 1) return 'critical';
	// Keeper Rulebook: 100 is always a failure (and always a fumble — see fumbleOnFailedRoll).
	// Without this, target >= 100 (Pulp / boosted skills) would short-circuit to 'regular'.
	if (roll === 100) return 'failure';
	if (roll <= fifth) return 'extreme';
	if (roll <= half) return 'hard';
	if (roll <= target) return 'regular';
	return 'failure';
}

/** Keeper Rulebook: on a failed roll, fumble if roll is 100, or skill < 50% and roll ≥ 96. */
function fumbleOnFailedRoll(rawRoll: number, target: number): boolean {
	if (rawRoll === 100) return true;
	if (target < 50 && rawRoll >= 96) return true;
	return false;
}
