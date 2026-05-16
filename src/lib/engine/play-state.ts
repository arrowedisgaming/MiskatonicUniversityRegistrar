/**
 * Splices live Play Mode state on top of a base character to produce the
 * authoritative in-memory character shape.
 *
 * Why this exists: the sheet route holds two parallel snapshots —
 *
 *   - `char` — what the page loader returned. Stable across the session;
 *     never reflects post-load updates.
 *   - "live overlay" — a bundle of `$state` cells the user mutates via Play
 *     Mode (current HP/MP/SAN/Luck, developed skills, marks, milestones,
 *     SAN tracking, play history).
 *
 * Without a single merge function, every consumer (SheetReadOnly props, PDF
 * export, edit-mode clone source, persistence payload) had to remember to
 * splice the overlay onto `char`. Missing one of those splices is the bug
 * Codex flagged as "Editing after Play Mode overwrites live play state" —
 * `startEdit` was cloning the bare loader snapshot. Centralizing here makes
 * the merge testable and gives every caller the same answer.
 *
 * Pure function with no UI/DB imports — safe to unit-test.
 */

import { CHARACTER_SCHEMA_VERSION, type CoCCharacterData } from '$lib/types/character';
import type {
	CoCSkillAllocation,
	PlayRollHistoryEntry,
	PlayTrackingData,
	SkillDevelopmentMark
} from '$lib/types/character';
import { clampLuckCurrent } from './luck';

export interface PlayStateOverlay {
	currentHP: number;
	currentMP: number;
	currentSanity: number;
	currentLuck: number;
	playSkills: CoCSkillAllocation[];
	playRollHistory: PlayRollHistoryEntry[];
	skillDevelopmentMarks: SkillDevelopmentMark[];
	skillDevelopmentMilestones: string[];
	playTracking: PlayTrackingData;
}

export function composeLiveCharacter(
	base: CoCCharacterData,
	overlay: PlayStateOverlay
): CoCCharacterData {
	return {
		...base,
		schemaVersion: CHARACTER_SCHEMA_VERSION,
		derivedStats: {
			...base.derivedStats,
			hp: { ...base.derivedStats.hp, current: overlay.currentHP },
			mp: { ...base.derivedStats.mp, current: overlay.currentMP },
			sanity: { ...base.derivedStats.sanity, current: overlay.currentSanity },
			// Luck uses a dedicated clamp (0..99) because CoC 7e separates
			// `current` Luck from a starting-Luck "max" — the in-play value can
			// climb past the starting value via rewards, so we can't bound it by
			// `base.derivedStats.luck.max`.
			luck: { ...base.derivedStats.luck, current: clampLuckCurrent(overlay.currentLuck) }
		},
		skills: overlay.playSkills,
		playRollHistory: overlay.playRollHistory,
		skillDevelopmentMarks: overlay.skillDevelopmentMarks,
		skillDevelopmentMilestones: overlay.skillDevelopmentMilestones,
		playTracking: overlay.playTracking
	};
}
