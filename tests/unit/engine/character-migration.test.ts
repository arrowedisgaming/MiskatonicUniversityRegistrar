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
		expect(migrated.equipment.assetsLabel).toBe('$2,050');
		expect(migrated.equipment.assetsList).toEqual([]);
	});
});
