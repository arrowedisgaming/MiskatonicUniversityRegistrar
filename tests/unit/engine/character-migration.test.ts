import { describe, it, expect } from 'vitest';
import { migrateCharacterData } from '$lib/engine/character-migration';

describe('migrateCharacterData', () => {
	it('adds v2 fields without recalculating legacy finances', () => {
		const migrated = migrateCharacterData({
			schemaVersion: 1,
			backstory: {
				ideologyBeliefs: '',
				significantPeople: '',
				meaningfulLocations: '',
				treasuredPossessions: '',
				traits: '',
				injuriesScars: '',
				phobiasManias: '',
				arcaneTomesSpellsArtifacts: '',
				encountersWithStrangeEntities: '',
				keyConnection: ''
			},
			characteristics: {
				method: 'roll',
				values: {},
				baseValues: {},
				rolls: null,
				ageAdjustments: []
			},
			derivedStats: { luck: { max: 45, current: 45, rolls: [3, 3, 3] } },
			equipment: {
				items: [],
				weapons: [],
				cash: 82,
				assets: '$2,050',
				spendingLevel: 'Average'
			}
		});

		expect(migrated.backstory.personalDescription).toBe('');
		expect(migrated.characteristics.eduImprovementChecks).toEqual([]);
		expect(migrated.characteristics.luckAdjustment).toBeNull();
		expect(migrated.equipment.livingStandard).toBe('Average');
		expect(migrated.equipment.assets).toBe(2050);
		expect(migrated.equipment.assetsList).toEqual([]);
		expect(migrated.skillDevelopmentMarks).toEqual([]);
		expect(migrated.skillDevelopmentMilestones).toEqual([]);
		expect(migrated.playTracking).toEqual({
			dailySanStart: null,
			dailySanResetAt: null,
			insanity: { temporary: false, indefinite: false, boutOfMadness: false }
		});
	});

	it.each(['arrange-rolls', 'low-roll-modifier', 'human-potential'])(
		'preserves legacy method %s for provenance',
		(method) => {
			const migrated = migrateCharacterData({
				schemaVersion: 4,
				backstory: { ideologyBeliefs: '' },
				characteristics: {
					method,
					values: {},
					baseValues: {},
					rolls: null,
					ageAdjustments: []
				},
				equipment: { items: [], weapons: [], cash: 0, assets: 0, spendingLevel: 0 }
			});
			expect(migrated.characteristics.method).toBe(method);
		}
	);

	it.each([undefined, 'unknown-method', '', 42 as unknown as string])(
		'falls back to point-buy for unrecognised method value %s',
		(method) => {
			const migrated = migrateCharacterData({
				schemaVersion: 4,
				backstory: { ideologyBeliefs: '' },
				characteristics: {
					method,
					values: {},
					baseValues: {},
					rolls: null,
					ageAdjustments: []
				},
				equipment: { items: [], weapons: [], cash: 0, assets: 0, spendingLevel: 0 }
			});
			expect(migrated.characteristics.method).toBe('point-buy');
		}
	);

	it('preserves currently-supported methods (point-buy, quick-fire, roll)', () => {
		for (const method of ['point-buy', 'quick-fire', 'roll'] as const) {
			const migrated = migrateCharacterData({
				schemaVersion: 4,
				backstory: { ideologyBeliefs: '' },
				characteristics: {
					method,
					values: {},
					baseValues: {},
					rolls: null,
					ageAdjustments: []
				},
				equipment: { items: [], weapons: [], cash: 0, assets: 0, spendingLevel: 0 }
			});
			expect(migrated.characteristics.method).toBe(method);
		}
	});

	it('fills v6 play tracking fields without overwriting existing data', () => {
		const migrated = migrateCharacterData({
			schemaVersion: 5,
			backstory: { ideologyBeliefs: '' },
			characteristics: {
				method: 'roll',
				values: {},
				baseValues: {},
				rolls: null,
				ageAdjustments: []
			},
			equipment: { items: [], weapons: [], cash: 0, assets: 0, spendingLevel: 0 },
			skillDevelopmentMarks: [
				{
					id: 'mark-1',
					skillId: 'spot-hidden',
					customName: null,
					skillDisplayLabel: 'Spot Hidden',
					source: 'manual',
					at: '2026-05-15T00:00:00.000Z'
				}
			],
			playTracking: {
				dailySanStart: 40,
				dailySanResetAt: '2026-05-15T00:00:00.000Z',
				insanity: { temporary: true }
			}
		});

		expect(migrated.skillDevelopmentMarks).toHaveLength(1);
		expect(migrated.playTracking.dailySanStart).toBe(40);
		expect(migrated.playTracking.insanity).toEqual({
			temporary: true,
			indefinite: false,
			boutOfMadness: false
		});
	});

	it('defaults portraitUrl for legacy investigators', () => {
		const migrated = migrateCharacterData({
			schemaVersion: 1,
			backstory: { ideologyBeliefs: '' },
			characteristics: {
				method: 'roll',
				values: {},
				baseValues: {},
				rolls: null,
				ageAdjustments: []
			},
			equipment: { items: [], weapons: [], cash: 0, assets: 0, spendingLevel: 0 }
		});

		expect(migrated.portraitUrl).toBe('');
	});
});
