/**
 * Finances calculation from Credit Rating.
 * Pure functions — no side effects.
 */

import type { WealthEntry } from '$lib/types/content-pack';

export interface WealthResult {
	spendingLevel: string;
	cash: number;
	assets: number;
}

/**
 * Calculate starting wealth from Credit Rating using the wealth table.
 * Cash and assets are multiplied by Credit Rating value.
 */
export function calculateStartingWealth(
	creditRating: number,
	wealthTable: WealthEntry[]
): WealthResult {
	const entry = wealthTable.find(
		(w) => creditRating >= w.minCR && creditRating <= w.maxCR
	);

	if (!entry) {
		return { spendingLevel: 'Unknown', cash: 0, assets: 0 };
	}

	return {
		spendingLevel: entry.spendingLevel,
		cash: Math.round(entry.cash * creditRating),
		assets: Math.round(entry.assetsMultiplier * creditRating)
	};
}
