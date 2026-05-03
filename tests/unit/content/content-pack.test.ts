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
});
