/**
 * Derived stat calculations — HP, MP, Sanity, Luck, Damage Bonus, Build, Move Rate.
 * All formulas per the CoC 7e Investigator Handbook.
 * Pure functions — no side effects.
 */

import type { CharacteristicId } from '$lib/types/common';
import type { DamageBonusBuildEntry, AgeModifierEntry } from '$lib/types/content-pack';

/** Hit Points = (CON + SIZ) / 10, rounded down */
export function calculateHP(con: number, siz: number): number {
	return Math.floor((con + siz) / 10);
}

/** Magic Points = POW / 5, rounded down */
export function calculateMP(pow: number): number {
	return Math.floor(pow / 5);
}

/** Starting Sanity = POW */
export function calculateStartingSanity(pow: number): number {
	return pow;
}

/** Max Sanity = 99 - Cthulhu Mythos skill */
export function calculateMaxSanity(cthulhuMythos: number): number {
	return 99 - cthulhuMythos;
}

/**
 * Damage Bonus and Build from STR + SIZ.
 * Uses the lookup table from the content pack.
 */
export function calculateDamageBonusAndBuild(
	str: number,
	siz: number,
	table: DamageBonusBuildEntry[]
): { damageBonus: string; build: number } {
	const sum = str + siz;

	for (const entry of table) {
		if (sum >= entry.minSum && sum <= entry.maxSum) {
			return { damageBonus: entry.damageBonus, build: entry.build };
		}
	}

	// Fallback for values beyond the table
	const lastEntry = table[table.length - 1];
	return { damageBonus: lastEntry.damageBonus, build: lastEntry.build };
}

/**
 * Move Rate calculation.
 * - If both DEX and STR > SIZ: MOV = 9
 * - If either STR or DEX >= SIZ: MOV = 8
 * - If both STR and DEX < SIZ: MOV = 7
 * Then subtract age-based penalty.
 */
export function calculateMoveRate(
	str: number,
	dex: number,
	siz: number,
	ageModifier: AgeModifierEntry | null
): number {
	let mov: number;

	if (dex > siz && str > siz) {
		mov = 9;
	} else if (str >= siz || dex >= siz) {
		mov = 8;
	} else {
		mov = 7;
	}

	if (ageModifier) {
		mov -= ageModifier.moveRateDeduction;
	}

	return Math.max(mov, 1); // minimum 1
}

/**
 * Find the applicable age modifier entry for a given age.
 */
export function getAgeModifier(age: number, ageModifiers: AgeModifierEntry[]): AgeModifierEntry | null {
	return ageModifiers.find((m) => age >= m.minAge && age <= m.maxAge) ?? null;
}

/**
 * Calculate all derived stats at once.
 */
export function calculateAllDerived(
	characteristics: Record<CharacteristicId, number>,
	age: number,
	cthulhuMythos: number,
	damageBonusBuildTable: DamageBonusBuildEntry[],
	ageModifiers: AgeModifierEntry[]
): {
	hp: number;
	mp: number;
	startingSanity: number;
	maxSanity: number;
	damageBonus: string;
	build: number;
	moveRate: number;
} {
	const { con, siz, pow, str, dex } = characteristics;
	const ageModifier = getAgeModifier(age, ageModifiers);
	const { damageBonus, build } = calculateDamageBonusAndBuild(str, siz, damageBonusBuildTable);

	return {
		hp: calculateHP(con, siz),
		mp: calculateMP(pow),
		startingSanity: calculateStartingSanity(pow),
		maxSanity: calculateMaxSanity(cthulhuMythos),
		damageBonus,
		build,
		moveRate: calculateMoveRate(str, dex, siz, ageModifier)
	};
}
