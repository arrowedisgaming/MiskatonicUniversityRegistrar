/**
 * JSON character data migrations. Preserve stored user choices and only add
 * missing fields/defaults required by newer app versions.
 */

import { CHARACTER_SCHEMA_VERSION, type CoCCharacterData } from '$lib/types/character';

type LegacyCharacter = Partial<CoCCharacterData> & Record<string, any>;

const LIVING_STANDARDS = new Set(['Penniless', 'Poor', 'Average', 'Wealthy', 'Rich', 'Super Rich']);

export function migrateCharacterData(raw: unknown): CoCCharacterData {
	const character = raw as LegacyCharacter;

	if (!character.backstory) character.backstory = {} as CoCCharacterData['backstory'];
	character.backstory.personalDescription ??= '';

	if (character.characteristics) {
		character.characteristics.method ??= 'roll';
		character.characteristics.eduImprovementChecks ??= [];
		character.characteristics.luckAdjustment ??= null;
	}

	if (character.derivedStats?.luck) {
		character.derivedStats.luck.rollSets ??= null;
		character.derivedStats.luck.reason ??= null;
	}

	if (character.equipment) {
		const oldSpending = character.equipment.spendingLevel;
		character.equipment.livingStandard ??= typeof oldSpending === 'string' && LIVING_STANDARDS.has(oldSpending)
			? oldSpending
			: '';
		character.equipment.spendingLevel = typeof oldSpending === 'number' ? oldSpending : 0;

		const oldAssets = character.equipment.assets as unknown;
		if (typeof oldAssets === 'number') {
			character.equipment.assets = oldAssets;
			character.equipment.assetsLabel ??= `$${oldAssets.toLocaleString()}`;
		} else {
			const parsedAssets = typeof oldAssets === 'string' ? Number(oldAssets.replace(/[^0-9.]/g, '')) : 0;
			character.equipment.assets = Number.isFinite(parsedAssets) ? parsedAssets : 0;
			character.equipment.assetsLabel ??= typeof oldAssets === 'string' ? oldAssets : '';
		}
	}

	character.playRollHistory ??= [];

	character.schemaVersion = CHARACTER_SCHEMA_VERSION;
	return character as CoCCharacterData;
}
