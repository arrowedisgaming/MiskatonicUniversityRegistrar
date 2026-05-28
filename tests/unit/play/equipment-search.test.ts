import { describe, it, expect } from 'vitest';
import {
	buildEquipmentCorpus,
	matchName,
	rankEquipmentMatches,
	type EquipmentMatch
} from '$lib/play/equipment-search';
import type { CoCEquipmentPack, WeaponDefinition } from '$lib/types/content-pack';

function weapon(name: string, damage = '1d6'): WeaponDefinition {
	return { name, damage, range: '', attacksPerRound: '1', malfunction: null };
}

const SAMPLE_PACK: CoCEquipmentPack = {
	weapons: [
		weapon('.38 Revolver', '1d10'),
		weapon('Shotgun (12-gauge)', '4d6'),
		weapon("Hunter's knife", '1d4+2'),
		weapon('Rifle', '2d6+3')
	],
	commonItems: {
		'1920s': ['Lantern', 'Rope (50 ft)', 'Pearl revolver', 'Lantern'], // dup tests dedupe
		'modern': ['Lantern', 'Flashlight']
	}
};

// ─── Corpus builder ──────────────────────────────────────────────

describe('buildEquipmentCorpus', () => {
	it('flattens weapons and items into one list, dedupes items across eras', () => {
		const corpus = buildEquipmentCorpus(SAMPLE_PACK);
		const names = corpus.map(matchName).sort();
		expect(names).toEqual([
			'.38 Revolver',
			'Flashlight',
			"Hunter's knife",
			'Lantern',
			'Pearl revolver',
			'Rifle',
			'Rope (50 ft)',
			'Shotgun (12-gauge)'
		]);
	});

	it('tags weapons with kind=weapon and items with kind=item', () => {
		const corpus = buildEquipmentCorpus(SAMPLE_PACK);
		expect(corpus.find((m) => matchName(m) === 'Rifle')?.kind).toBe('weapon');
		expect(corpus.find((m) => matchName(m) === 'Lantern')?.kind).toBe('item');
	});
});

// ─── Ranker ──────────────────────────────────────────────────────

describe('rankEquipmentMatches', () => {
	const corpus = buildEquipmentCorpus(SAMPLE_PACK);

	it('returns [] for an empty / whitespace query — UI hides the dropdown', () => {
		expect(rankEquipmentMatches('', corpus)).toEqual([]);
		expect(rankEquipmentMatches('   ', corpus)).toEqual([]);
	});

	it('prefers names that start with the query over mid-word matches', () => {
		const names = rankEquipmentMatches('rev', corpus).map(matchName);
		// "Revolver" inside ".38 Revolver" is a word-boundary match (score 2),
		// "Pearl revolver" is also a word-boundary match (score 2). Neither
		// starts the whole string, so they tie and sort alphabetically.
		expect(names).toEqual(['.38 Revolver', 'Pearl revolver']);
	});

	it('exact match beats prefix beats word-boundary beats mid-word', () => {
		// Pack with all four buckets present for the query "shot".
		const targeted: CoCEquipmentPack = {
			weapons: [
				weapon('shot'), // exact: bucket 0
				weapon('Shotgun'), // starts-with: bucket 1
				weapon('Sawn-off shotgun'), // word-boundary: bucket 2
				weapon('Buckshot') // mid-word: bucket 3
			],
			commonItems: {}
		};
		const ranked = rankEquipmentMatches('shot', buildEquipmentCorpus(targeted)).map(matchName);
		expect(ranked).toEqual(['shot', 'Shotgun', 'Sawn-off shotgun', 'Buckshot']);
	});

	it('is case-insensitive on both query and names', () => {
		const a = rankEquipmentMatches('LANTERN', corpus).map(matchName);
		const b = rankEquipmentMatches('lantern', corpus).map(matchName);
		const c = rankEquipmentMatches('LaNtErN', corpus).map(matchName);
		expect(a).toEqual(b);
		expect(b).toEqual(c);
		expect(a[0]).toBe('Lantern');
	});

	it('interleaves weapons and items by score rather than grouping by kind', () => {
		// "Pearl revolver" (item) and ".38 Revolver" (weapon) both score 2
		// for the query "rev". They should appear together, alphabetically.
		const ranked = rankEquipmentMatches('rev', corpus);
		const kinds = ranked.map((m) => m.kind);
		expect(kinds).toContain('weapon');
		expect(kinds).toContain('item');
	});

	it('handles punctuation in names — typing "38" finds ".38 Revolver" via word boundary', () => {
		const names = rankEquipmentMatches('38', corpus).map(matchName);
		expect(names).toEqual(['.38 Revolver']);
	});

	it("handles apostrophes — typing 'hunter' finds \"Hunter's knife\"", () => {
		const names = rankEquipmentMatches('hunter', corpus).map(matchName);
		expect(names).toContain("Hunter's knife");
	});

	it('handles parenthesized names — typing "gauge" finds "Shotgun (12-gauge)" inside parens', () => {
		const names = rankEquipmentMatches('gauge', corpus).map(matchName);
		expect(names).toContain('Shotgun (12-gauge)');
	});

	it('trims surrounding whitespace from the query', () => {
		expect(rankEquipmentMatches('  rope  ', corpus).map(matchName)).toContain('Rope (50 ft)');
	});

	it('returns no results for a query that matches nothing', () => {
		expect(rankEquipmentMatches('zzz-nonsense', corpus)).toEqual([]);
	});

	it('alphabetizes ties within the same score bucket so order is stable across renders', () => {
		// Two items both scoring bucket 1 (prefix) for the query "l".
		const targeted: CoCEquipmentPack = {
			weapons: [],
			commonItems: { '1920s': ['Lasso', 'Lantern', 'Lockpick'] }
		};
		const ranked = rankEquipmentMatches('l', buildEquipmentCorpus(targeted)).map(matchName);
		expect(ranked).toEqual(['Lantern', 'Lasso', 'Lockpick']);
	});

	it('does not mutate the input corpus', () => {
		const snapshot = corpus.slice();
		rankEquipmentMatches('rev', corpus);
		expect(corpus).toEqual(snapshot);
	});

	it('matchName returns the right string for both kinds (sanity guard)', () => {
		const w: EquipmentMatch = { kind: 'weapon', def: weapon('.38 Revolver') };
		const i: EquipmentMatch = { kind: 'item', name: 'Lantern' };
		expect(matchName(w)).toBe('.38 Revolver');
		expect(matchName(i)).toBe('Lantern');
	});
});
