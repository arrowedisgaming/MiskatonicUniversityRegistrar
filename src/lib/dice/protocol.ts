export const DICE_SIDES = [3, 4, 6, 8, 10, 12, 20, 100] as const;

export type DiceSides = (typeof DICE_SIDES)[number];
export type DiceScheme = 'classic' | 'modern';

export interface DiceGroup {
	count: number;
	sides: DiceSides;
	results: number[];
}

export interface DiceRollRequest {
	groups: DiceGroup[];
	label?: string;
	scheme?: DiceScheme;
	reveal?: 'after-settle';
}

export interface RendererNotation {
	notation: string;
	results: number[];
}

const SUPPORTED_SIDES = new Set<number>(DICE_SIDES);

export function validateDiceGroup(group: DiceGroup): DiceGroup {
	if (!Number.isInteger(group.count) || group.count < 0) {
		throw new RangeError('Dice group count must be a non-negative integer.');
	}

	if (!SUPPORTED_SIDES.has(group.sides)) {
		throw new RangeError(`Unsupported die type: d${group.sides}.`);
	}

	if (group.results.length !== group.count) {
		throw new RangeError(`Expected ${group.count} d${group.sides} result${group.count === 1 ? '' : 's'}.`);
	}

	for (const result of group.results) {
		if (!Number.isInteger(result) || result < 1 || result > group.sides) {
			throw new RangeError(`Invalid d${group.sides} result: ${result}.`);
		}
	}

	return group;
}

export function validateDiceRollRequest(request: DiceRollRequest): DiceRollRequest {
	for (const group of request.groups) {
		validateDiceGroup(group);
	}

	return request;
}

export function hasDiceToShow(request: DiceRollRequest): boolean {
	return request.groups.some((group) => group.count > 0);
}

/**
 * User-facing results in roll order. d100s stay as 1..100 instead of being
 * expanded into the renderer's tens/ones pair.
 */
export function userFacingResults(request: DiceRollRequest): number[] {
	return request.groups.flatMap((group) => group.results);
}

export function makeDiceRollRequest(
	groups: DiceGroup[],
	options: Omit<DiceRollRequest, 'groups'> = {}
): DiceRollRequest {
	return validateDiceRollRequest({ ...options, groups });
}

export function toRendererNotation(request: DiceRollRequest): RendererNotation {
	validateDiceRollRequest(request);

	const notationParts: string[] = [];
	const results: number[] = [];

	for (const group of request.groups) {
		if (group.count === 0) continue;

		if (group.sides === 100) {
			notationParts.push(`${group.count}d100`, `${group.count}d10`);
			for (const result of group.results) {
				results.push(toPercentileTensDie(result));
			}
			for (const result of group.results) {
				results.push(toPercentileOnesDie(result));
			}
			continue;
		}

		notationParts.push(`${group.count}d${group.sides}`);
		results.push(...group.results);
	}

	if (notationParts.length === 0) {
		return { notation: '0', results: [] };
	}

	return {
		notation: `${notationParts.join('+')}@${results.join(',')}`,
		results
	};
}

function toPercentileTensDie(result: number): number {
	if (result === 100) return 100;
	const tens = Math.floor(result / 10) * 10;
	return tens === 0 ? 100 : tens;
}

function toPercentileOnesDie(result: number): number {
	const ones = result % 10;
	return ones === 0 ? 10 : ones;
}
