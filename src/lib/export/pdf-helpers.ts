/**
 * Pure helpers for one-page investigator-sheet PDF rendering.
 * No pdfmake imports — pdf-export.ts wraps these into the doc definition.
 */

import type {
	CoCCharacterData,
	CoCSkillAllocation,
	CharacteristicsData
} from '$lib/types/character';
import type {
	CoCSkillDefinition,
	CoCOccupationDefinition
} from '$lib/types/content-pack';
import type { CharacteristicId, Era } from '$lib/types/common';

export interface SkillRow {
	key: string;
	displayName: string;
	/**
	 * `null` for generic specialization fill-in rows whose group has mixed bases
	 * (e.g. Firearms, Fighting). The renderer prints empty value/half/fifth cells
	 * so the player writes in the correct target for the specialization they
	 * choose rather than reading an arbitrary first-definition base.
	 */
	value: number | null;
	isOccupation: boolean;
	isImproved: boolean;
	category: string;
	isBlankSlot: boolean;
}

export function filterSkillsForEra(
	defs: CoCSkillDefinition[],
	era: Era
): CoCSkillDefinition[] {
	return defs.filter((d) => d.eras.includes('all') || d.eras.includes(era));
}

/** Resolve a skill's effective base from `derivedBase` (e.g. "dex/2", "edu"). */
export function computeDerivedBase(
	def: CoCSkillDefinition,
	chars: CharacteristicsData
): number {
	if (!def.derivedBase) return def.baseValue;
	const match = def.derivedBase.match(/^([a-z]+)(?:\/(\d+))?$/);
	if (!match) return def.baseValue;
	const [, charName, divisor] = match;
	const value = chars.values[charName as CharacteristicId];
	if (typeof value !== 'number') return def.baseValue;
	if (divisor) {
		const d = parseInt(divisor, 10);
		return d > 0 ? Math.floor(value / d) : def.baseValue;
	}
	return value;
}

export function formatSkillName(
	def: CoCSkillDefinition,
	allocation?: CoCSkillAllocation | null
): string {
	if (allocation?.customName) return allocation.customName;
	return def.name;
}

export function truncate(text: string, maxChars: number): string {
	if (!text) return '';
	if (maxChars <= 0) return '';
	if (text.length <= maxChars) return text;
	return text.slice(0, Math.max(1, maxChars - 1)).trimEnd() + '…';
}

export function findOccupation(
	occupations: CoCOccupationDefinition[],
	occupationId: string | null | undefined
): CoCOccupationDefinition | null {
	if (!occupationId) return null;
	return occupations.find((o) => o.id === occupationId) ?? null;
}

export function getOccupationSkillIds(
	occupation: CoCOccupationDefinition | null
): Set<string> {
	if (!occupation) return new Set();
	return new Set(occupation.occupationSkills.map((s) => s.skillId));
}

/** Strip the "(Foo)" suffix from a specialization name to get the parent label. */
function specGroupLabel(def: CoCSkillDefinition): string {
	const m = def.name.match(/^([^(]+)\(/);
	return (m ? m[1] : def.name).trim();
}

/**
 * Build display rows for the PDF skill table.
 * - Era-filtered base skills.
 * - Specialization groups collapse to (allocations + 1 blank fillable slot).
 * - Derived base computation for skills with `derivedBase`.
 * - Occupation marker from allocation flag OR occupation definition's skill list.
 * - Sorted by displayed name so the printed columns read alphabetically.
 */
export function buildSkillRows(
	character: CoCCharacterData,
	definitions: CoCSkillDefinition[],
	occupation: CoCOccupationDefinition | null
): SkillRow[] {
	const eraDefs = filterSkillsForEra(definitions, character.era);
	const occSkillIds = getOccupationSkillIds(occupation);
	const allocByDefId = new Map(character.skills.map((s) => [s.skillId, s]));

	const nonSpec: SkillRow[] = [];
	const specGroups = new Map<string, CoCSkillDefinition[]>();

	for (const def of eraDefs) {
		if (def.isSpecialization && def.specializationGroup) {
			const list = specGroups.get(def.specializationGroup) ?? [];
			list.push(def);
			specGroups.set(def.specializationGroup, list);
			continue;
		}
		const allocation = allocByDefId.get(def.id) ?? null;
		const base = computeDerivedBase(def, character.characteristics);
		const value = allocation ? allocation.total : base;
		nonSpec.push({
			key: def.id,
			displayName: formatSkillName(def, allocation),
			value,
			isOccupation: (allocation?.isOccupation ?? false) || occSkillIds.has(def.id),
			isImproved: value > base,
			category: def.category,
			isBlankSlot: false
		});
	}

	const specRows: SkillRow[] = [];
	for (const [group, defs] of specGroups) {
		const sample = defs[0];
		const groupName = specGroupLabel(sample);
		const category = sample.category;

		const groupAllocations = character.skills.filter((s) =>
			defs.some((d) => d.id === s.skillId)
		);

		for (const alloc of groupAllocations) {
			const def = defs.find((d) => d.id === alloc.skillId);
			if (!def) continue;
			const base = computeDerivedBase(def, character.characteristics);
			specRows.push({
				key: alloc.skillId + (alloc.customName ? `:${alloc.customName}` : ''),
				displayName: formatSkillName(def, alloc),
				value: alloc.total,
				isOccupation: alloc.isOccupation || occSkillIds.has(alloc.skillId),
				isImproved: alloc.total > base,
				category,
				isBlankSlot: false
			});
		}

		// Only emit a concrete value on the generic blank row when every
		// definition in the group shares the same base AND none derive from a
		// characteristic. Otherwise the row stands for any specialization the
		// player writes in, and a single number would mislead.
		const uniformBase =
			defs.every((d) => !d.derivedBase) &&
			defs.every((d) => d.baseValue === sample.baseValue);

		specRows.push({
			key: `${group}:blank`,
			displayName: `${groupName}(________)`,
			value: uniformBase ? sample.baseValue : null,
			isOccupation: false,
			isImproved: false,
			category,
			isBlankSlot: true
		});
	}

	// Custom skill defs (homebrew / supplement skills not in the content pack)
	const customRows: SkillRow[] = [];
	for (const def of character.customSkillDefs ?? []) {
		const allocation = allocByDefId.get(def.id) ?? null;
		const value = allocation ? allocation.total : def.baseValue;
		customRows.push({
			key: def.id,
			displayName: def.name,
			value,
			isOccupation: allocation?.isOccupation ?? false,
			isImproved: value > def.baseValue,
			category: 'other',
			isBlankSlot: false
		});
	}

	const all = [...nonSpec, ...specRows, ...customRows];
	all.sort((a, b) => {
		const byName = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
		if (byName !== 0) return byName;
		if (a.isBlankSlot !== b.isBlankSlot) return a.isBlankSlot ? 1 : -1;
		return a.key.localeCompare(b.key);
	});
	return all;
}

/** Distribute a list into N roughly-equal columns (top-to-bottom, left-to-right).
 * Empty columns are returned only when the input itself is empty — for non-empty
 * input with fewer items than columns, the result is clamped so we never emit
 * trailing zero-row columns (pdfmake renders those as empty tables, not nothing).
 */
export function distributeIntoColumns<T>(items: T[], columnCount: number): T[][] {
	if (columnCount <= 0) return [items];
	if (items.length === 0) return Array.from({ length: columnCount }, () => []);
	const effectiveColumns = Math.min(columnCount, items.length);
	const perColumn = Math.ceil(items.length / effectiveColumns);
	const cols: T[][] = [];
	for (let i = 0; i < effectiveColumns; i++) {
		cols.push(items.slice(i * perColumn, (i + 1) * perColumn));
	}
	return cols;
}
