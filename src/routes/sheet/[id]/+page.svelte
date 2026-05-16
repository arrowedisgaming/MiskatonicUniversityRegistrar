<script lang="ts">
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
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
		type PlayRollHistoryGenericDiceEntry,
		type PlayRollHistoryEntry,
		type PlayRollHistoryPercentileEntry,
		type PlayRollHistorySanLossEntry,
		type SkillDevelopmentMark,
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
	import DevelopmentPhasePanel from '$lib/components/investigator/DevelopmentPhasePanel.svelte';
	import SanToolsPanel from '$lib/components/investigator/SanToolsPanel.svelte';
	import FreeDiceRoller from '$lib/components/dice/FreeDiceRoller.svelte';
	import SkillSortControls from '$lib/components/skills/SkillSortControls.svelte';
	import { rollDie, rollSum } from '$lib/engine/dice';
	import { showDiceRoll } from '$lib/stores/dice-rolls';
	import { makeDiceRollRequest, type DiceGroup } from '$lib/dice/protocol';
	import { sortSkillsForDisplay, type SkillSortDirection, type SkillSortMode } from '$lib/engine/skill-sort';
	import { clampLuckCurrent } from '$lib/engine/luck';
	import { composeLiveCharacter } from '$lib/engine/play-state';
	import {
		crossed90ViaDevelopment,
		isMarkEligible,
		rollDevelopmentImprovement,
		skillDevelopmentKey
	} from '$lib/engine/skill-development';
	import {
		applySanLoss,
		dailyLossSoFar,
		dailySanThreshold,
		parseSanLossFormula,
		resetSanDay,
		rollSanLoss
	} from '$lib/engine/sanity';
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
	let playSkills = $state<CoCSkillAllocation[]>(
		untrack(() => structuredClone(data.investigator.character.skills))
	);

	let playRollHistory = $state<PlayRollHistoryEntry[]>(
		untrack(() => [...(data.investigator.character.playRollHistory ?? [])])
	);
	let skillDevelopmentMarks = $state<SkillDevelopmentMark[]>(
		untrack(() => [...(data.investigator.character.skillDevelopmentMarks ?? [])])
	);
	let skillDevelopmentMilestones = $state<string[]>(
		untrack(() => [...(data.investigator.character.skillDevelopmentMilestones ?? [])])
	);
	let playTracking = $state(
		untrack(() =>
			structuredClone(
				data.investigator.character.playTracking ?? {
					dailySanStart: null,
					dailySanResetAt: null,
					insanity: { temporary: false, indefinite: false, boutOfMadness: false }
				}
			)
		)
	);

	// `char` mirrors what the page loader returned; it does not see post-load
	// updates made in Play Mode. `liveChar` splices the live Play-Mode overlay
	// on top so the read-only sheet, PDF/JSON export, edit-mode source, and
	// persistence payload all see the same character shape. Merge logic lives
	// in `composeLiveCharacter` and is unit-tested in `tests/unit/engine/play-state.test.ts`.
	const liveChar = $derived(
		composeLiveCharacter(char, {
			currentHP,
			currentMP,
			currentSanity,
			currentLuck,
			playSkills,
			playRollHistory,
			skillDevelopmentMarks,
			skillDevelopmentMilestones,
			playTracking
		})
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
	// Independent of skillSearchQuery (which is the edit-mode add-skill picker
	// search). This one filters the live skill list shown in Play Mode so the
	// player can quickly find a skill to roll.
	let playSkillSearch = $state('');
	const PLAY_SORT_KEY = 'mur.skillSort.sheet.play';
	let playSkillSortMode = $state<SkillSortMode>('rating');
	let playSkillSortDirection = $state<SkillSortDirection>('desc');
	if (browser) {
		try {
			const saved = JSON.parse(localStorage.getItem(PLAY_SORT_KEY) ?? 'null') as
				| { mode?: SkillSortMode; direction?: SkillSortDirection }
				| null;
			if (saved?.mode === 'alphabetical' || saved?.mode === 'rating') playSkillSortMode = saved.mode;
			if (saved?.direction === 'asc' || saved?.direction === 'desc') playSkillSortDirection = saved.direction;
		} catch {
			// Keep defaults.
		}
	}
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
		if (lastRollClearTimer) {
			clearTimeout(lastRollClearTimer);
			lastRollClearTimer = null;
		}
	}

	function dismissRollBanner() {
		lastRollBanner = null;
		if (lastRollClearTimer) {
			clearTimeout(lastRollClearTimer);
			lastRollClearTimer = null;
		}
	}

	function cloneCharacter(source: CoCCharacterData): CoCCharacterData {
		// `liveChar` splices Svelte 5 `$state` cells (playSkills, playRollHistory,
		// etc.) into the returned object. Cloning that directly with
		// `structuredClone` fails in the browser (Proxy-wrapped reactive arrays
		// aren't cloneable cross-platform — observed empirically after v0.18.0
		// shipped). `$state.snapshot` walks the proxy tree and returns a plain,
		// cloneable value, which is what we want to seed the edit buffer with.
		return $state.snapshot(source) as CoCCharacterData;
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
		playSkillSearch = '';
		editError = null;
		// Clone from `liveChar`, not `char`. `char` is the page-load snapshot and
		// is stale relative to any Play Mode change that has been persisted in
		// memory (SAN/HP/Luck adjustments, developed skills, marks, milestones,
		// playTracking, playRollHistory). Cloning the loader snapshot here would
		// then save back the stale derived stats and discard play-mode work.
		editChar = ensureBackstoryShape(cloneCharacter(liveChar));
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
		const luckCurrent = clampLuckCurrent(next.derivedStats.luck.current);

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
				total: clampInt(total, 0, 500),
				half: clampInt(half, 0, 250),
				fifth: clampInt(fifth, 0, 100)
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
		// `liveChar` already encodes the full merge (loader snapshot + Play Mode
		// overlay + schema-version stamp). Return it directly to keep both
		// consumers (display + persistence) from drifting apart.
		return liveChar;
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
		// Persistence rejected (most commonly Zod validation — e.g. a SAN-loss
		// flat value out of schema bounds). Surface it so the user knows their
		// in-memory state will not survive a reload. `isDirty` stays true so the
		// "Save" pill reappears in the In-Play header.
		isDirty = true;
		let detail = `HTTP ${res.status}`;
		try {
			const text = await res.text();
			const parsed = readableApiError(text, res.status);
			if (parsed) detail = parsed;
		} catch {
			// keep default
		}
		showTransientRollBanner({ title: 'Save failed', detail });
		return false;
	}

	async function savePlayState() {
		await persistInvestigator();
	}

	function adjust(stat: 'hp' | 'mp' | 'sanity' | 'luck', delta: number) {
		if (stat === 'hp') currentHP = Math.max(0, Math.min(char.derivedStats.hp.max, currentHP + delta));
		if (stat === 'mp') currentMP = Math.max(0, Math.min(char.derivedStats.mp.max, currentMP + delta));
		if (stat === 'sanity') currentSanity = Math.max(0, Math.min(char.derivedStats.sanity.max, currentSanity + delta));
		if (stat === 'luck') currentLuck = clampLuckCurrent(currentLuck + delta);
		isDirty = true;
	}

	function skillDisplayName(skillId: string): string {
		return resolveSkillDisplayName(skillId, char.customSkillDefs ?? [], data.skills);
	}

	function skillRowLabel(skill: CoCSkillAllocation): string {
		const base = skillDisplayName(skill.skillId);
		return skill.customName?.trim() ? `${base} (${skill.customName})` : base;
	}

	function updatePlaySkillSort(next: { mode: SkillSortMode; direction: SkillSortDirection }) {
		playSkillSortMode = next.mode;
		playSkillSortDirection = next.direction;
		if (browser) localStorage.setItem(PLAY_SORT_KEY, JSON.stringify(next));
	}

	function markKeyFor(skillId: string, customName: string | null | undefined): string {
		return skillDevelopmentKey(skillId, customName);
	}

	function hasDevelopmentMark(skill: CoCSkillAllocation): boolean {
		const key = markKeyFor(skill.skillId, skill.customName);
		return skillDevelopmentMarks.some((mark) => markKeyFor(mark.skillId, mark.customName) === key);
	}

	function addDevelopmentMark(
		skill: CoCSkillAllocation,
		source: 'automatic' | 'manual',
		sourceRollId: string | null = null
	) {
		if (hasDevelopmentMark(skill)) return;
		skillDevelopmentMarks = [
			...skillDevelopmentMarks,
			{
				id: crypto.randomUUID(),
				skillId: skill.skillId,
				customName: skill.customName ?? null,
				skillDisplayLabel: skillRowLabel(skill),
				source,
				sourceRollId,
				at: new Date().toISOString()
			}
		];
		isDirty = true;
	}

	async function toggleDevelopmentMark(skill: CoCSkillAllocation, checked: boolean) {
		const key = markKeyFor(skill.skillId, skill.customName);
		if (checked) {
			addDevelopmentMark(skill, 'manual');
		} else {
			skillDevelopmentMarks = skillDevelopmentMarks.filter(
				(mark) => markKeyFor(mark.skillId, mark.customName) !== key
			);
			isDirty = true;
		}
		await persistInvestigator();
	}

	function appendPlayHistory(entry: PlayRollHistoryEntry) {
		playRollHistory = [entry, ...playRollHistory].slice(0, PLAY_ROLL_HISTORY_KEEP);
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
			const entry: PlayRollHistoryPercentileEntry = {
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
			appendPlayHistory(entry);
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
			const entry: PlayRollHistoryPercentileEntry = {
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
			appendPlayHistory(entry);
			if (isMarkEligible(skill.skillId, skill.customName, entry)) {
				addDevelopmentMark(skill, 'automatic', entry.id);
			}
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
			appendPlayHistory(entry);
			showTransientRollBanner({
				title: `${labelPieces}: ${plan.total}`,
				detail: plan.breakdownText
			});
			await persistInvestigator();
		} finally {
			diceRolling = false;
		}
	}

	function findPlaySkill(mark: Pick<SkillDevelopmentMark, 'skillId' | 'customName'>): CoCSkillAllocation | null {
		return (
			buildPlayModeSkills({ ...char, skills: playSkills }, data.skills).find(
				(skill) => markKeyFor(skill.skillId, skill.customName) === markKeyFor(mark.skillId, mark.customName)
			) ?? null
		);
	}

	function applyDevelopedSkillTotal(skill: CoCSkillAllocation, improvement: number, at: string) {
		const increment = Math.max(0, Math.trunc(improvement));
		if (increment === 0) return;
		const existingIndex = playSkills.findIndex(
			(row) => markKeyFor(row.skillId, row.customName) === markKeyFor(skill.skillId, skill.customName)
		);
		const baseRow = existingIndex >= 0 ? playSkills[existingIndex] : skill;
		const nextTotal = clampInt(baseRow.total + increment, 0, 500);
		const nextSkill: CoCSkillAllocation = {
			...baseRow,
			allocations: [
				...baseRow.allocations,
				{
					source: 'experience',
					sourceLabel: `Development ${at.slice(0, 10)}`,
					points: increment
				}
			],
			total: nextTotal,
			half: halfValue(nextTotal),
			fifth: fifthValue(nextTotal)
		};
		if (existingIndex >= 0) {
			playSkills = playSkills.map((row, index) => (index === existingIndex ? nextSkill : row));
		} else {
			playSkills = [...playSkills, nextSkill];
		}
	}

	async function applySanDelta(
		amount: number,
		source: string,
		options: { formula?: string | null; successAmount?: number | null; failureAmount?: number | null } = {}
	) {
		const before = currentSanity;
		const currentDailyLoss = dailyLossSoFar(playRollHistory, playTracking.dailySanResetAt);
		const result = amount >= 0
			? applySanLoss(
					{
						currentSanity,
						maxSanity: char.derivedStats.sanity.max,
						dailySanStart: playTracking.dailySanStart,
						dailyLossSoFar: currentDailyLoss
					},
					amount
				)
			: {
					sanAfter: Math.max(0, Math.min(char.derivedStats.sanity.max, currentSanity - amount)),
					triggeredTemporary: false,
					triggeredIndefinite: false
				};
		currentSanity = result.sanAfter;
		const entry: PlayRollHistorySanLossEntry = {
			id: crypto.randomUUID(),
			at: new Date().toISOString(),
			targetKind: 'sanLoss',
			source,
			formula: options.formula ?? null,
			successAmount: options.successAmount ?? null,
			failureAmount: options.failureAmount ?? null,
			applied: Math.trunc(amount),
			triggeredTemporary: result.triggeredTemporary,
			triggeredIndefinite: result.triggeredIndefinite,
			sanBefore: before,
			sanAfter: result.sanAfter
		};
		appendPlayHistory(entry);
		if (result.triggeredTemporary || result.triggeredIndefinite) {
			showTransientRollBanner({
				title: result.triggeredTemporary ? 'Temporary insanity check' : 'Indefinite insanity threshold',
				detail: result.triggeredTemporary
					? 'This loss is 5 or more SAN from one source. INT roll helper is available under characteristics.'
					: 'Daily SAN loss has reached the one-fifth threshold.'
			});
		}
		isDirty = true;
		await persistInvestigator();
	}

	async function rollDevelopmentForMark(mark: SkillDevelopmentMark) {
		if (diceRolling) return;
		const skill = findPlaySkill(mark);
		if (!skill) return;
		const beforeTotal = skill.total;
		const result = rollDevelopmentImprovement(beforeTotal);
		const at = new Date().toISOString();
		const milestoneKey = markKeyFor(skill.skillId, skill.customName);
		let sanityRewardRolls: number[] | null = null;
		let sanityRewardTotal: number | null = null;

		diceRolling = true;
		try {
			const dice: DiceGroup[] = [{ count: 1, sides: 100, results: [result.eligibilityRoll] }];
			if (result.improvementRoll !== null) {
				dice.push({ count: 1, sides: 10 as const, results: [result.improvementRoll] });
			}
			await showDiceRoll(
				makeDiceRollRequest(dice, {
					label: `${mark.skillDisplayLabel} development`,
					reveal: 'after-settle'
				})
			);
			if (result.eligibilityPassed) {
				applyDevelopedSkillTotal(skill, result.improvement, at);
				const alreadyAwarded = skillDevelopmentMilestones.includes(milestoneKey);
				if (crossed90ViaDevelopment(beforeTotal, result.afterTotal) && !alreadyAwarded) {
					const reward = rollSum(2, 6);
					sanityRewardRolls = reward.rolls;
					sanityRewardTotal = reward.total;
					skillDevelopmentMilestones = [...skillDevelopmentMilestones, milestoneKey];
					await showDiceRoll(
						makeDiceRollRequest([{ count: 2, sides: 6, results: reward.rolls }], {
							label: 'SAN reward',
							reveal: 'after-settle'
						})
					);
				}
			}

			appendPlayHistory({
				id: crypto.randomUUID(),
				at,
				targetKind: 'skillDevelopment',
				skillId: mark.skillId,
				customName: mark.customName,
				skillDisplayLabel: mark.skillDisplayLabel,
				beforeTotal,
				improvementRoll: result.improvementRoll,
				improvement: result.improvement,
				afterTotal: result.afterTotal,
				eligibilityRoll: result.eligibilityRoll,
				eligibilityPassed: result.eligibilityPassed,
				sanityRewardRolls,
				sanityRewardTotal
			});
			skillDevelopmentMarks = skillDevelopmentMarks.filter((m) => m.id !== mark.id);
			if (sanityRewardTotal) {
				await applySanDelta(-sanityRewardTotal, 'Development reward');
			} else {
				isDirty = true;
				await persistInvestigator();
			}
			showTransientRollBanner({
				title: `${mark.skillDisplayLabel}: ${result.eligibilityPassed ? `+${result.improvement}` : 'no increase'}`,
				detail: `Development roll ${result.eligibilityRoll}`
			});
		} finally {
			diceRolling = false;
		}
	}

	let rollingAllMarks = $state(false);
	async function rollAllDevelopmentMarks() {
		if (rollingAllMarks || diceRolling) return;
		rollingAllMarks = true;
		try {
			for (const mark of [...skillDevelopmentMarks]) {
				await rollDevelopmentForMark(mark);
			}
		} finally {
			rollingAllMarks = false;
		}
	}

	async function clearDevelopmentMark(mark: SkillDevelopmentMark) {
		skillDevelopmentMarks = skillDevelopmentMarks.filter((m) => m.id !== mark.id);
		isDirty = true;
		await persistInvestigator();
	}

	async function rollSanCheck() {
		if (diceRolling) return;
		const target = currentSanity;
		const rawRoll = rollDie(100);
		diceRolling = true;
		try {
			await showDiceRoll(
				makeDiceRollRequest([{ count: 1, sides: 100, results: [rawRoll] }], {
					label: 'SAN',
					reveal: 'after-settle'
				})
			);
			const checked = evaluateCoC7ePercentileCheck({
				rawRoll,
				target,
				half: halfValue(target),
				fifth: fifthValue(target)
			});
			appendPlayHistory({
				id: crypto.randomUUID(),
				at: new Date().toISOString(),
				targetKind: 'sanCheck',
				target,
				rawRoll,
				effectiveRoll: checked.effectiveRoll,
				outcome: checked.outcome,
				isFumble: checked.isFumble,
				lossApplied: false
			});
			showTransientRollBanner({ title: `SAN: ${outcomeDescription(checked)}`, detail: `Rolled ${rawRoll}` });
			await persistInvestigator();
		} finally {
			diceRolling = false;
		}
	}

	async function rollSanLossFromFormula(formulaInput: string, outcome: 'success' | 'failure') {
		if (diceRolling) return;
		try {
			const formula = parseSanLossFormula(formulaInput);
			const selected = outcome === 'success' ? formula.success : formula.failure;
			const rolled = rollSanLoss(formula, outcome);
			const amount = rolled.amount;
			diceRolling = true;
			if (rolled.rolls.length > 0 && selected.kind === 'dice') {
				await showDiceRoll(
					makeDiceRollRequest(
						[{ count: selected.count, sides: selected.sides as DiceGroup['sides'], results: rolled.rolls }],
						{ label: 'SAN loss', reveal: 'after-settle' }
					)
				);
			}
			await applySanDelta(amount, 'SAN loss', {
				formula: formulaInput,
				successAmount: outcome === 'success' ? amount : null,
				failureAmount: outcome === 'failure' ? amount : null
			});
			showTransientRollBanner({ title: `SAN loss: ${amount}`, detail: `${formulaInput} (${outcome})` });
		} catch (e) {
			showTransientRollBanner({
				title: 'SAN loss formula rejected',
				detail: e instanceof Error ? e.message : 'Use success/failure, such as 0/1D6.'
			});
		} finally {
			diceRolling = false;
		}
	}

	async function applyManualSanLoss(amount: number) {
		await applySanDelta(Math.max(0, Math.trunc(amount)), 'Manual SAN loss');
	}

	async function resetSanTrackingDay() {
		const reset = resetSanDay(currentSanity);
		playTracking = { ...playTracking, ...reset };
		isDirty = true;
		await persistInvestigator();
	}

	async function toggleInsanityFlag(
		key: keyof CoCCharacterData['playTracking']['insanity'],
		value: boolean
	) {
		// Auto-persist without flashing the "Save" affordance: only mark the sheet
		// dirty if persistence fails. The "Save" pill in the In-Play header is
		// reserved for changes the user still has to commit.
		playTracking = {
			...playTracking,
			insanity: { ...playTracking.insanity, [key]: value }
		};
		const ok = await persistInvestigator();
		if (!ok) isDirty = true;
	}

	function genericDiceLabel(entry: PlayRollHistoryGenericDiceEntry): string {
		const groups = entry.groups && entry.groups.length > 0
			? entry.groups
			: [{ count: entry.count, sides: entry.sides }];
		const dicePart = groups.map((g) => `${g.count}d${g.sides}`).join(' + ');
		const modPart = entry.modifier
			? `${entry.modifier > 0 ? '+' : ''}${entry.modifier}`
			: '';
		return `${dicePart}${modPart}`;
	}

	async function recordGenericDice(entry: PlayRollHistoryGenericDiceEntry) {
		appendPlayHistory(entry);
		showTransientRollBanner({
			title: entry.label?.trim() || genericDiceLabel(entry),
			detail: `Total ${entry.total}`
		});
		await persistInvestigator();
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
		if (entry.targetKind === 'skillDevelopment') return `${entry.skillDisplayLabel} development`;
		if (entry.targetKind === 'sanCheck') return 'SAN check';
		if (entry.targetKind === 'sanLoss') return entry.source;
		if (entry.targetKind === 'genericDice') return entry.label?.trim() || genericDiceLabel(entry);
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
			return sortSkillsForDisplay(
				buildPlayModeSkills({ ...char, skills: playSkills }, data.skills),
				playSkillSortMode,
				playSkillSortDirection,
				skillRowLabel
			);
		}
		const skills = editMode && editChar ? editChar.skills : char.skills;
		const visible = skills.filter(shouldShowInvestigatorSkillOnSheet).slice();
		if (editMode && editChar) return visible;
		return visible.sort((a, b) => b.total - a.total);
	});

	// Live name filter for the play-mode skill list. Match against display
	// name (which already accounts for custom-skill defs and customName labels)
	// so a player typing "rifle" finds "Firearms (Rifle)" / "Firearms (Any)"
	// labelled with a Rifle resolution.
	const playFilteredSkills = $derived.by(() => {
		if (!playMode) return sortedSkills;
		const q = playSkillSearch.trim().toLowerCase();
		if (!q) return sortedSkills;
		return sortedSkills.filter((s) => {
			const name = skillDisplayName(s.skillId).toLowerCase();
			const custom = (s.customName ?? '').toLowerCase();
			return name.includes(q) || custom.includes(q);
		});
	});

	function trackerWidthPct(current: number, max: number): number {
		if (!Number.isFinite(max) || max <= 0) return 0;
		return Math.max(0, Math.min(100, (current / max) * 100));
	}

	const currentDailySanLoss = $derived(dailyLossSoFar(playRollHistory, playTracking.dailySanResetAt));
	const currentDailySanThreshold = $derived(dailySanThreshold(playTracking.dailySanStart));
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
	<div class="flex flex-wrap items-start gap-4">
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
		<div class="ml-auto flex flex-wrap gap-2">
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
						character={liveChar}
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
		<section aria-labelledby="in-play-heading" class="rounded-md border-2 border-[var(--color-primary)] bg-[var(--color-card)] p-3 space-y-3">
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

			<!--
				The roll-status slot reserves a fixed min-height so swapping between
				the persisted banner, the "Rolling…" indicator, and the empty initial
				state never reflows the In-Play Tracking card. The min-height equals
				the banner's natural two-line + padding height (~3.5rem).
			-->
			<div class="min-h-[3.5rem]">
				{#if diceRolling}
					<div
						class="flex items-stretch gap-2 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-accent)]/15 text-sm"
						role="status"
						aria-live="polite"
					>
						<div class="min-w-0 flex-1 px-3 py-2">
							<p class="font-semibold text-[var(--color-muted-foreground)]" data-heading>Rolling…</p>
							<p class="text-xs text-[var(--color-muted-foreground)]">Resolving dice.</p>
						</div>
					</div>
				{:else if lastRollBanner}
					<div class="flex items-stretch gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-accent)]/30 text-sm">
						<div class="min-w-0 flex-1 px-3 py-2">
							<p class="font-semibold" data-heading>{lastRollBanner.title}</p>
							<p class="text-xs text-[var(--color-muted-foreground)]">{lastRollBanner.detail}</p>
						</div>
						<button
							type="button"
							onclick={dismissRollBanner}
							aria-label="Dismiss last roll"
							class="flex shrink-0 items-center justify-center self-stretch rounded-r-[var(--radius)] border-l border-[var(--color-border)] px-4 text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]/50 hover:text-[var(--color-foreground)]"
						>
							<svg viewBox="0 0 16 16" class="h-5 w-5" aria-hidden="true">
								<path d="M3 3L13 13M13 3L3 13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" fill="none" />
							</svg>
						</button>
					</div>
				{/if}
			</div>

			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{#each [
					{ label: 'HP', stat: 'hp' as const, current: currentHP, max: char.derivedStats.hp.max, color: 'var(--color-destructive)' },
					{ label: 'MP', stat: 'mp' as const, current: currentMP, max: char.derivedStats.mp.max, color: 'var(--color-primary)' },
					{ label: 'Sanity', stat: 'sanity' as const, current: currentSanity, max: char.derivedStats.sanity.max, color: 'var(--color-warning)' },
					{ label: 'Luck', stat: 'luck' as const, current: currentLuck, max: 99, color: 'var(--color-foreground)' }
				] as tracker}
					<div class="text-center">
						<span class="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">{tracker.label}</span>
						<div class="mt-1 flex items-center justify-center gap-3">
							<button
								type="button"
								onclick={() => adjust(tracker.stat, -1)}
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-xl font-bold hover:bg-[var(--color-accent)]"
							>−</button>
							<span class="min-w-[3.5rem] text-center text-4xl font-bold leading-none">{tracker.current}</span>
							<button
								type="button"
								onclick={() => adjust(tracker.stat, 1)}
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-xl font-bold hover:bg-[var(--color-accent)]"
							>+</button>
						</div>
						{#if tracker.stat !== 'luck'}
							<span class="text-xs text-[var(--color-muted-foreground)]">/ {tracker.max}</span>
						{:else}
							<span class="text-xs text-[var(--color-muted-foreground)]">current</span>
						{/if}
						<!-- Progress bar -->
						<div class="mx-auto mt-1.5 h-2 w-full max-w-[140px] rounded-full bg-[var(--color-muted)]">
							<div
								class="h-2 rounded-full transition-all"
								style="width: {trackerWidthPct(tracker.current, tracker.max)}%; background-color: {tracker.color}"
							></div>
						</div>
					</div>
				{/each}
			</div>

			<div class="grid gap-3 lg:grid-cols-2">
				<SanToolsPanel
					currentSanity={currentSanity}
					dailyLoss={currentDailySanLoss}
					dailyThreshold={currentDailySanThreshold}
					{playTracking}
					disabled={diceRolling}
					onRollSanCheck={rollSanCheck}
					onRollLoss={rollSanLossFromFormula}
					onApplyManualLoss={applyManualSanLoss}
					onResetDay={resetSanTrackingDay}
					onToggleInsanity={toggleInsanityFlag}
				/>
				<FreeDiceRoller disabled={diceRolling} onRoll={recordGenericDice} />
			</div>

			<DevelopmentPhasePanel
				marks={skillDevelopmentMarks}
				disabled={diceRolling}
				onRoll={rollDevelopmentForMark}
				onRollAll={rollAllDevelopmentMarks}
				onClear={clearDevelopmentMark}
			/>

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
								{:else if entry.targetKind === 'characteristic' || entry.targetKind === 'skill'}
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
								{:else if entry.targetKind === 'skillDevelopment'}
									<div class="mt-0.5 text-[var(--color-muted-foreground)]">
										Rolled {entry.eligibilityRoll}; {entry.eligibilityPassed ? `improved ${entry.beforeTotal}% → ${entry.afterTotal}%` : 'no improvement'}
										{#if entry.sanityRewardTotal}
											<span> · SAN +{entry.sanityRewardTotal}</span>
										{/if}
									</div>
								{:else if entry.targetKind === 'sanCheck'}
									<div class="mt-0.5 text-[var(--color-muted-foreground)]">
										Rolled {entry.rawRoll} vs {entry.target}: {outcomeDescription({
											effectiveRoll: entry.effectiveRoll,
											outcome: entry.outcome,
											isFumble: entry.isFumble
										})}
									</div>
								{:else if entry.targetKind === 'sanLoss'}
									<div class="mt-0.5 text-[var(--color-muted-foreground)]">
										{entry.applied >= 0 ? `Loss ${entry.applied}` : `Reward ${Math.abs(entry.applied)}`}
										<span> · SAN {entry.sanBefore} → {entry.sanAfter}</span>
									</div>
								{:else if entry.targetKind === 'genericDice'}
									<div class="mt-0.5 text-[var(--color-muted-foreground)]">
										{genericDiceLabel(entry)}
										<span>
											· {entry.groups && entry.groups.length > 0
												? entry.groups.map((g) => `[${g.rolls.join(', ')}]`).join(' + ')
												: `[${entry.rolls.join(', ')}]`}
											= {entry.total}
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
		<SheetReadOnly character={liveChar} skills={data.skills} occupations={data.occupations} />
	{/if}

	<!-- Characteristics & Derived (edit/play modes) -->
	{#if (editMode && editChar) || playMode}
		<div class="grid gap-6" class:lg:grid-cols-2={!playMode}>
			<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
				<h2 class="mb-3 font-semibold" data-heading>Characteristics</h2>
				<div
					class="grid grid-cols-4 gap-2 text-center text-sm"
					class:lg:grid-cols-8={playMode}
				>
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

			{#if editMode}
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
			{/if}
		</div>
	{/if}

	<!-- Skills (edit/play modes; default rendered by SheetReadOnly) -->
	{#if (editMode && editChar) || playMode}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<div class="mb-3 flex items-center justify-between gap-3">
				<h2 class="font-semibold" data-heading>
					Skills
					{#if playMode}
						<span class="text-xs font-normal text-[var(--color-muted-foreground)]">— click to roll</span>
					{/if}
				</h2>
				{#if playMode}
					<div class="flex flex-wrap items-end justify-end gap-2">
						<SkillSortControls
							mode={playSkillSortMode}
							direction={playSkillSortDirection}
							idPrefix="play-skill-sort"
							onChange={updatePlaySkillSort}
						/>
						<input
							type="text"
							placeholder="Search…"
							bind:value={playSkillSearch}
							aria-label="Filter skills"
							class="w-44 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1 text-sm placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)] sm:w-56"
						/>
					</div>
				{/if}
			</div>
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
				{#each playMode ? playFilteredSkills : sortedSkills as skill}
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
						<div class="flex items-center gap-2 rounded-md border border-transparent px-1 py-0.5 hover:border-[var(--color-border)] hover:bg-[var(--color-accent)]">
							<label class="flex items-center" title="Mark for development">
								<input
									type="checkbox"
									checked={hasDevelopmentMark(skill)}
									onchange={(e) =>
										toggleDevelopmentMark(skill, (e.currentTarget as HTMLInputElement).checked)}
									aria-label="Mark {skillRowLabel(skill)} for development"
								/>
							</label>
							<button
								type="button"
								class="flex min-w-0 grow justify-between text-left text-sm disabled:opacity-50"
								disabled={diceRolling}
								onclick={() => rollSkill(skill)}
								aria-label="Roll {skillRowLabel(skill)}"
							>
								<span class="min-w-0">
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
						</div>
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
