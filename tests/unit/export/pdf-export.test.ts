import { describe, it, expect } from 'vitest';
import { buildDocDefinition } from '$lib/export/pdf-export';
import { createBlankCharacter } from '$lib/types/character';
import { BACKSTORY_KEYS } from '$lib/engine/backstory';
import type {
	CoCSkillDefinition,
	CoCOccupationDefinition,
	CoCContentPack
} from '$lib/types/content-pack';
import type { Era } from '$lib/types/common';

const FIXTURE_CONTENT_PACK = {
	eras: [
		{ id: '1920s', name: '1920s Classic', description: '', currencyUnit: 'dollars', currencySymbol: '$' },
		{ id: 'modern', name: 'Modern Day', description: '', currencyUnit: 'dollars', currencySymbol: '$' },
		{ id: 'gaslight', name: 'Gaslight (1880–1899)', description: '', currencyUnit: 'pounds', currencySymbol: '£' }
	]
} as unknown as CoCContentPack;

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

function findNode(root: unknown, predicate: (node: any) => boolean): any | null {
	const seen = new Set<unknown>();
	const stack: unknown[] = [root];

	while (stack.length > 0) {
		const node = stack.pop();
		if (!node || typeof node !== 'object' || seen.has(node)) continue;
		seen.add(node);

		if (predicate(node)) return node;

		const values = Array.isArray(node) ? node : Object.values(node);
		for (const value of values) {
			if (value && typeof value === 'object') stack.push(value);
		}
	}

	return null;
}

function containsText(root: unknown, text: string): boolean {
	return Boolean(findNode(root, (node) => node.text === text));
}

function findTableWithFirstCellText(root: unknown, text: string): any | null {
	return findNode(root, (node) => node.table?.body?.[0]?.[0]?.text === text);
}

describe('buildDocDefinition', () => {
	const doc = buildDocDefinition(
		representativeCharacter(),
		'Antiquarian',
		FIXTURE_SKILLS,
		FIXTURE_OCCUPATIONS,
		FIXTURE_CONTENT_PACK
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

	it('keeps section bands red while vertically centering their labels', () => {
		const styles = doc.styles as Record<string, any>;
		expect(styles.banner.alignment).toBeUndefined();
		expect(styles.banner.fillColor).toBe('#5C1A1B');
		expect(styles.banner.lineHeight).toBe(1);

		const characteristicsBanner = findTableWithFirstCellText(doc, 'CHARACTERISTICS');
		expect(characteristicsBanner).toBeTruthy();
		expect(characteristicsBanner.table.body[0][0].margin).toEqual([4, 3, 4, 1]);
		expect(characteristicsBanner.layout.fillColor()).toBe('#5C1A1B');
		expect(characteristicsBanner.layout.paddingTop()).toBe(0);
		expect(characteristicsBanner.layout.paddingBottom()).toBe(0);

		const characteristicsCorner = findNode(
			doc,
			(node) => node.text === '' && node.fillColor === '#000000'
		);
		expect(characteristicsCorner).toBeTruthy();
	});

	it('shows the investigator name in the header', () => {
		expect(JSON.stringify(doc)).toContain('Edmund Carter');
	});

	it('filters out modern-only skills for a 1920s investigator', () => {
		const json = JSON.stringify(doc);
		expect(json).not.toContain('Computer Use');
	});

	it('marks Spot Hidden as an occupation skill in bold', () => {
		const json = JSON.stringify(doc);
		// Renders as "• Spot Hidden" with bold:true on the cell. The bullet
		// is in Roboto's glyph set; the older filled-circle marker tofu'd.
		expect(json).toMatch(/"text":"• Spot Hidden"[^}]*?"bold":true/);
	});

	it('keeps attribute tracker boxes compact and visually centered', () => {
		const luckBox = findTableWithFirstCellText(doc, 'LUCK');
		expect(luckBox).toBeTruthy();
		expect(luckBox.table.heights).toBeUndefined();
		expect(luckBox.layout.paddingTop(0)).toBe(2);
		expect(luckBox.layout.paddingBottom(0)).toBe(2);
		expect(luckBox.layout.paddingTop(1)).toBe(3);
		expect(luckBox.layout.paddingBottom(1)).toBe(3);
	});

	it('adds modest spacing inside and above the backstory grid', () => {
		const ideologyCell = findTableWithFirstCellText(doc, 'IDEOLOGY / BELIEFS');
		expect(ideologyCell).toBeTruthy();
		// Tight label → body gap (no extra bottom margin on the title; padding handles inset).
		expect(ideologyCell.table.body[0][0].margin).toEqual([0, 0, 0, 0]);
		expect(ideologyCell.table.body[0][0].fillColor).toBe('#ffffff');
		expect(ideologyCell.table.body[1][0].fillColor).toBe('#ffffff');

		const sigCell = findTableWithFirstCellText(doc, 'SIGNIFICANT PEOPLE');
		expect(sigCell).toBeTruthy();
		expect(sigCell.table.body[1][0].fillColor).toBe('#f3f2f1');

		const keyConnCell = findTableWithFirstCellText(doc, 'KEY CONNECTION');
		expect(keyConnCell).toBeTruthy();
		expect(keyConnCell.table.body[0][0].fillColor).toBe('#f3f2f1');

		const traitsCell = findTableWithFirstCellText(doc, 'TRAITS');
		expect(traitsCell).toBeTruthy();
		expect(traitsCell.table.body[1][0].fillColor).toBe('#ffffff');

		const ideologyRow = findNode(
			doc,
			(node) => Array.isArray(node.columns) &&
				Array.isArray(node.margin) &&
				node.margin[3] === 2 &&
				containsText(node, 'IDEOLOGY / BELIEFS')
		);
		expect(ideologyRow).toBeTruthy();

		const backstoryGrid = findNode(
			doc,
			(node) => Array.isArray(node.stack) &&
				Array.isArray(node.margin) &&
				node.margin[1] === 2 &&
				node.stack.some((item: unknown) => containsText(item, 'IDEOLOGY / BELIEFS'))
		);
		expect(backstoryGrid).toBeTruthy();
	});

	it('allows longer backstory values before truncating for the expanded layout', () => {
		const long = 'x'.repeat(150);
		const character = representativeCharacter();
		character.backstory.personalDescription = long;

		const expandedDoc = buildDocDefinition(
			character,
			'Antiquarian',
			FIXTURE_SKILLS,
			FIXTURE_OCCUPATIONS,
			FIXTURE_CONTENT_PACK
		);
		const personalDescriptionCell = findTableWithFirstCellText(expandedDoc, 'PERSONAL DESCRIPTION');
		expect(personalDescriptionCell).toBeTruthy();
		const value = personalDescriptionCell.table.body[1][0].text;
		expect(value).toHaveLength(128);
		expect(value.endsWith('…')).toBe(true);
	});

	it('renders gaslight era name in subtitle, not raw id', () => {
		const char = representativeCharacter();
		char.era = 'gaslight' as Era;
		const gaslightDoc = buildDocDefinition(
			char,
			'Consulting Detective',
			FIXTURE_SKILLS,
			FIXTURE_OCCUPATIONS,
			FIXTURE_CONTENT_PACK
		);
		const json = JSON.stringify(gaslightDoc);
		expect(json).toContain('Gaslight (1880');
		expect(json).not.toContain('"gaslight Era"');
	});

	it('renders as a single-page PDF even with worst-case backstory', async () => {
		const worst = representativeCharacter();

		// Fill every backstory field with long text to stress the layout.
		const long = [
			'This is intentionally long backstory text designed to stress wrapping, truncation, and layout constraints.',
			'It should never cause the investigator sheet to overflow onto a second page.'
		].join(' ');

		for (const k of BACKSTORY_KEYS) {
			worst.backstory[k] = `${long} ${long} ${long}`;
		}

		const worstDoc: any = buildDocDefinition(worst, 'Antiquarian', FIXTURE_SKILLS, FIXTURE_OCCUPATIONS, FIXTURE_CONTENT_PACK);
		// Make the output parseable by a lightweight page-count heuristic.
		// pdfmake defaults to compression, which can hide the "/Type /Page" markers.
		worstDoc.compress = false;
		// Ensure pdfkit buffers pages so we can reliably count them in tests.
		worstDoc.bufferPages = true;

		// pdfmake is loaded only in this test to keep the doc-definition tests fast.
		const pdfMake = (await import('pdfmake/build/pdfmake')).default as any;
		const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default as any;
		pdfMake.addVirtualFileSystem(pdfFonts);

		const pdfDoc = pdfMake.createPdf(worstDoc);
		const pdfKit = await pdfDoc.pdfDocumentPromise;
		expect(pdfKit).toBeTruthy();

		// Force full layout/render.
		await pdfDoc.getBuffer();

		const pdfMakePages = (pdfKit as any)._pdfMakePages;
		const pageCount = Array.isArray(pdfMakePages) ? pdfMakePages.length : null;
		expect(pageCount).toBe(1);
	}, 30_000);
});

// Intentionally no byte-parsing heuristic: pdfmake may compress/object-stream the output,
// while pdfkit's bufferedPageRange() gives a reliable page count.
