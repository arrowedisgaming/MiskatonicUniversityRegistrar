/**
 * Content pack loader — exposes bundled CoC 7e game data from static JSON files.
 * Server-side only.
 */

import type {
	BackstoryTableEntry,
	CoCContentPack,
	CoCEquipmentPack,
	CoCOccupationDefinition,
	CoCSkillDefinition,
	NameTableEntry
} from '$lib/types/content-pack';
import {
	backstoryTablesSchema,
	contentPackSchema,
	skillsSchema,
	occupationsSchema,
	equipmentSchema,
	namesSchema
} from '$lib/schemas/content-pack.schema';
import contentPack from '../../../../static/content-packs/coc7e/index.json';
import skills from '../../../../static/content-packs/coc7e/skills.json';
import occupations from '../../../../static/content-packs/coc7e/occupations.json';
import equipment from '../../../../static/content-packs/coc7e/equipment.json';
import names from '../../../../static/content-packs/coc7e/names.json';
import backstoryTables from '../../../../static/content-packs/coc7e/backstory-tables.json';

// Singleton cache
let cachedPack: CoCContentPack | null = null;
let cachedSkills: CoCSkillDefinition[] | null = null;
let cachedOccupations: CoCOccupationDefinition[] | null = null;
let cachedEquipment: CoCEquipmentPack | null = null;
let cachedNames: NameTableEntry[] | null = null;
let cachedBackstoryTables: BackstoryTableEntry[] | null = null;

function parseOrThrow<T>(label: string, parsed: { success: true; data: unknown } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } }): T {
	if (!parsed.success) {
		const issues = parsed.error.issues
			.slice(0, 5)
			.map((i) => `${i.path.map(String).join('.') || '<root>'}: ${i.message}`)
			.join('; ');
		throw new Error(`[content-pack] ${label} failed validation: ${issues}`);
	}
	return parsed.data as T;
}

export function getContentPack(): CoCContentPack {
	if (!cachedPack) {
		cachedPack = parseOrThrow<CoCContentPack>('index.json', contentPackSchema.safeParse(contentPack));
	}
	return cachedPack;
}

export function getSkills(): CoCSkillDefinition[] {
	if (!cachedSkills) {
		cachedSkills = parseOrThrow<CoCSkillDefinition[]>('skills.json', skillsSchema.safeParse(skills));
	}
	return cachedSkills;
}

export function getOccupations(): CoCOccupationDefinition[] {
	if (!cachedOccupations) {
		cachedOccupations = parseOrThrow<CoCOccupationDefinition[]>(
			'occupations.json',
			occupationsSchema.safeParse(occupations)
		);
	}
	return cachedOccupations;
}

export function getEquipment(): CoCEquipmentPack {
	if (!cachedEquipment) {
		cachedEquipment = parseOrThrow<CoCEquipmentPack>(
			'equipment.json',
			equipmentSchema.safeParse(equipment)
		);
	}
	return cachedEquipment;
}

export function getNames(): NameTableEntry[] {
	if (!cachedNames) {
		cachedNames = parseOrThrow<NameTableEntry[]>('names.json', namesSchema.safeParse(names));
	}
	return cachedNames;
}

export function getBackstoryTables(): BackstoryTableEntry[] {
	if (!cachedBackstoryTables) {
		cachedBackstoryTables = parseOrThrow<BackstoryTableEntry[]>(
			'backstory-tables.json',
			backstoryTablesSchema.safeParse(backstoryTables)
		);
	}
	return cachedBackstoryTables;
}

/** Load everything needed for the wizard */
export function loadWizardData() {
	return {
		contentPack: getContentPack(),
		skills: getSkills(),
		occupations: getOccupations(),
		equipment: getEquipment(),
		names: getNames(),
		backstoryTables: getBackstoryTables()
	};
}
