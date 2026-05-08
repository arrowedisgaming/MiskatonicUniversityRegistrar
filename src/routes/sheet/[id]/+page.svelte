<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';
	import { preventNumberWheel } from '$lib/actions/number-input';
	import { ALL_CHARACTERISTICS, CHARACTERISTIC_LABELS } from '$lib/types/common';
	import type { CharacteristicId } from '$lib/types/common';
	import { halfValue, fifthValue } from '$lib/engine/characteristics';
	import { calculateAllDerived } from '$lib/engine/derived-stats';
	import {
		computeSkillValues,
		createSkillAllocation,
		resolveSkillBaseValue
	} from '$lib/engine/skills';
	import {
		buildPlayModeSkills,
		filterSkillDefsForSheetAddPicker,
		shouldShowInvestigatorSkillOnSheet,
		skillDefMatchesSheetAddSearch
	} from '$lib/engine/investigator-sheet-skills';
	import type { CoCSkillDefinition, WeaponDefinition } from '$lib/types/content-pack';
	import {
		CHARACTER_SCHEMA_VERSION,
		type AssetItem,
		type CharacterWeapon,
		type CoCCharacterData,
		type CoCSkillAllocation,
		type EquipmentItem,
		type PlayRollHistoryEntry,
		type SkillPointAllocation
	} from '$lib/types/character';
	import {
		describeWeaponDiceLimitViolations,
		isWeaponDamageFormulaSupported,
		planWeaponDamageRoll,
		splitDamageSegments
	} from '$lib/engine/weapon-damage-roll';
	import { BACKSTORY_KEYS, BACKSTORY_LABEL_BY_KEY, type BackstoryKey } from '$lib/engine/backstory';
	import { resolveSkillDisplayName } from '$lib/engine/occupation-filter';
	import PDFExportButton from '$lib/components/investigator/PDFExportButton.svelte';
	import ShareDialog from '$lib/components/investigator/ShareDialog.svelte';
	import SheetReadOnly from '$lib/components/investigator/SheetReadOnly.svelte';
	import { rollDie } from '$lib/engine/dice';
	import { showDiceRoll } from '$lib/stores/dice-rolls';
	import { makeDiceRollRequest } from '$lib/dice/protocol';
	import {
		evaluateCoC7ePercentileCheck,
		type CoCPercentileCheckResult
	} from '$lib/engine/coc-percentile-check';

	// Keep the in-memory roll log bounded well under the schema's 10,000 cap so
	// API saves never hit the Zod max and silently fail.
	const PLAY_ROLL_HISTORY_KEEP = 500;

	let { data }: PageProps = $props();

	const char = $derived(data.investigator.character);
	const occupation = $derived(
		data.occupations.find((o) => o.id === char.occupation?.occupationId)
	);

	// In-play trackers — intentionally one-shot snapshots. `untrack()` makes
	// the non-reactive read explicit so the player's adjustments persist across
	// navigation jitter rather than auto-resetting when `data` re-emits.
	let currentHP = $state(untrack(() => data.investigator.character.derivedStats.hp.current));
	let currentMP = $state(untrack(() => data.investigator.character.derivedStats.mp.current));
	let currentSanity = $state(
		untrack(() => data.investigator.character.derivedStats.sanity.current)
	);
	let currentLuck = $state(untrack(() => data.investigator.character.derivedStats.luck.current));
	let playMode = $state(false);

	let playRollHistory = $state<PlayRollHistoryEntry[]>(
		untrack(() => [...(data.investigator.character.playRollHistory ?? [])])
	);
	let diceRolling = $state(false);
	let lastRollBanner = $state<{ title: string; detail: string } | null>(null);
	let lastRollClearTimer: ReturnType<typeof setTimeout> | null = null;

	let isDirty = $state(false);

	let editMode = $state(false);
	let editSaving = $state(false);
	let editError = $state<string | null>(null);
	let editChar = $state<CoCCharacterData | null>(null);

	const SHEET_ADD_SKILL_MATCH_LIMIT = 15;
	const SHEET_ADD_WEAPON_MATCH_LIMIT = 15;

	let skillSearchQuery = $state('');
	let equipWeaponSearchQuery = $state('');
	let equipItemDraftName = $state('');
	let assetDraft = $state<AssetItem>({ name: '', value: 0, type: '', description: '' });
	let hideUncommonAndRestrictedSkills = $state(true);
	let skillCustomizeForAdd = $state<CoCSkillDefinition | null>(null);
	let skillCustomizeNameInput = $state('');

	function resetSkillAddUi() {
		skillSearchQuery = '';
		hideUncommonAndRestrictedSkills = true;
		skillCustomizeForAdd = null;
		skillCustomizeNameInput = '';
	}

	function resetEquipAddUi() {
		equipWeaponSearchQuery = '';
		equipItemDraftName = '';
		assetDraft = { name: '', value: 0, type: '', description: '' };
	}

	function showTransientRollBanner(next: { title: string; detail: string }) {
		lastRollBanner = next;
		if (lastRollClearTimer) clearTimeout(lastRollClearTimer);
		lastRollClearTimer = setTimeout(() => {
			lastRollBanner = null;
			lastRollClearTimer = null;
		}, 3500);
	}

	function cloneCharacter(source: CoCCharacterData): CoCCharacterData {
		// CoCCharacterData is JSON-serializable; structuredClone keeps it fast/safe.
		return structuredClone(source);
	}

	function ensureBackstoryShape(next: CoCCharacterData): CoCCharacterData {
		const backstory = { ...next.backstory } as CoCCharacterData['backstory'];
		for (const k of BACKSTORY_KEYS) {
			backstory[k] = (backstory[k] ?? '') as (typeof backstory)[typeof k];
		}
		return { ...next, backstory };
	}

	function backstoryLabel(key: string): string {
		return (
			BACKSTORY_LABEL_BY_KEY[key as BackstoryKey] ?? key.replace(/([A-Z])/g, ' $1').trim()
		);
	}

	function startEdit() {
		// Avoid overlapping with play-mode interactions.
		playMode = false;
		editError = null;
		editChar = ensureBackstoryShape(cloneCharacter(char));
		editMode = true;
		resetSkillAddUi();
		resetEquipAddUi();
	}

	function cancelEdit() {
		editMode = false;
		editSaving = false;
		editError = null;
		editChar = null;
		resetSkillAddUi();
		resetEquipAddUi();
	}

	function mutateEditChar(updater: (c: CoCCharacterData) => CoCCharacterData) {
		if (!editChar) return;
		editChar = updater(editChar);
	}

	/** SvelteKit `error()` responses are JSON `{ message: string }` — show that, not raw JSON. */
	function readableApiError(body: string, status: number): string {
		const s = body.trim();
		if (!s) return `Save failed (HTTP ${status})`;
		try {
			const data = JSON.parse(s) as unknown;
			if (
				data !== null &&
				typeof data === 'object' &&
				'message' in data &&
				typeof (data as { message: unknown }).message === 'string'
			) {
				return (data as { message: string }).message;
			}
		} catch {
			/* plain text or non-JSON */
		}
		return s;
	}

	async function persistCharacter(next: CoCCharacterData): Promise<{ ok: true } | { ok: false; message: string }> {
		const res = await fetch(`/api/investigators/${data.investigator.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ character: next })
		});

		if (res.ok) return { ok: true };
		const text = await res.text().catch(() => '');
		return {
			ok: false,
			message: readableApiError(text, res.status) || `Save failed (HTTP ${res.status})`
		};
	}

	function clampInt(n: number, min: number, max: number): number {
		if (!Number.isFinite(n)) return min;
		return Math.max(min, Math.min(max, Math.trunc(n)));
	}

	function recomputeDerived(next: CoCCharacterData): CoCCharacterData {
		const cthulhuMythos = next.skills.find((s) => s.skillId === 'cthulhu-mythos')?.total ?? 0;
		const derived = calculateAllDerived(
			next.characteristics.values,
			next.age,
			cthulhuMythos,
			data.contentPack.damageBonusBuildTable,
			data.contentPack.ageModifiers
		);

		const hpCurrent = clampInt(next.derivedStats.hp.current, 0, derived.hp);
		const mpCurrent = clampInt(next.derivedStats.mp.current, 0, derived.mp);
		const sanityCurrent = clampInt(next.derivedStats.sanity.current, 0, derived.maxSanity);
		const luckMax = clampInt(next.derivedStats.luck.max, 0, 99);
		const luckCurrent = clampInt(next.derivedStats.luck.current, 0, luckMax);

		return {
			...next,
			derivedStats: {
				...next.derivedStats,
				hp: { max: derived.hp, current: hpCurrent },
				mp: { max: derived.mp, current: mpCurrent },
				sanity: {
					max: derived.maxSanity,
					current: sanityCurrent,
					startingValue: clampInt(next.derivedStats.sanity.startingValue, 0, derived.startingSanity)
				},
				luck: { ...next.derivedStats.luck, max: luckMax, current: luckCurrent },
				damageBonus: derived.damageBonus,
				build: derived.build,
				moveRate: derived.moveRate
			}
		};
	}

	function updateCharacteristic(statId: CharacteristicId, nextValue: number) {
		mutateEditChar((c) => {
			const v = clampInt(nextValue, 0, 99);
			const next: CoCCharacterData = {
				...c,
				characteristics: {
					...c.characteristics,
					values: { ...c.characteristics.values, [statId]: v },
					baseValues: { ...c.characteristics.baseValues, [statId]: v }
				}
			};
			// Keep derived-base skills (e.g., Dodge) in sync while editing.
			return recomputeAllSkills(next);
		});
	}

	function getSkillDef(skillId: string): CoCSkillDefinition | undefined {
		return data.skills.find((s) => s.id === skillId);
	}

	function appendSkillFromDraft(
		draft: CoCCharacterData,
		def: CoCSkillDefinition,
		customName: string | null
	): CoCCharacterData {
		const exists = draft.skills.some(
			(s) => s.skillId === def.id && (s.customName ?? null) === (customName ?? null)
		);
		if (exists) return draft;
		const base = resolveSkillBaseValue(def, draft.characteristics.values);
		const row = createSkillAllocation(def.id, base, [], false, customName ?? undefined);
		return { ...draft, skills: [...draft.skills, row] };
	}

	function pickSkillToAdd(def: CoCSkillDefinition) {
		skillCustomizeForAdd = null;
		skillCustomizeNameInput = '';
		if (!editChar) return;
		if (def.isCustomizable) {
			// Customizable defs can have multiple rows distinguished by customName,
			// so re-picking the same def opens the label form again instead of bailing.
			skillCustomizeForAdd = def;
			skillCustomizeNameInput = '';
			return;
		}
		if (editChar.skills.some((s) => s.skillId === def.id)) return;
		mutateEditChar((c) => appendSkillFromDraft(c, def, null));
		skillSearchQuery = '';
	}

	function confirmCustomSkillAdd() {
		const def = skillCustomizeForAdd;
		if (!def || !editChar || !skillCustomizeNameInput.trim()) return;
		const name = skillCustomizeNameInput.trim();
		const duplicate = editChar.skills.some(
			(s) =>
				s.skillId === def.id &&
				(s.customName ?? '').trim().toLowerCase() === name.toLowerCase()
		);
		if (duplicate) return;
		mutateEditChar((c) => appendSkillFromDraft(c, def, name));
		skillCustomizeForAdd = null;
		skillCustomizeNameInput = '';
		skillSearchQuery = '';
	}

	function cancelCustomSkillAdd() {
		skillCustomizeForAdd = null;
		skillCustomizeNameInput = '';
	}

	function upsertAllocation(
		allocations: SkillPointAllocation[],
		source: SkillPointAllocation['source'],
		sourceLabel: string,
		delta: number
	): SkillPointAllocation[] {
		if (delta === 0) return allocations;
		const next = allocations.map((a) => ({ ...a }));
		const idx = next.findIndex((a) => a.source === source);
		if (idx === -1) {
			if (delta <= 0) return allocations;
			next.push({ source, sourceLabel, points: delta });
			return next;
		}
		next[idx].points = clampInt(next[idx].points + delta, 0, 99);
		return next.filter((a) => a.points > 0);
	}

	function reduceAllocations(allocations: SkillPointAllocation[], delta: number): SkillPointAllocation[] {
		let remaining = delta;
		const order: SkillPointAllocation['source'][] = ['experience', 'personal-interest', 'occupation'];
		const next = allocations.map((a) => ({ ...a }));
		for (const source of order) {
			if (remaining <= 0) break;
			const idx = next.findIndex((a) => a.source === source);
			if (idx === -1) continue;
			const take = Math.min(remaining, next[idx].points);
			next[idx].points -= take;
			remaining -= take;
		}
		return next.filter((a) => a.points > 0);
	}

	function normalizeSkillCustomName(s: string | null | undefined): string {
		return (s ?? '').trim().toLowerCase();
	}

	function skillRowsMatch(a: CoCSkillAllocation, b: CoCSkillAllocation): boolean {
		return (
			a.skillId === b.skillId && normalizeSkillCustomName(a.customName) === normalizeSkillCustomName(b.customName)
		);
	}

	function findSkillRowIndex(draft: CoCCharacterData, row: CoCSkillAllocation): number {
		return draft.skills.findIndex((s) => skillRowsMatch(s, row));
	}

	function removeSkillRow(draft: CoCCharacterData, row: CoCSkillAllocation): CoCCharacterData {
		const idx = findSkillRowIndex(draft, row);
		if (idx === -1) return draft;
		return { ...draft, skills: draft.skills.filter((_, i) => i !== idx) };
	}

	function setSkillTotalForRow(draft: CoCCharacterData, row: CoCSkillAllocation, desiredTotal: number): CoCCharacterData {
		const idx = findSkillRowIndex(draft, row);
		if (idx === -1) return draft;
		const skill = draft.skills[idx];
		const skillId = skill.skillId;
		const def = getSkillDef(skillId);
		const baseValue = def ? resolveSkillBaseValue(def, draft.characteristics.values) : skill.baseValue;
		const targetTotal = clampInt(desiredTotal, 0, 99);
		const desiredAllocated = clampInt(targetTotal - baseValue, 0, 99);
		const currentAllocated = skill.allocations.reduce((sum, a) => sum + a.points, 0);
		let allocations = skill.allocations;

		if (desiredAllocated > currentAllocated) {
			allocations = upsertAllocation(
				allocations,
				'experience',
				allocations.find((a) => a.source === 'experience')?.sourceLabel ?? 'Experience',
				desiredAllocated - currentAllocated
			);
		} else if (desiredAllocated < currentAllocated) {
			allocations = reduceAllocations(allocations, currentAllocated - desiredAllocated);
		}

		const { total, half, fifth } = computeSkillValues(baseValue, allocations);
		const nextSkill: CoCSkillAllocation = {
			...skill,
			baseValue,
			allocations,
			total: clampInt(total, 0, 99),
			half: clampInt(half, 0, 99),
			fifth: clampInt(fifth, 0, 99)
		};

		const nextSkills = draft.skills.slice();
		nextSkills[idx] = nextSkill;
		return { ...draft, skills: nextSkills };
	}

	function recomputeAllSkills(next: CoCCharacterData): CoCCharacterData {
		const updatedSkills = next.skills.map((skill) => {
			const def = getSkillDef(skill.skillId);
			const baseValue = def ? resolveSkillBaseValue(def, next.characteristics.values) : skill.baseValue;
			const { total, half, fifth } = computeSkillValues(baseValue, skill.allocations);
			return {
				...skill,
				baseValue,
				total: clampInt(total, 0, 99),
				half: clampInt(half, 0, 99),
				fifth: clampInt(fifth, 0, 99)
			};
		});
		return { ...next, skills: updatedSkills };
	}

	async function saveEdits() {
		if (!editChar || editSaving) return;
		editSaving = true;
		editError = null;
		try {
			let next = editChar;
			next = { ...next, schemaVersion: CHARACTER_SCHEMA_VERSION };
			next = recomputeAllSkills(next);
			next = recomputeDerived(next);

			const diceLimitMsg = describeWeaponDiceLimitViolations(next);
			if (diceLimitMsg) {
				editError = diceLimitMsg;
				return;
			}

			const saved = await persistCharacter(next);
			if (!saved.ok) {
				editError = saved.message;
				return;
			}

			// Full reload so server-rendered `data` stays authoritative.
			location.reload();
		} catch (e) {
			editError = e instanceof Error ? e.message : 'Save failed';
		} finally {
			editSaving = false;
		}
	}

	function buildCharacterPayload(): CoCCharacterData {
		return {
			...char,
			schemaVersion: CHARACTER_SCHEMA_VERSION,
			derivedStats: {
				...char.derivedStats,
				hp: { ...char.derivedStats.hp, current: currentHP },
				mp: { ...char.derivedStats.mp, current: currentMP },
				sanity: { ...char.derivedStats.sanity, current: currentSanity },
				luck: { ...char.derivedStats.luck, current: currentLuck }
			},
			playRollHistory
		};
	}

	async function persistInvestigator(): Promise<boolean> {
		const res = await fetch(`/api/investigators/${data.investigator.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ character: buildCharacterPayload() })
		});
		if (res.ok) {
			isDirty = false;
			return true;
		}
		return false;
	}

	async function savePlayState() {
		await persistInvestigator();
	}

	function adjust(stat: 'hp' | 'mp' | 'sanity' | 'luck', delta: number) {
		if (stat === 'hp') currentHP = Math.max(0, Math.min(char.derivedStats.hp.max, currentHP + delta));
		if (stat === 'mp') currentMP = Math.max(0, Math.min(char.derivedStats.mp.max, currentMP + delta));
		if (stat === 'sanity') currentSanity = Math.max(0, Math.min(char.derivedStats.sanity.max, currentSanity + delta));
		if (stat === 'luck') currentLuck = Math.max(0, Math.min(99, currentLuck + delta));
		isDirty = true;
	}

	function skillDisplayName(skillId: string): string {
		return resolveSkillDisplayName(skillId, char.customSkillDefs ?? [], data.skills);
	}

	function skillRowLabel(skill: CoCSkillAllocation): string {
		const base = skillDisplayName(skill.skillId);
		return skill.customName?.trim() ? `${base} (${skill.customName})` : base;
	}

	function outcomeDescription(result: CoCPercentileCheckResult): string {
		if (result.isFumble) return 'Fumble';
		switch (result.outcome) {
			case 'critical':
				return 'Critical success';
			case 'extreme':
				return 'Extreme success';
			case 'hard':
				return 'Hard success';
			case 'regular':
				return 'Regular success';
			case 'failure':
				return 'Failure';
		}
	}

	async function rollCharacteristic(statId: CharacteristicId) {
		if (diceRolling) return;
		const target = char.characteristics.values[statId];
		const half = halfValue(target);
		const fifth = fifthValue(target);
		const rawRoll = rollDie(100);
		const labelShort = CHARACTERISTIC_LABELS[statId];
		diceRolling = true;
		try {
			await showDiceRoll(
				makeDiceRollRequest([{ count: 1, sides: 100, results: [rawRoll] }], {
					label: labelShort,
					reveal: 'after-settle'
				})
			);
			const checked = evaluateCoC7ePercentileCheck({
				rawRoll,
				target,
				half,
				fifth
			});
			const entry: PlayRollHistoryEntry = {
				id: crypto.randomUUID(),
				at: new Date().toISOString(),
				targetKind: 'characteristic',
				characteristicId: statId,
				target,
				half,
				fifth,
				rawRoll,
				effectiveRoll: checked.effectiveRoll,
				outcome: checked.outcome,
				isFumble: checked.isFumble
			};
			playRollHistory = [entry, ...playRollHistory].slice(0, PLAY_ROLL_HISTORY_KEEP);
			showTransientRollBanner({
				title: `${labelShort}: ${outcomeDescription(checked)}`,
				detail: `Rolled ${rawRoll}`
			});
			await persistInvestigator();
		} finally {
			diceRolling = false;
		}
	}

	async function rollSkill(skill: CoCSkillAllocation) {
		if (diceRolling) return;
		const target = skill.total;
		const half = skill.half;
		const fifth = skill.fifth;
		const rawRoll = rollDie(100);
		const labelShort = skillRowLabel(skill);
		diceRolling = true;
		try {
			await showDiceRoll(
				makeDiceRollRequest([{ count: 1, sides: 100, results: [rawRoll] }], {
					label: labelShort,
					reveal: 'after-settle'
				})
			);
			const checked = evaluateCoC7ePercentileCheck({
				rawRoll,
				target,
				half,
				fifth
			});
			const entry: PlayRollHistoryEntry = {
				id: crypto.randomUUID(),
				at: new Date().toISOString(),
				targetKind: 'skill',
				skillId: skill.skillId,
				skillDisplayLabel: labelShort,
				target,
				half,
				fifth,
				rawRoll,
				effectiveRoll: checked.effectiveRoll,
				outcome: checked.outcome,
				isFumble: checked.isFumble
			};
			playRollHistory = [entry, ...playRollHistory].slice(0, PLAY_ROLL_HISTORY_KEEP);
			showTransientRollBanner({
				title: `${labelShort}: ${outcomeDescription(checked)}`,
				detail: `Rolled ${rawRoll}`
			});
			await persistInvestigator();
		} finally {
			diceRolling = false;
		}
	}

	async function rollWeaponDamageSegment(
		weapon: CharacterWeapon,
		segment: string,
		segmentLabel: string | null
	) {
		if (diceRolling) return;
		const plan = planWeaponDamageRoll(segment.trim(), char.derivedStats.damageBonus);
		if (!plan.ok) {
			showTransientRollBanner({ title: `${weapon.name} — damage`, detail: plan.reason });
			return;
		}

		const labelPieces = segmentLabel?.trim()
			? `${weapon.name} (${segmentLabel})`
			: weapon.name;

		diceRolling = true;
		try {
			await showDiceRoll(plan.request);

			const entry: PlayRollHistoryEntry = {
				id: crypto.randomUUID(),
				at: new Date().toISOString(),
				targetKind: 'weaponDamage',
				weaponName: weapon.name,
				formula: segment.trim(),
				segmentLabel: segmentLabel?.trim() || null,
				total: plan.total,
				detail: plan.breakdownText
			};
			playRollHistory = [entry, ...playRollHistory].slice(0, PLAY_ROLL_HISTORY_KEEP);
			showTransientRollBanner({
				title: `${labelPieces}: ${plan.total}`,
				detail: plan.breakdownText
			});
			await persistInvestigator();
		} finally {
			diceRolling = false;
		}
	}

	function formatLogTime(iso: string): string {
		try {
			const d = new Date(iso);
			return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
		} catch {
			return iso;
		}
	}

	function logEntryTitle(entry: PlayRollHistoryEntry): string {
		if (entry.targetKind === 'weaponDamage') {
			const seg = entry.segmentLabel?.trim();
			return seg ? `${entry.weaponName} (${seg})` : entry.weaponName;
		}
		if (entry.targetKind === 'characteristic' && entry.characteristicId) {
			return CHARACTERISTIC_LABELS[entry.characteristicId];
		}
		return entry.skillDisplayLabel ?? entry.skillId ?? 'Skill';
	}

	const equipWeaponPickerMatches = $derived.by(() => {
		if (!editChar) return [] as WeaponDefinition[];
		const q = equipWeaponSearchQuery.trim().toLowerCase();
		return data.equipment.weapons
			.filter((w) => w.name.toLowerCase().includes(q))
			.sort((a, b) => a.name.localeCompare(b.name))
			.slice(0, SHEET_ADD_WEAPON_MATCH_LIMIT);
	});

	const commonEquipItemsForEra = $derived.by(() => {
		if (!editChar) return [] as string[];
		return (
			data.equipment.commonItems[editChar.era] ??
			data.equipment.commonItems['1920s'] ??
			[]
		);
	});

	function appendWeaponToEditChar(w: CharacterWeapon) {
		mutateEditChar((c) => ({
			...c,
			equipment: { ...c.equipment, weapons: [...c.equipment.weapons, w] }
		}));
	}

	function addWeaponFromCatalog(def: WeaponDefinition) {
		appendWeaponToEditChar({
			name: def.name,
			damage: def.damage,
			range: def.range,
			attacksPerRound: def.attacksPerRound,
			ammo: def.ammo ?? null,
			malfunction: def.malfunction ?? null
		});
		equipWeaponSearchQuery = '';
	}

	function addCustomWeaponRow() {
		appendWeaponToEditChar({
			name: '',
			damage: '',
			range: '',
			attacksPerRound: '',
			ammo: null,
			malfunction: null
		});
	}

	function removeWeaponAt(index: number) {
		mutateEditChar((c) => ({
			...c,
			equipment: {
				...c.equipment,
				weapons: c.equipment.weapons.filter((_, i) => i !== index)
			}
		}));
	}

	function updateWeaponAt(index: number, patch: Partial<CharacterWeapon>) {
		mutateEditChar((c) => {
			const weapons = c.equipment.weapons.map((w, i) => (i === index ? { ...w, ...patch } : w));
			return { ...c, equipment: { ...c.equipment, weapons } };
		});
	}

	function addEquipmentItemDraft() {
		const name = equipItemDraftName.trim();
		if (!name || !editChar) return;
		const row: EquipmentItem = { name, quantity: 1, notes: '' };
		mutateEditChar((c) => ({
			...c,
			equipment: { ...c.equipment, items: [...c.equipment.items, row] }
		}));
		equipItemDraftName = '';
	}

	function removeItemAt(index: number) {
		mutateEditChar((c) => ({
			...c,
			equipment: {
				...c.equipment,
				items: c.equipment.items.filter((_, i) => i !== index)
			}
		}));
	}

	function updateItemAt(index: number, patch: Partial<EquipmentItem>) {
		mutateEditChar((c) => {
			const items = c.equipment.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
			return { ...c, equipment: { ...c.equipment, items } };
		});
	}

	function addAssetDraft() {
		const name = assetDraft.name.trim();
		if (!name || !editChar) return;
		const row: AssetItem = {
			name,
			value: Math.max(0, assetDraft.value || 0),
			type: assetDraft.type.trim(),
			description: assetDraft.description?.trim() || undefined
		};
		mutateEditChar((c) => ({
			...c,
			equipment: { ...c.equipment, assetsList: [...(c.equipment.assetsList ?? []), row] }
		}));
		assetDraft = { name: '', value: 0, type: '', description: '' };
	}

	function removeAssetAt(index: number) {
		mutateEditChar((c) => ({
			...c,
			equipment: {
				...c.equipment,
				assetsList: (c.equipment.assetsList ?? []).filter((_, i) => i !== index)
			}
		}));
	}

	function updateAssetAt(index: number, patch: Partial<AssetItem>) {
		mutateEditChar((c) => {
			const assetsList = (c.equipment.assetsList ?? []).map((asset, i) => i === index ? { ...asset, ...patch } : asset);
			return { ...c, equipment: { ...c.equipment, assetsList } };
		});
	}

	function addCommonEquipmentItem(itemName: string) {
		if (!editChar) return;
		if (editChar.equipment.items.some((i) => i.name === itemName)) return;
		mutateEditChar((c) => ({
			...c,
			equipment: {
				...c.equipment,
				items: [...c.equipment.items, { name: itemName, quantity: 1, notes: '' }]
			}
		}));
	}

	const skillsAddPickerMatches = $derived.by(() => {
		if (!editChar) return [] as CoCSkillDefinition[];
		const pool = filterSkillDefsForSheetAddPicker(data.skills, editChar.era, {
			hideUncommonAndRestricted: hideUncommonAndRestrictedSkills,
			existingSkillIds: new Set(editChar.skills.map((s) => s.skillId))
		});
		return pool
			.filter((d) => skillDefMatchesSheetAddSearch(d, skillSearchQuery))
			.sort((a, b) => a.name.localeCompare(b.name))
			.slice(0, SHEET_ADD_SKILL_MATCH_LIMIT);
	});

	// Play: alphabetical by display name. Read: highest total first. Edit: stable order so rows don't jump.
	const sortedSkills = $derived.by(() => {
		if (playMode) {
			return buildPlayModeSkills(char, data.skills).sort((a, b) =>
				skillDisplayName(a.skillId).localeCompare(skillDisplayName(b.skillId))
			);
		}
		const skills = editMode && editChar ? editChar.skills : char.skills;
		const visible = skills.filter(shouldShowInvestigatorSkillOnSheet).slice();
		if (editMode && editChar) return visible;
		return visible.sort((a, b) => b.total - a.total);
	});

	function trackerWidthPct(current: number, max: number): number {
		if (!Number.isFinite(max) || max <= 0) return 0;
		return Math.max(0, Math.min(100, (current / max) * 100));
	}
</script>

<svelte:head>
	<title>{char.name || 'Investigator'} — Miskatonic University Registrar</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-6 space-y-6">
	{#if editMode}
		<div class="sticky top-0 z-30 -mx-4 border-b border-[var(--color-border)] bg-[var(--color-background)]/92 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/80">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="text-sm">
					<span class="font-semibold">Edit mode</span>
					<span class="ml-2 text-[var(--color-muted-foreground)]">
						Saving will recalculate derived stats (HP/MP/Sanity/etc) from your characteristics and clamp current values if needed.
					</span>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={cancelEdit}
						disabled={editSaving}
						class="cursor-pointer rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-accent)] disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={saveEdits}
						disabled={editSaving || !editChar}
						class="cursor-pointer rounded-md bg-[var(--color-primary)] px-6 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] disabled:opacity-50"
					>
						{editSaving ? 'Saving...' : 'Save changes'}
					</button>
				</div>
			</div>
			{#if editError}
				<div class="mt-3 rounded-md border border-[var(--color-destructive)] bg-[var(--color-destructive)]/10 p-3 text-sm text-[var(--color-destructive)]">
					Save failed: {editError}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Header -->
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="min-w-[16rem]">
			{#if editMode && editChar}
				<div class="space-y-3">
					<div class="grid gap-2 md:grid-cols-2">
						<div class="md:col-span-2">
							<label for="edit-name" class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Name</label>
							<input
								id="edit-name"
								type="text"
								value={editChar.name}
								oninput={(e) => {
									const v = (e.currentTarget as HTMLInputElement).value;
									mutateEditChar((c) => ({ ...c, name: v }));
								}}
								class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="edit-age" class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Age</label>
							<input
								id="edit-age"
								type="number"
								use:preventNumberWheel
								min="15"
								max="89"
								value={editChar.age}
								oninput={(e) => {
									const v = parseInt((e.currentTarget as HTMLInputElement).value) || 0;
									mutateEditChar((c) => ({ ...c, age: clampInt(v, 15, 89) }));
								}}
								class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="edit-era" class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Era</label>
							<select
								id="edit-era"
								value={editChar.era}
								onchange={(e) => {
									const v = (e.currentTarget as HTMLSelectElement).value;
									mutateEditChar((c) => ({ ...c, era: v as typeof c.era }));
								}}
								class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
							>
								{#each data.contentPack.eras as eraOption (eraOption.id)}
									<option value={eraOption.id}>{eraOption.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="edit-gender" class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Gender</label>
							<input
								id="edit-gender"
								type="text"
								value={editChar.gender}
								oninput={(e) => {
									const v = (e.currentTarget as HTMLInputElement).value;
									mutateEditChar((c) => ({ ...c, gender: v }));
								}}
								class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="edit-pronouns" class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Pronouns</label>
							<input
								id="edit-pronouns"
								type="text"
								value={editChar.pronouns}
								oninput={(e) => {
									const v = (e.currentTarget as HTMLInputElement).value;
									mutateEditChar((c) => ({ ...c, pronouns: v }));
								}}
								class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="edit-residence" class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Residence</label>
							<input
								id="edit-residence"
								type="text"
								value={editChar.residence}
								oninput={(e) => {
									const v = (e.currentTarget as HTMLInputElement).value;
									mutateEditChar((c) => ({ ...c, residence: v }));
								}}
								class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="edit-birthplace" class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Birthplace</label>
							<input
								id="edit-birthplace"
								type="text"
								value={editChar.birthplace}
								oninput={(e) => {
									const v = (e.currentTarget as HTMLInputElement).value;
									mutateEditChar((c) => ({ ...c, birthplace: v }));
								}}
								class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
							/>
						</div>
						<div class="md:col-span-2">
							<label for="edit-portrait-url" class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Portrait URL</label>
							<input
								id="edit-portrait-url"
								type="url"
								value={editChar.portraitUrl}
								oninput={(e) => {
									const v = (e.currentTarget as HTMLInputElement).value;
									mutateEditChar((c) => ({ ...c, portraitUrl: v }));
								}}
								class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
							/>
						</div>
					</div>
				</div>
			{:else}
				<h1 class="text-3xl font-bold" data-heading>{char.name || 'Unnamed Investigator'}</h1>
				<p class="text-sm text-[var(--color-muted-foreground)]">
					{occupation?.name ?? 'No occupation'} &middot; Age {char.age} &middot; {char.era}
				</p>
				{#if char.residence}
					<p class="text-xs text-[var(--color-muted-foreground)]">Residence: {char.residence}</p>
				{/if}
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			{#if !editMode}
				<!-- Export buttons -->
				<div class="flex gap-1">
					<a
						href="/api/export/{data.investigator.id}?format=json"
						download
						class="cursor-pointer rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs hover:bg-[var(--color-accent)]"
					>
						JSON
					</a>
					<a
						href="/api/export/{data.investigator.id}?format=md"
						download
						class="cursor-pointer rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs hover:bg-[var(--color-accent)]"
					>
						Markdown
					</a>
					<PDFExportButton
						character={char}
						occupationName={occupation?.name ?? 'Unknown'}
						skills={data.skills}
						occupations={data.occupations}
						contentPack={data.contentPack}
					/>
				</div>
				<button
					type="button"
					onclick={startEdit}
					class="cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-accent)]"
				>
					Edit
				</button>
				<button
					type="button"
					onclick={() => (playMode = !playMode)}
					class="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors
						{playMode
							? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
							: 'border-[var(--color-border)] hover:bg-[var(--color-accent)]'}"
				>
					{playMode ? 'Exit Play Mode' : 'Play Mode'}
				</button>
				<ShareDialog
					investigatorId={data.investigator.id}
					isDraft={char.isDraft}
					initialShareId={data.investigator.isPublic ? data.investigator.shareId : null}
				/>
				<a
					href="/investigators"
					class="cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-accent)]"
				>
					Back
				</a>
			{/if}
		</div>
	</div>

	<!-- In-Play Tracking -->
	{#if playMode}
		<section aria-labelledby="in-play-heading" class="rounded-md border-2 border-[var(--color-primary)] bg-[var(--color-card)] p-4 space-y-4">
			<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h2 id="in-play-heading" class="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">In-Play Tracking</h2>
				{#if isDirty}
					<button
						type="button"
						onclick={savePlayState}
						class="rounded bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary-foreground)]"
					>
						Save
					</button>
				{/if}
			</div>

			<div class="min-h-16">
				{#if diceRolling}
					<div class="border-b border-[var(--color-border)] pb-3 text-xs text-[var(--color-muted-foreground)]">
						Rolling…
					</div>
				{:else if lastRollBanner}
					<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-accent)]/30 px-3 py-2 text-sm">
						<p class="font-semibold">{lastRollBanner.title}</p>
						<p class="text-xs text-[var(--color-muted-foreground)]">{lastRollBanner.detail}</p>
					</div>
				{/if}
			</div>

			<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{#each [
					{ label: 'HP', stat: 'hp' as const, current: currentHP, max: char.derivedStats.hp.max, color: 'var(--color-destructive)' },
					{ label: 'MP', stat: 'mp' as const, current: currentMP, max: char.derivedStats.mp.max, color: 'var(--color-primary)' },
					{ label: 'Sanity', stat: 'sanity' as const, current: currentSanity, max: char.derivedStats.sanity.max, color: 'var(--color-warning)' },
					{ label: 'Luck', stat: 'luck' as const, current: currentLuck, max: char.derivedStats.luck.max, color: 'var(--color-foreground)' }
				] as tracker}
					<div class="text-center">
						<span class="text-xs uppercase text-[var(--color-muted-foreground)]">{tracker.label}</span>
						<div class="flex items-center justify-center gap-2">
							<button
								type="button"
								onclick={() => adjust(tracker.stat, -1)}
								class="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-lg font-bold hover:bg-[var(--color-accent)]"
							>−</button>
							<span class="min-w-[3rem] text-center text-2xl font-bold">{tracker.current}</span>
							<button
								type="button"
								onclick={() => adjust(tracker.stat, 1)}
								class="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-lg font-bold hover:bg-[var(--color-accent)]"
							>+</button>
						</div>
						<span class="text-xs text-[var(--color-muted-foreground)]">/ {tracker.max}</span>
						<!-- Progress bar -->
						<div class="mx-auto mt-1 h-1.5 w-full max-w-[80px] rounded-full bg-[var(--color-muted)]">
							<div
								class="h-1.5 rounded-full transition-all"
								style="width: {trackerWidthPct(tracker.current, tracker.max)}%; background-color: {tracker.color}"
							></div>
						</div>
					</div>
				{/each}
			</div>

			<div class="border-t border-[var(--color-border)] pt-3">
				<h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Roll log</h3>
				{#if playRollHistory.length === 0}
					<p class="text-xs text-[var(--color-muted-foreground)]">
						No rolls yet. Tap a characteristic, skill, or weapon damage control below.
					</p>
				{:else}
					<ul class="max-h-48 space-y-2 overflow-y-auto text-xs">
						{#each playRollHistory as entry}
							<li class="rounded border border-[var(--color-border)]/50 bg-[var(--color-background)]/50 px-2 py-1.5">
								<div class="flex flex-wrap justify-between gap-1">
									<span class="font-medium">{logEntryTitle(entry)}</span>
									<span class="tabular-nums text-[var(--color-muted-foreground)]">{formatLogTime(entry.at)}</span>
								</div>
								{#if entry.targetKind === 'weaponDamage'}
									<div class="mt-0.5 font-mono tabular-nums text-[var(--color-muted-foreground)]">
										<span class="text-[var(--color-foreground)]">{entry.formula}</span>
										<span class="mx-1">→</span>
										<span class="font-bold text-[var(--color-foreground)]">{entry.total}</span>
									</div>
									<div class="mt-0.5 text-[var(--color-muted-foreground)]">{entry.detail}</div>
								{:else}
									<div class="mt-0.5 flex flex-wrap gap-x-2 text-[var(--color-muted-foreground)]">
										<span>Target {entry.target}% (½ {entry.half} / ⅕ {entry.fifth})</span>
									</div>
									<div class="mt-0.5">
										<span class="font-mono tabular-nums">{entry.rawRoll}</span>
										{#if entry.effectiveRoll !== entry.rawRoll}
											<span class="text-[var(--color-muted-foreground)]"> → effective {entry.effectiveRoll}</span>
										{/if}
										<span class="ml-2 font-medium">
											{outcomeDescription({
												effectiveRoll: entry.effectiveRoll,
												outcome: entry.outcome,
												isFumble: entry.isFumble
											})}
										</span>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	{/if}

	<!--
		Default (non-edit, non-play) display delegates to the shared <SheetReadOnly />
		component so the owner's read view and the public /s/[shareId] view render
		from a single source of truth. Edit/play modes keep their inline branches.
	-->
	{#if !editMode && !playMode}
		<SheetReadOnly character={char} skills={data.skills} occupations={data.occupations} />
	{/if}

	<!-- Characteristics & Derived (edit/play modes) -->
	{#if (editMode && editChar) || playMode}
		<div class="grid gap-6 lg:grid-cols-2">
			<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
				<h2 class="mb-3 font-semibold" data-heading>Characteristics</h2>
				<div class="grid grid-cols-4 gap-2 text-center text-sm">
					{#each ALL_CHARACTERISTICS as statId}
						{@const v = (editMode && editChar ? editChar.characteristics.values[statId] : char.characteristics.values[statId])}
						{#if editMode && editChar}
							<div class="rounded-md border border-[var(--color-border)]/50 p-2">
								<span class="block text-xs uppercase text-[var(--color-muted-foreground)]">{statId}</span>
								<div class="mt-1 flex items-center justify-center gap-1">
									<button
										type="button"
										onclick={() => updateCharacteristic(statId, v - 1)}
										aria-label="Decrease {CHARACTERISTIC_LABELS[statId]}"
										class="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] text-base font-bold hover:bg-[var(--color-accent)]"
									>
										−
									</button>
									<input
										type="number"
										use:preventNumberWheel
										min="0"
										max="99"
										value={v}
										aria-label="{CHARACTERISTIC_LABELS[statId]} value"
										oninput={(e) =>
											updateCharacteristic(
												statId,
												parseInt((e.currentTarget as HTMLInputElement).value) || 0
											)}
										class="no-spinner w-16 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-1.5 py-0.5 text-center text-sm"
									/>
									<button
										type="button"
										onclick={() => updateCharacteristic(statId, v + 1)}
										aria-label="Increase {CHARACTERISTIC_LABELS[statId]}"
										class="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] text-base font-bold hover:bg-[var(--color-accent)]"
									>
										+
									</button>
								</div>
								<span class="mt-1 block text-xs text-[var(--color-muted-foreground)]">{halfValue(v)} / {fifthValue(v)}</span>
							</div>
						{:else if playMode}
							<button
								type="button"
								class="rounded-md border border-[var(--color-border)]/50 p-2 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-accent)] disabled:opacity-50"
								disabled={diceRolling}
								onclick={() => rollCharacteristic(statId)}
								aria-label="Roll {CHARACTERISTIC_LABELS[statId]} check"
							>
								<span class="block text-xs uppercase text-[var(--color-muted-foreground)]">{statId}</span>
								<span class="block text-xl font-bold">{v}</span>
								<span class="block text-xs text-[var(--color-muted-foreground)]">{halfValue(v)} / {fifthValue(v)}</span>
							</button>
						{/if}
					{/each}
				</div>
			</div>

			<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
				<h2 class="mb-3 font-semibold" data-heading>Derived Attributes</h2>
				<div class="grid grid-cols-2 gap-2 text-sm">
					{#each [
						['Hit Points', `${char.derivedStats.hp.current}/${char.derivedStats.hp.max}`],
						['Magic Points', `${char.derivedStats.mp.current}/${char.derivedStats.mp.max}`],
						['Sanity', `${char.derivedStats.sanity.current}/${char.derivedStats.sanity.max}`],
						['Luck', `${char.derivedStats.luck.current}`],
						['Damage Bonus', char.derivedStats.damageBonus],
						['Build', String(char.derivedStats.build)],
						['Move Rate', String(char.derivedStats.moveRate)]
					] as [label, value]}
						<div class="flex justify-between border-b border-[var(--color-border)]/30 pb-1">
							<span class="text-[var(--color-muted-foreground)]">{label}</span>
							<span class="font-bold">{value}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Skills (edit/play modes; default rendered by SheetReadOnly) -->
	{#if (editMode && editChar) || playMode}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Skills</h2>
			{#if editMode && editChar}
				<div class="mb-4 space-y-3 rounded-md border border-[var(--color-border)]/50 bg-[var(--color-background)]/40 p-3">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div class="min-w-0 grow">
							<label
								for="add-skill-search"
								class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]"
							>Add skill</label>
							<input
								id="add-skill-search"
								type="search"
								value={skillSearchQuery}
								oninput={(e) => {
									skillSearchQuery = (e.currentTarget as HTMLInputElement).value;
								}}
								placeholder="Search by name…"
								autocomplete="off"
								class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
							/>
						</div>
						<label class="flex shrink-0 cursor-pointer items-start gap-2 text-sm leading-snug">
							<input
								type="checkbox"
								checked={hideUncommonAndRestrictedSkills}
								onchange={(e) => {
									hideUncommonAndRestrictedSkills = (e.currentTarget as HTMLInputElement).checked;
								}}
								class="mt-0.5 rounded border-[var(--color-border)]"
							/>
							<span>
								Hide uncommon &amp; restricted skills<br />
								<span class="text-xs text-[var(--color-muted-foreground)]">
									Uncheck to include entries like Demolitions and Cthulhu Mythos.
								</span>
							</span>
						</label>
					</div>
					{#if skillCustomizeForAdd}
						<div
							class="flex flex-col gap-3 rounded-md border border-[var(--color-primary)]/30 bg-[var(--color-accent)]/20 p-3 sm:flex-row sm:items-end"
						>
							<div class="min-w-0 grow">
								<label
									for="add-skill-custom-name"
									class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]"
								>
									Specialization label ({skillCustomizeForAdd.name})
								</label>
								<input
									id="add-skill-custom-name"
									type="text"
									value={skillCustomizeNameInput}
									oninput={(e) => {
										skillCustomizeNameInput = (e.currentTarget as HTMLInputElement).value;
									}}
									placeholder="e.g. Forgery, Violin…"
									class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
								/>
							</div>
							<div class="flex shrink-0 flex-wrap gap-2">
								<button
									type="button"
									onclick={confirmCustomSkillAdd}
									disabled={!skillCustomizeNameInput.trim()}
									class="cursor-pointer rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
								>
									Add skill
								</button>
								<button
									type="button"
									onclick={cancelCustomSkillAdd}
									class="cursor-pointer rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-accent)]"
								>
									Cancel
								</button>
							</div>
						</div>
					{/if}
					{#if skillsAddPickerMatches.length > 0}
						<ul class="max-h-48 space-y-1 overflow-y-auto text-sm" aria-label="Matching skills">
							{#each skillsAddPickerMatches as def (def.id)}
								{@const pickerBase = resolveSkillBaseValue(def, editChar.characteristics.values)}
								<li>
									<button
										type="button"
										onclick={() => pickSkillToAdd(def)}
										class="w-full cursor-pointer rounded-md border border-transparent px-2 py-1.5 text-left hover:border-[var(--color-border)] hover:bg-[var(--color-accent)]"
									>
										<span class="font-medium">{def.name}</span>
										<span class="ml-2 text-xs text-[var(--color-muted-foreground)]">
											({pickerBase}% base)
											{#if def.derivedBase}&nbsp;(from characteristics){/if}
										</span>
									</button>
								</li>
							{/each}
						</ul>
					{:else if skillSearchQuery.trim()}
						<p class="text-xs text-[var(--color-muted-foreground)]">
							No matching skills. Try different words or uncheck the filter above.
						</p>
					{/if}
				</div>
			{/if}
			<div class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
				{#each sortedSkills as skill}
					{#if editMode && editChar}
						<div class="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)]/40 px-2 py-1">
							<span class="text-sm">
								{skillDisplayName(skill.skillId)}
								{#if skill.customName?.trim()}
									<span class="text-[var(--color-muted-foreground)]"> ({skill.customName})</span>
								{/if}
								{#if skill.isOccupation}
									<span class="text-[10px] text-[var(--color-primary)]">&#x2022;</span>
								{/if}
							</span>
							<div class="flex shrink-0 items-center gap-1">
								<button
									type="button"
									onclick={() => mutateEditChar((c) => setSkillTotalForRow(c, skill, skill.total - 1))}
									aria-label="Decrease {skillDisplayName(skill.skillId)}"
									class="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] text-base font-bold hover:bg-[var(--color-accent)]"
								>
									−
								</button>
								<input
									type="number"
									use:preventNumberWheel
									min="0"
									max="99"
									value={skill.total}
									aria-label="{skillDisplayName(skill.skillId)} total"
									oninput={(e) => {
										const v = parseInt((e.currentTarget as HTMLInputElement).value) || 0;
										mutateEditChar((c) => setSkillTotalForRow(c, skill, v));
									}}
									class="no-spinner w-16 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-1.5 py-0.5 text-center text-sm"
								/>
								<button
									type="button"
									onclick={() => mutateEditChar((c) => setSkillTotalForRow(c, skill, skill.total + 1))}
									aria-label="Increase {skillDisplayName(skill.skillId)}"
									class="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] text-base font-bold hover:bg-[var(--color-accent)]"
								>
									+
								</button>
								<button
									type="button"
									onclick={() => mutateEditChar((c) => removeSkillRow(c, skill))}
									aria-label="Remove {skillRowLabel(skill)}"
									class="ml-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide hover:bg-[var(--color-destructive)]/15"
								>
									Remove
								</button>
							</div>
						</div>
					{:else if playMode}
						<button
							type="button"
							class="flex w-full justify-between rounded-md border border-transparent px-1 py-0.5 text-left text-sm hover:border-[var(--color-border)] hover:bg-[var(--color-accent)] disabled:opacity-50"
							disabled={diceRolling}
							onclick={() => rollSkill(skill)}
							aria-label="Roll {skillRowLabel(skill)}"
						>
							<span>
								{skillDisplayName(skill.skillId)}
								{#if skill.customName?.trim()}
									<span class="text-[var(--color-muted-foreground)]"> ({skill.customName})</span>
								{/if}
								{#if skill.isOccupation}
									<span class="text-[10px] text-[var(--color-primary)]">&#x2022;</span>
								{/if}
							</span>
							<span class="shrink-0 font-bold tabular-nums">{skill.total}%
								<span class="text-xs font-normal text-[var(--color-muted-foreground)]">({skill.half}/{skill.fifth})</span>
							</span>
						</button>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	<!-- Equipment -->
	{#if editMode && editChar}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Equipment</h2>

			<p class="mb-4 text-sm text-[var(--color-muted-foreground)]">
					{editChar.equipment.livingStandard} &middot; Spending Level: ${editChar.equipment.spendingLevel.toLocaleString()} &middot; Cash: ${editChar.equipment.cash.toLocaleString()} &middot; Assets: {editChar.equipment.assetsLabel}
				</p>

				<div class="mb-6 space-y-3 rounded-md border border-[var(--color-border)]/50 bg-[var(--color-background)]/40 p-3">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div class="min-w-0 grow">
							<label
								for="add-weapon-search"
								class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]"
							>Add weapon from catalog</label>
							<input
								id="add-weapon-search"
								type="search"
								value={equipWeaponSearchQuery}
								oninput={(e) => {
									equipWeaponSearchQuery = (e.currentTarget as HTMLInputElement).value;
								}}
								placeholder="Search weapons…"
								autocomplete="off"
								class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
							/>
						</div>
						<button
							type="button"
							onclick={addCustomWeaponRow}
							class="shrink-0 cursor-pointer rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-accent)]"
						>
							Add custom weapon
						</button>
					</div>
					{#if equipWeaponPickerMatches.length > 0}
						<ul class="max-h-40 space-y-1 overflow-y-auto text-sm">
							{#each equipWeaponPickerMatches as def, wi (wi)}
								<li>
									<button
										type="button"
										onclick={() => addWeaponFromCatalog(def)}
										class="w-full rounded border border-transparent px-2 py-1.5 text-left hover:border-[var(--color-border)] hover:bg-[var(--color-accent)]"
									>
										<span class="font-medium">{def.name}</span>
										<span class="ml-2 text-xs text-[var(--color-muted-foreground)]">{def.damage}</span>
									</button>
								</li>
							{/each}
						</ul>
					{:else if equipWeaponSearchQuery.trim()}
						<p class="text-xs text-[var(--color-muted-foreground)]">No matching weapons.</p>
					{/if}
				</div>

				{#if editChar.equipment.weapons.length > 0}
					<div class="mb-6 overflow-x-auto">
						<table class="w-full min-w-[40rem] text-sm">
							<thead>
								<tr class="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted-foreground)]">
									<th class="pb-2 pr-2">Weapon</th>
									<th class="pb-2 pr-2">Damage</th>
									<th class="pb-2 pr-2">Range</th>
									<th class="pb-2 pr-2">Attacks</th>
									<th class="pb-2 w-20"></th>
								</tr>
							</thead>
							<tbody>
								{#each editChar.equipment.weapons as w, wi (wi)}
									<tr class="border-b border-[var(--color-border)]/25 align-top">
										<td class="py-2 pr-2">
											<input
												type="text"
												value={w.name}
												oninput={(e) =>
													updateWeaponAt(wi, { name: (e.currentTarget as HTMLInputElement).value })}
												aria-label="Weapon name {wi + 1}"
												class="w-full min-w-[8rem] rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
											/>
										</td>
										<td class="py-2 pr-2">
											<input
												type="text"
												value={w.damage}
												oninput={(e) =>
													updateWeaponAt(wi, { damage: (e.currentTarget as HTMLInputElement).value })}
												aria-label="Weapon damage {wi + 1}"
												class="w-full min-w-[6rem] rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
											/>
										</td>
										<td class="py-2 pr-2">
											<input
												type="text"
												value={w.range}
												oninput={(e) =>
													updateWeaponAt(wi, { range: (e.currentTarget as HTMLInputElement).value })}
												aria-label="Weapon range {wi + 1}"
												class="w-full min-w-[6rem] rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
											/>
										</td>
										<td class="py-2 pr-2">
											<input
												type="text"
												value={w.attacksPerRound}
												oninput={(e) =>
													updateWeaponAt(wi, {
														attacksPerRound: (e.currentTarget as HTMLInputElement).value
													})}
												aria-label="Weapon attacks per round {wi + 1}"
												class="w-full min-w-[4rem] rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
											/>
										</td>
										<td class="py-2">
											<button
												type="button"
												onclick={() => removeWeaponAt(wi)}
												class="cursor-pointer whitespace-nowrap rounded border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold uppercase hover:bg-[var(--color-destructive)]/15"
											>
												Remove
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				<h3 class="mb-2 text-sm font-semibold" data-heading>Other items</h3>
				<div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
					<div class="min-w-0 grow">
						<label
							for="add-equip-item"
							class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]"
						>Add item</label>
						<input
							id="add-equip-item"
							type="text"
							value={equipItemDraftName}
							oninput={(e) => {
								equipItemDraftName = (e.currentTarget as HTMLInputElement).value;
							}}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addEquipmentItemDraft();
								}
							}}
							placeholder="Item name…"
							class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
						/>
					</div>
					<button
						type="button"
						onclick={addEquipmentItemDraft}
						class="cursor-pointer rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-accent)]"
					>
						Add
					</button>
				</div>

				{#if commonEquipItemsForEra.length > 0}
					<p class="mb-1 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Quick add</p>
					<div class="mb-4 flex flex-wrap gap-2">
						{#each commonEquipItemsForEra as itemName (itemName)}
							<button
								type="button"
								onclick={() => addCommonEquipmentItem(itemName)}
								disabled={editChar.equipment.items.some((i) => i.name === itemName)}
								class="cursor-pointer rounded-full border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
							>
								{itemName}
							</button>
						{/each}
					</div>
				{/if}

				{#if editChar.equipment.items.length > 0}
					<ul class="space-y-2 text-sm">
						{#each editChar.equipment.items as item, ii (ii)}
							<li class="flex flex-wrap items-start gap-2 rounded-md border border-[var(--color-border)]/40 p-2">
								<input
									type="text"
									value={item.name}
									oninput={(e) =>
										updateItemAt(ii, { name: (e.currentTarget as HTMLInputElement).value })}
									aria-label="Item name"
									class="min-w-[10rem] grow rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
								/>
								<label class="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
									Qty
									<input
										type="number"
										use:preventNumberWheel
										min="0"
										value={item.quantity}
										oninput={(e) => {
											const v = parseInt((e.currentTarget as HTMLInputElement).value) || 0;
											updateItemAt(ii, { quantity: v });
										}}
										class="no-spinner w-16 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-1 py-0.5"
									/>
								</label>
								<input
									type="text"
									value={item.notes}
									oninput={(e) =>
										updateItemAt(ii, { notes: (e.currentTarget as HTMLInputElement).value })}
									placeholder="Notes"
									class="min-w-[8rem] grow rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
								/>
								<button
									type="button"
									onclick={() => removeItemAt(ii)}
									class="cursor-pointer rounded border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold uppercase hover:bg-[var(--color-destructive)]/15"
								>
									Remove
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				<h3 class="mb-2 mt-6 text-sm font-semibold" data-heading>Assets</h3>
				{#if (editChar.equipment.assetsList ?? []).length > 0}
					<div class="mb-3 space-y-2 text-sm">
						{#each editChar.equipment.assetsList ?? [] as asset, ai (ai)}
							<div class="grid gap-2 rounded-md border border-[var(--color-border)]/40 p-2 sm:grid-cols-[1fr_7rem_9rem_auto]">
								<input
									type="text"
									value={asset.name}
									oninput={(e) => updateAssetAt(ai, { name: (e.currentTarget as HTMLInputElement).value })}
									aria-label="Asset name"
									class="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
								/>
								<input
									type="number"
									use:preventNumberWheel
									min="0"
									value={asset.value}
									oninput={(e) => updateAssetAt(ai, { value: parseInt((e.currentTarget as HTMLInputElement).value) || 0 })}
									aria-label="Asset value"
									class="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
								/>
								<input
									type="text"
									value={asset.type}
									oninput={(e) => updateAssetAt(ai, { type: (e.currentTarget as HTMLInputElement).value })}
									aria-label="Asset type"
									class="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
								/>
								<button
									type="button"
									onclick={() => removeAssetAt(ai)}
									class="cursor-pointer rounded border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold uppercase hover:bg-[var(--color-destructive)]/15"
								>
									Remove
								</button>
								<input
									type="text"
									value={asset.description ?? ''}
									oninput={(e) => updateAssetAt(ai, { description: (e.currentTarget as HTMLInputElement).value })}
									placeholder="Description"
									class="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs sm:col-span-4"
								/>
							</div>
						{/each}
					</div>
				{/if}
				<div class="grid gap-2 rounded-md border border-[var(--color-border)]/40 p-2 sm:grid-cols-[1fr_7rem_9rem_auto]">
					<input
						type="text"
						bind:value={assetDraft.name}
						placeholder="Asset name"
						class="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
					/>
					<input
						type="number"
						use:preventNumberWheel
						min="0"
						bind:value={assetDraft.value}
						placeholder="Value"
						class="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
					/>
					<input
						type="text"
						bind:value={assetDraft.type}
						placeholder="Type"
						class="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
					/>
					<button
						type="button"
						onclick={addAssetDraft}
						class="cursor-pointer rounded border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-accent)]"
					>
						Add asset
					</button>
					<input
						type="text"
						bind:value={assetDraft.description}
						placeholder="Description"
						class="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs sm:col-span-4"
					/>
				</div>
		</div>
	{:else if playMode && (char.equipment.items.length > 0 || char.equipment.weapons.length > 0 || (char.equipment.assetsList ?? []).length > 0)}
		<!-- Play-mode equipment: weapon damage segments become roll buttons. Default render is in SheetReadOnly. -->
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Equipment</h2>

				<p class="mb-2 text-sm text-[var(--color-muted-foreground)]">
					{char.equipment.livingStandard} &middot; Spending Level: ${char.equipment.spendingLevel.toLocaleString()} &middot; Cash: ${char.equipment.cash.toLocaleString()} &middot; Assets: {char.equipment.assetsLabel}
				</p>

				{#if char.equipment.weapons.length > 0}
					<div class="mb-3 overflow-x-auto">
						<table class="w-full text-xs">
							<thead>
								<tr class="border-b border-[var(--color-border)] text-left uppercase text-[var(--color-muted-foreground)]">
									<th class="pb-1 pr-2">Weapon</th>
									<th class="pb-1 pr-2">Damage</th>
									<th class="pb-1 pr-2">Range</th>
									<th class="pb-1 pr-2">Attacks</th>
								</tr>
							</thead>
							<tbody>
								{#each char.equipment.weapons as w, wi (wi)}
									{@const dmgBands = splitDamageSegments(w.damage)}
									<tr class="border-b border-[var(--color-border)]/20 align-top">
										<td class="py-1 pr-2 font-medium">{w.name}</td>
										<td class="py-1 pr-2">
											<div class="flex flex-wrap items-center gap-1">
												{#each dmgBands as seg, bandIdx}
													{@const segLabel =
														dmgBands.length > 1 ? `Band ${bandIdx + 1} (${seg})` : null}
													{#if isWeaponDamageFormulaSupported(seg, char.derivedStats.damageBonus)}
														<button
															type="button"
															disabled={diceRolling}
															onclick={() => rollWeaponDamageSegment(w, seg, segLabel)}
															class="cursor-pointer rounded border border-[var(--color-border)] px-1.5 py-0.5 text-left font-mono text-[11px] hover:bg-[var(--color-accent)] disabled:opacity-50"
															title="Roll {seg}"
														>
															{seg}
														</button>
													{:else}
														<span
															class="font-mono text-[11px] text-[var(--color-muted-foreground)]"
															title="This damage formula cannot be rolled automatically"
														>{seg}</span>
													{/if}
												{/each}
											</div>
										</td>
										<td class="py-1 pr-2">{w.range}</td>
										<td class="py-1">{w.attacksPerRound}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				{#if char.equipment.items.length > 0}
					<p class="text-sm">{char.equipment.items.map((i) => i.name).join(', ')}</p>
				{/if}

				{#if (char.equipment.assetsList ?? []).length > 0}
					<div class="mt-3">
						<h3 class="mb-1 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Itemized Assets</h3>
						<ul class="space-y-1 text-sm">
							{#each char.equipment.assetsList ?? [] as asset}
								<li>
									<span class="font-medium">{asset.name}</span>
									<span class="text-[var(--color-muted-foreground)]">
										{asset.value.toLocaleString()}{asset.type ? ` · ${asset.type}` : ''}
										{asset.description ? ` · ${asset.description}` : ''}
									</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
		</div>
	{/if}

	<!-- Backstory -->
	{#if editMode && editChar}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Backstory</h2>
			<div class="space-y-4">
				{#each BACKSTORY_KEYS as key (key)}
					<div>
						<label
							for={`backstory-${String(key)}`}
							class="mb-1 block text-xs font-semibold uppercase text-[var(--color-muted-foreground)]"
						>
							{backstoryLabel(String(key))}
						</label>
						<textarea
							id={`backstory-${String(key)}`}
							rows="4"
							value={editChar.backstory[key]}
							oninput={(e) => {
								const v = (e.currentTarget as HTMLTextAreaElement).value;
								mutateEditChar((c) => ({
									...c,
									backstory: { ...c.backstory, [key]: v }
								}));
							}}
							class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm"
						></textarea>
					</div>
				{/each}
			</div>
		</div>
	{:else if playMode && Object.values(char.backstory).some((v) => v.trim())}
		<!-- Play-mode backstory render. Default render is in SheetReadOnly. -->
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Backstory</h2>
			<div class="space-y-3 text-sm">
				{#each Object.entries(char.backstory).filter(([, v]) => v.trim()) as [key, value]}
					<div>
						<span class="text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">
							{backstoryLabel(key)}
						</span>
						<p class="whitespace-pre-wrap">{value}</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Hide native number spinners so the custom +/- steppers are the only controls. */
	.no-spinner::-webkit-outer-spin-button,
	.no-spinner::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.no-spinner {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>
