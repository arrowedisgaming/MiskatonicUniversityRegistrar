/**
 * Content pack loader — exposes bundled CoC 7e game data from static JSON files.
 * Server-side only.
 */

import type { CoCContentPack, CoCSkillDefinition, CoCOccupationDefinition, CoCEquipmentPack } from '$lib/types/content-pack';
import contentPack from '../../../../static/content-packs/coc7e/index.json';
import skills from '../../../../static/content-packs/coc7e/skills.json';
import occupations from '../../../../static/content-packs/coc7e/occupations.json';
import equipment from '../../../../static/content-packs/coc7e/equipment.json';

// Singleton cache
let cachedPack: CoCContentPack | null = null;
let cachedSkills: CoCSkillDefinition[] | null = null;
let cachedOccupations: CoCOccupationDefinition[] | null = null;
let cachedEquipment: CoCEquipmentPack | null = null;

export function getContentPack(): CoCContentPack {
	if (!cachedPack) {
		cachedPack = contentPack as CoCContentPack;
	}
	return cachedPack;
}

export function getSkills(): CoCSkillDefinition[] {
	if (!cachedSkills) {
		cachedSkills = skills as CoCSkillDefinition[];
	}
	return cachedSkills;
}

export function getOccupations(): CoCOccupationDefinition[] {
	if (!cachedOccupations) {
		cachedOccupations = occupations as CoCOccupationDefinition[];
	}
	return cachedOccupations;
}

export function getEquipment(): CoCEquipmentPack {
	if (!cachedEquipment) {
		cachedEquipment = equipment as CoCEquipmentPack;
	}
	return cachedEquipment;
}

/** Load everything needed for the wizard */
export function loadWizardData() {
	return {
		contentPack: getContentPack(),
		skills: getSkills(),
		occupations: getOccupations(),
		equipment: getEquipment()
	};
}
