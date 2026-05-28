import type { CoCEquipmentPack, WeaponDefinition } from '$lib/types/content-pack';

/**
 * Discriminated union of equipment a Keeper can push into a player's
 * inventory through the campaign page. Weapons carry their full definition
 * (damage, range, ammo, malfunction) so the recipient's sheet renders the
 * weapon row without further lookups; items are bare names from the
 * content pack's era-indexed `commonItems` table.
 */
export type EquipmentMatch =
	| { kind: 'weapon'; def: WeaponDefinition }
	| { kind: 'item'; name: string };

/**
 * Flatten a `CoCEquipmentPack` into one searchable corpus.
 *
 * Weapons appear once (they're era-agnostic in the pack). Common items are
 * indexed by era, so we merge every era's list and de-duplicate by name —
 * the Keeper presumably knows the campaign era and can disregard items
 * that don't fit; the cost of an over-broad corpus is a few extra
 * autocomplete suggestions, not a wrong push.
 *
 * Returns a stable corpus (no per-call sorting) so the ranker downstream
 * has predictable input.
 */
export function buildEquipmentCorpus(pack: CoCEquipmentPack): EquipmentMatch[] {
	const corpus: EquipmentMatch[] = pack.weapons.map((def) => ({ kind: 'weapon', def }));

	const seenItems = new Set<string>();
	for (const itemList of Object.values(pack.commonItems)) {
		for (const name of itemList) {
			const key = name.trim().toLowerCase();
			if (!key || seenItems.has(key)) continue;
			seenItems.add(key);
			corpus.push({ kind: 'item', name });
		}
	}
	return corpus;
}

/**
 * Display name regardless of kind — used by both the renderer and the ranker.
 */
export function matchName(match: EquipmentMatch): string {
	return match.kind === 'weapon' ? match.def.name : match.name;
}

/**
 * Score buckets used by the ranker. Lower is better; the renderer relies on
 * the natural sort order, so don't renumber without checking callers.
 *
 *   0 — exact full-name match.
 *   1 — name starts with the query (prefix on the whole string).
 *   2 — a word inside the name starts with the query (e.g. "rev" matches
 *       "Revolver" inside ".38 Revolver"). Word boundaries handle hyphens,
 *       apostrophes, periods, slashes, and parens so CoC names like
 *       "Hunter's knife" and ".38 Revolver" behave intuitively.
 *   3 — mid-word substring match (last resort — keeps things findable).
 *
 * Anything that doesn't match at all is excluded.
 */
type ScoreBucket = 0 | 1 | 2 | 3;

/** Split a name into searchable word tokens — see scoring comment for separators. */
function wordTokens(name: string): string[] {
	return name
		.toLowerCase()
		.split(/[\s\-./'()]+/)
		.filter((t) => t.length > 0);
}

function scoreMatch(name: string, q: string): ScoreBucket | null {
	const lower = name.toLowerCase();
	if (lower === q) return 0;
	if (lower.startsWith(q)) return 1;
	for (const token of wordTokens(name)) {
		if (token.startsWith(q)) return 2;
	}
	if (lower.includes(q)) return 3;
	return null;
}

/**
 * Filter and rank an equipment corpus for an autocomplete query.
 *
 * Behavior is "prefix-prefer with word-boundary awareness, interleaved by
 * match quality". Concretely:
 *
 *   - Empty / whitespace-only query → returns [] (the UI shows no dropdown
 *     until the keeper types something).
 *   - Each entry is bucketed 0–3 by how strongly it matched, then sorted
 *     ascending. Within a bucket, ties are broken alphabetically (case-
 *     insensitive) so the order is predictable across renders.
 *   - Weapons and items aren't grouped — a weapon and an item with the same
 *     score interleave by name. That keeps the top of the list reflective
 *     of "best match" rather than "best match of preferred kind".
 *
 * Pure function — no DOM, no Svelte. Unit-tested at
 * tests/unit/play/equipment-search.test.ts.
 */
export function rankEquipmentMatches(
	query: string,
	corpus: EquipmentMatch[]
): EquipmentMatch[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];

	const scored: Array<{ match: EquipmentMatch; score: ScoreBucket; name: string }> = [];
	for (const match of corpus) {
		const name = matchName(match);
		const score = scoreMatch(name, q);
		if (score === null) continue;
		scored.push({ match, score, name });
	}

	scored.sort((a, b) => {
		if (a.score !== b.score) return a.score - b.score;
		return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
	});

	return scored.map((s) => s.match);
}
