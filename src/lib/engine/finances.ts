/**
 * Finances calculation from Credit Rating.
 * Pure functions — no side effects.
 */

import type { WealthEntry } from '$lib/types/content-pack';

export interface WealthResult {
	livingStandard: string;
	spendingLevel: number;
	cash: number;
	assets: number;
	assetsLabel: string;
}

/**
 * Calculate starting wealth from Credit Rating using the era's wealth table.
 */
export function calculateStartingWealth(
	creditRating: number,
	wealthTable: WealthEntry[],
	currencySymbol: string = '$'
): WealthResult {
	const entry = wealthTable.find(
		(w) => creditRating >= w.minCR && creditRating <= w.maxCR
	);

	if (!entry) {
		return { livingStandard: 'Unknown', spendingLevel: 0, cash: 0, assets: 0, assetsLabel: `${currencySymbol}0` };
	}

	const legacyCashMultiplier = entry.cash ?? 0;
	const cash = entry.cashFixed ?? Math.round((entry.cashMultiplier ?? legacyCashMultiplier) * creditRating);
	const assets = entry.assetsFixed ?? Math.round((entry.assetsMultiplier ?? 0) * creditRating);

	return {
		livingStandard: entry.livingStandard ?? entry.spendingLevelLabel ?? 'Unknown',
		spendingLevel: entry.spendingLevel,
		cash,
		assets,
		assetsLabel: entry.assetsLabel ?? `${currencySymbol}${assets.toLocaleString()}`
	};
}
