import type { Rng } from './dice';
import { cryptoRng, rollDie } from './dice';
import type { PlayRollHistoryPercentileEntry } from '$lib/types/character';

const DEVELOPMENT_EXCLUDED_SKILL_IDS = new Set(['credit-rating', 'cthulhu-mythos']);
const SUCCESS_OUTCOMES = new Set(['critical', 'extreme', 'hard', 'regular']);

export function skillDevelopmentKey(skillId: string, customName: string | null | undefined): string {
	return `${skillId}::${(customName ?? '').trim().toLowerCase()}`;
}

export function isSkillDevelopmentExcluded(skillId: string): boolean {
	return DEVELOPMENT_EXCLUDED_SKILL_IDS.has(skillId);
}

export function isMarkEligible(
	skillId: string,
	_customName: string | null | undefined,
	percentileEntry: PlayRollHistoryPercentileEntry,
	options: { wonOpposed?: boolean } = {}
): boolean {
	if (isSkillDevelopmentExcluded(skillId)) return false;
	if (percentileEntry.targetKind !== 'skill') return false;
	if (!SUCCESS_OUTCOMES.has(percentileEntry.outcome)) return false;
	if ((percentileEntry.bonusDieCount ?? 0) > 0) return false;
	if (options.wonOpposed === false) return false;
	return true;
}

export function rollDevelopmentImprovement(
	currentTotal: number,
	rng: Rng = cryptoRng
): {
	eligibilityRoll: number;
	eligibilityPassed: boolean;
	improvementRoll: number | null;
	improvement: number;
	afterTotal: number;
} {
	const eligibilityRoll = rollDie(100, rng);
	const eligibilityPassed = eligibilityRoll > currentTotal || eligibilityRoll > 95;
	if (!eligibilityPassed) {
		return {
			eligibilityRoll,
			eligibilityPassed,
			improvementRoll: null,
			improvement: 0,
			afterTotal: currentTotal
		};
	}

	const improvementRoll = rollDie(10, rng);
	return {
		eligibilityRoll,
		eligibilityPassed,
		improvementRoll,
		improvement: improvementRoll,
		afterTotal: currentTotal + improvementRoll
	};
}

export function crossed90ViaDevelopment(beforeTotal: number, afterTotal: number): boolean {
	return beforeTotal < 90 && afterTotal >= 90;
}
