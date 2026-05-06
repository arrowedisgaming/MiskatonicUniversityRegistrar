import { describe, it, expect } from 'vitest';
import {
	getContentPack,
	getSkills,
	getOccupations,
	getEquipment
} from '$lib/server/content/loader';

describe('bundled CoC 7e content pack', () => {
	it('parses index.json against contentPackSchema', () => {
		const pack = getContentPack();
		expect(pack.id).toBeTruthy();
		expect(pack.eras.length).toBeGreaterThan(0);
		expect(pack.damageBonusBuildTable.length).toBeGreaterThan(0);
	});

	it('parses skills.json — every skill has a non-negative base value', () => {
		const skills = getSkills();
		expect(skills.length).toBeGreaterThan(0);
		for (const s of skills) {
			expect(s.id).toMatch(/^[a-z0-9-]+$/);
			expect(s.baseValue).toBeGreaterThanOrEqual(0);
		}
	});

	it('parses occupations.json — every occupation declares personalChoiceCount', () => {
		const occupations = getOccupations();
		expect(occupations.length).toBeGreaterThan(0);
		for (const o of occupations) {
			expect(typeof o.personalChoiceCount).toBe('number');
			expect(o.personalChoiceCount).toBeGreaterThanOrEqual(0);
		}
	});

	it('every occupation skill references a skill that exists in skills.json', () => {
		const skillIds = new Set(getSkills().map((s) => s.id));
		// Specialization placeholders use this prefix; the engine resolves them at choose-time.
		const isPlaceholder = (id: string) =>
			id.startsWith('any-') ||
			id.startsWith('one-') ||
			id.startsWith('art-craft') ||
			id.startsWith('fighting') ||
			id.startsWith('firearms') ||
			id.startsWith('language') ||
			id.startsWith('lore') ||
			id.startsWith('pilot') ||
			id.startsWith('science') ||
			id.startsWith('survival') ||
			id.startsWith('interpersonal');

		const orphaned: { occupation: string; skillId: string }[] = [];
		for (const occ of getOccupations()) {
			for (const entry of occ.occupationSkills) {
				if (!skillIds.has(entry.skillId) && !isPlaceholder(entry.skillId)) {
					orphaned.push({ occupation: occ.id, skillId: entry.skillId });
				}
			}
		}
		expect(orphaned).toEqual([]);
	});

	it('parses equipment.json with at least one weapon', () => {
		const eq = getEquipment();
		expect(eq.weapons.length).toBeGreaterThan(0);
		expect(typeof eq.commonItems).toBe('object');
	});

	it('has a gaslight era entry with £ currency symbol', () => {
		const pack = getContentPack();
		const gaslight = pack.eras.find((e) => e.id === 'gaslight');
		expect(gaslight).toBeTruthy();
		expect(gaslight?.currencySymbol).toBe('£');
		expect(gaslight?.currencyUnit).toBe('pounds');
	});

	it('has a gaslight wealth table with 6 tiers', () => {
		const pack = getContentPack();
		const table = pack.wealthTables['gaslight'];
		expect(Array.isArray(table)).toBe(true);
		expect(table.length).toBe(6);
		// Super Rich tier covers CR 99
		expect(table.find((t) => t.maxCR === 99)).toBeTruthy();
	});

	it('has at least one occupation tagged gaslight', () => {
		const occupations = getOccupations();
		const gaslightOccs = occupations.filter((o) => o.eras.includes('gaslight'));
		expect(gaslightOccs.length).toBeGreaterThan(20);
	});

	it('gaslight occupations include key Victorian entries', () => {
		const occupations = getOccupations();
		const ids = new Set(occupations.filter((o) => o.eras.includes('gaslight')).map((o) => o.id));
		expect(ids.has('consulting-detective')).toBe(true);
		expect(ids.has('aristocrat')).toBe(true);
		expect(ids.has('physician')).toBe(true);
	});

	it('skills.json includes gaslight-specific skills', () => {
		const skills = getSkills();
		const ids = new Set(skills.map((s) => s.id));
		expect(ids.has('alienism')).toBe(true);
		expect(ids.has('mesmerism')).toBe(true);
		expect(ids.has('reassure')).toBe(true);
		expect(ids.has('drive-carriage')).toBe(true);
	});

	it('gaslight equipment has Victorian common items', () => {
		const eq = getEquipment();
		const items = eq.commonItems['gaslight'];
		expect(Array.isArray(items)).toBe(true);
		expect(items.length).toBeGreaterThan(10);
		expect(
			items.some(
				(i) => i.toLowerCase().includes('pocket watch') || i.toLowerCase().includes('gas lamp')
			)
		).toBe(true);
	});
});
