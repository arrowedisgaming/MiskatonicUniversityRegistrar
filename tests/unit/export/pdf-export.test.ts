import { describe, it, expect } from 'vitest';
import { buildDocDefinition } from '$lib/export/pdf-export';
import { createBlankCharacter } from '$lib/types/character';
import type {
	CoCSkillDefinition,
	CoCOccupationDefinition
} from '$lib/types/content-pack';

const skill = (over: Partial<CoCSkillDefinition>): CoCSkillDefinition => ({
	id: 'x',
	name: 'X',
	baseValue: 5,
	category: 'practical',
	isSpecialization: false,
	eras: ['all'],
	...over
});

const FIXTURE_SKILLS: CoCSkillDefinition[] = [
	skill({ id: 'spot-hidden', name: 'Spot Hidden', baseValue: 25, category: 'investigation' }),
	skill({ id: 'dodge', name: 'Dodge', baseValue: 0, derivedBase: 'dex/2', category: 'combat' }),
	skill({
		id: 'cthulhu-mythos',
		name: 'Cthulhu Mythos',
		baseValue: 0,
		category: 'academic',
		noPointAllocation: true
	}),
	skill({ id: 'modern-only', name: 'Computer Use', eras: ['modern'], category: 'practical' })
];

const FIXTURE_OCCUPATIONS: CoCOccupationDefinition[] = [
	{
		id: 'antiquarian',
		name: 'Antiquarian',
		eras: ['all'],
		creditRating: { min: 30, max: 70 },
		skillPointFormula: { terms: [{ characteristic: 'edu', multiplier: 4 }] },
		occupationSkills: [{ skillId: 'spot-hidden', required: true }],
		personalChoiceCount: 4
	}
];

function representativeCharacter() {
	const c = createBlankCharacter();
	c.name = 'Edmund Carter';
	c.age = 34;
	c.residence = 'Arkham, MA';
	c.birthplace = 'Boston, MA';
	c.pronouns = 'he/him';
	c.characteristics.values = {
		str: 60, con: 65, dex: 70, int: 80, pow: 55, app: 50, siz: 60, edu: 75
	};
	c.derivedStats = {
		hp: { current: 12, max: 12 },
		mp: { current: 11, max: 11 },
		sanity: { current: 55, max: 99, startingValue: 55 },
		luck: { current: 50, max: 50, rolls: null },
		damageBonus: '0',
		build: 0,
		moveRate: 8
	};
	c.occupation = { occupationId: 'antiquarian', formulaChoices: {} };
	c.backstory.ideologyBeliefs = 'Knowledge is the only true defense.';
	c.backstory.significantPeople = 'Prof. Henry Armitage, mentor at Miskatonic';
	c.backstory.traits = 'Patient. Methodical. Easily distracted by old books.';
	c.backstory.keyConnection = 'Inherited his uncle\'s library — and its secrets.';
	c.equipment.cash = 250;
	c.equipment.livingStandard = 'Average';
	c.equipment.spendingLevel = 10;
	c.equipment.weapons = [
		{
			name: 'Revolver, .38',
			damage: '1D10',
			range: '15 yards',
			attacksPerRound: '1(3)',
			ammo: 6,
			malfunction: 100
		}
	];
	c.equipment.items = [{ name: 'Pocket notebook', quantity: 1, notes: '' }];
	return c;
}

describe('buildDocDefinition', () => {
	const doc = buildDocDefinition(
		representativeCharacter(),
		'Antiquarian',
		FIXTURE_SKILLS,
		FIXTURE_OCCUPATIONS
	);

	it('uses Letter page size', () => {
		expect(doc.pageSize).toBe('LETTER');
	});

	it('does not emit any explicit page break', () => {
		const json = JSON.stringify(doc);
		expect(json).not.toContain('"pageBreak"');
	});

	it('includes the Chaosium fan-content disclaimer in the footer', () => {
		const footer = doc.footer as { text: string };
		expect(footer?.text).toContain('unofficial Fan Content');
		expect(footer?.text).toContain('Chaosium');
	});

	it('renders all four required section banners', () => {
		const json = JSON.stringify(doc);
		expect(json).toContain('CHARACTERISTICS');
		expect(json).toContain('ATTRIBUTES');
		expect(json).toContain('INVESTIGATOR SKILLS');
		expect(json).toContain('COMBAT & POSSESSIONS');
		expect(json).toContain('BACKSTORY');
	});

	it('shows the investigator name in the header', () => {
		expect(JSON.stringify(doc)).toContain('Edmund Carter');
	});

	it('filters out modern-only skills for a 1920s investigator', () => {
		const json = JSON.stringify(doc);
		expect(json).not.toContain('Computer Use');
	});

	it('marks Spot Hidden as occupation skill via filled marker', () => {
		const json = JSON.stringify(doc);
		// "● Spot Hidden" — the filled circle marker
		expect(json).toMatch(/●\\?\s?Spot Hidden/);
	});
});
