/**
 * Content pack loader — reads and caches CoC 7e game data from static JSON files.
 * Server-side only.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CoCContentPack, CoCSkillDefinition, CoCOccupationDefinition, CoCEquipmentPack } from '$lib/types/content-pack';

const CONTENT_DIR = 'static/content-packs/coc7e';

// Singleton cache
let cachedPack: CoCContentPack | null = null;
let cachedSkills: CoCSkillDefinition[] | null = null;
let cachedOccupations: CoCOccupationDefinition[] | null = null;
let cachedEquipment: CoCEquipmentPack | null = null;

function readJson<T>(filename: string): T {
	const path = join(process.cwd(), CONTENT_DIR, filename);
	return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

export function getContentPack(): CoCContentPack {
	if (!cachedPack) {
		cachedPack = readJson<CoCContentPack>('index.json');
	}
	return cachedPack;
}

export function getSkills(): CoCSkillDefinition[] {
	if (!cachedSkills) {
		cachedSkills = readJson<CoCSkillDefinition[]>('skills.json');
	}
	return cachedSkills;
}

export function getOccupations(): CoCOccupationDefinition[] {
	if (!cachedOccupations) {
		cachedOccupations = readJson<CoCOccupationDefinition[]>('occupations.json');
	}
	return cachedOccupations;
}

export function getEquipment(): CoCEquipmentPack {
	if (!cachedEquipment) {
		cachedEquipment = readJson<CoCEquipmentPack>('equipment.json');
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
