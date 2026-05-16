import { describe, expect, it } from 'vitest';
import {
	CHARACTER_SCHEMA_VERSION,
	createBlankCharacter,
	type CoCCharacterData,
	type PlayRollHistoryEntry,
	type PlayTrackingData,
	type SkillDevelopmentMark
} from '$lib/types/character';
import { composeLiveCharacter, type PlayStateOverlay } from '$lib/engine/play-state';

function baseCharacter(): CoCCharacterData {
	const c = createBlankCharacter();
	c.schemaVersion = 5; // pretend it loaded under an older schema
	c.derivedStats.hp = { max: 12, current: 12 };
	c.derivedStats.mp = { max: 14, current: 14 };
	c.derivedStats.sanity = { max: 80, current: 80, startingValue: 80 };
	c.derivedStats.luck = { max: 60, current: 60, rolls: null };
	c.skills = [
		{
			skillId: 'spot-hidden',
			customName: null,
			baseValue: 25,
			allocations: [],
			isOccupation: false,
			total: 25,
			half: 12,
			fifth: 5
		}
	];
	return c;
}

function defaultPlayTracking(): PlayTrackingData {
	return {
		dailySanStart: null,
		dailySanResetAt: null,
		insanity: { temporary: false, indefinite: false, boutOfMadness: false }
	};
}

function overlayFrom(c: CoCCharacterData, patch: Partial<PlayStateOverlay> = {}): PlayStateOverlay {
	return {
		currentHP: c.derivedStats.hp.current,
		currentMP: c.derivedStats.mp.current,
		currentSanity: c.derivedStats.sanity.current,
		currentLuck: c.derivedStats.luck.current,
		playSkills: c.skills,
		playRollHistory: c.playRollHistory ?? [],
		skillDevelopmentMarks: c.skillDevelopmentMarks ?? [],
		skillDevelopmentMilestones: c.skillDevelopmentMilestones ?? [],
		playTracking: c.playTracking ?? defaultPlayTracking(),
		...patch
	};
}

describe('composeLiveCharacter', () => {
	it('always stamps the current schema version so persisted payloads stay forward-compatible', () => {
		const base = baseCharacter();
		expect(base.schemaVersion).toBe(5);
		const live = composeLiveCharacter(base, overlayFrom(base));
		expect(live.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION);
	});

	it('overlays current HP / MP / Sanity onto the base derivedStats without touching max values', () => {
		const base = baseCharacter();
		const live = composeLiveCharacter(
			base,
			overlayFrom(base, { currentHP: 4, currentMP: 9, currentSanity: 53 })
		);
		expect(live.derivedStats.hp).toEqual({ max: 12, current: 4 });
		expect(live.derivedStats.mp).toEqual({ max: 14, current: 9 });
		expect(live.derivedStats.sanity).toEqual({ max: 80, current: 53, startingValue: 80 });
	});

	it('clamps current Luck to 0..99 regardless of starting Luck', () => {
		const base = baseCharacter(); // starting luck max = 60
		const climbed = composeLiveCharacter(base, overlayFrom(base, { currentLuck: 87 }));
		expect(climbed.derivedStats.luck.current).toBe(87);
		expect(climbed.derivedStats.luck.max).toBe(60);

		const ceiling = composeLiveCharacter(base, overlayFrom(base, { currentLuck: 250 }));
		expect(ceiling.derivedStats.luck.current).toBe(99);

		const floor = composeLiveCharacter(base, overlayFrom(base, { currentLuck: -4 }));
		expect(floor.derivedStats.luck.current).toBe(0);
	});

	it('replaces the skill list, history, marks, milestones, and play tracking with the overlay values', () => {
		const base = baseCharacter();
		const developedSpot = {
			...base.skills[0],
			allocations: [{ source: 'experience' as const, sourceLabel: 'Development 2026-05-16', points: 7 }],
			total: 32,
			half: 16,
			fifth: 6
		};
		const mark: SkillDevelopmentMark = {
			id: 'mark-1',
			skillId: 'spot-hidden',
			customName: null,
			skillDisplayLabel: 'Spot Hidden',
			source: 'manual',
			at: '2026-05-16T00:00:00.000Z'
		};
		const playHistory: PlayRollHistoryEntry[] = [
			{
				id: 'roll-1',
				at: '2026-05-16T00:00:00.000Z',
				targetKind: 'sanCheck',
				target: 50,
				rawRoll: 35,
				effectiveRoll: 35,
				outcome: 'regular',
				isFumble: false,
				lossApplied: false
			}
		];
		const tracking: PlayTrackingData = {
			dailySanStart: 50,
			dailySanResetAt: '2026-05-16T00:00:00.000Z',
			insanity: { temporary: true, indefinite: false, boutOfMadness: false }
		};

		const live = composeLiveCharacter(
			base,
			overlayFrom(base, {
				playSkills: [developedSpot],
				playRollHistory: playHistory,
				skillDevelopmentMarks: [mark],
				skillDevelopmentMilestones: ['spot-hidden::'],
				playTracking: tracking
			})
		);

		expect(live.skills).toEqual([developedSpot]);
		expect(live.playRollHistory).toEqual(playHistory);
		expect(live.skillDevelopmentMarks).toEqual([mark]);
		expect(live.skillDevelopmentMilestones).toEqual(['spot-hidden::']);
		expect(live.playTracking).toEqual(tracking);
	});

	it('preserves non-overlaid fields from the base character (identity, equipment, characteristics, occupation)', () => {
		const base = baseCharacter();
		base.name = 'Ada Wexler';
		base.age = 34;
		base.equipment.cash = 240;
		base.characteristics.values.str = 70;
		const live = composeLiveCharacter(base, overlayFrom(base));
		expect(live.name).toBe('Ada Wexler');
		expect(live.age).toBe(34);
		expect(live.equipment.cash).toBe(240);
		expect(live.characteristics.values.str).toBe(70);
	});

	it('regression: cloning composeLiveCharacter() carries Play Mode changes into a downstream edit payload', () => {
		// Mirrors the Codex finding: startEdit used to clone the stale loader
		// snapshot. After this refactor, cloning liveChar (== composeLiveCharacter
		// output) must always include the overlay so the user's Play Mode
		// adjustments survive entering edit mode.
		const base = baseCharacter();
		const live = composeLiveCharacter(
			base,
			overlayFrom(base, {
				currentSanity: 41,
				skillDevelopmentMilestones: ['spot-hidden::']
			})
		);
		const editClone = structuredClone(live);
		expect(editClone.derivedStats.sanity.current).toBe(41);
		expect(editClone.skillDevelopmentMilestones).toEqual(['spot-hidden::']);
	});
});
