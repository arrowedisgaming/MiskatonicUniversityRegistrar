<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';
	import { ALL_CHARACTERISTICS, CHARACTERISTIC_LABELS } from '$lib/types/common';
	import type { CharacteristicId } from '$lib/types/common';
	import { halfValue, fifthValue } from '$lib/engine/characteristics';
	import { calculateAllDerived } from '$lib/engine/derived-stats';
	import {
		computeSkillValues,
		resolveSkillBaseValue
	} from '$lib/engine/skills';
	import type { CoCSkillDefinition } from '$lib/types/content-pack';
	import {
		CHARACTER_SCHEMA_VERSION,
		type CoCCharacterData,
		type CoCSkillAllocation,
		type PlayRollHistoryEntry,
		type SkillPointAllocation
	} from '$lib/types/character';
	import { generatePDF } from '$lib/export/pdf-export';
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

	let isDirty = $state(false);
	let pdfError = $state<string | null>(null);
	let pdfExporting = $state(false);

	let editMode = $state(false);
	let editSaving = $state(false);
	let editError = $state<string | null>(null);
	let editChar = $state<CoCCharacterData | null>(null);

	const BACKSTORY_FIELDS: (keyof CoCCharacterData['backstory'])[] = [
		'personalDescription',
		'ideologyBeliefs',
		'significantPeople',
		'meaningfulLocations',
		'treasuredPossessions',
		'traits',
		'injuriesScars',
		'phobiasManias',
		'arcaneTomesSpellsArtifacts',
		'encountersWithStrangeEntities',
		'keyConnection'
	];

	function cloneCharacter(source: CoCCharacterData): CoCCharacterData {
		// CoCCharacterData is JSON-serializable; structuredClone keeps it fast/safe.
		return structuredClone(source);
	}

	function ensureBackstoryShape(next: CoCCharacterData): CoCCharacterData {
		const backstory = { ...next.backstory } as CoCCharacterData['backstory'];
		for (const k of BACKSTORY_FIELDS) {
			backstory[k] = (backstory[k] ?? '') as (typeof backstory)[typeof k];
		}
		return { ...next, backstory };
	}

	function backstoryLabel(key: string): string {
		return key.replace(/([A-Z])/g, ' $1').trim();
	}

	function startEdit() {
		// Avoid overlapping with play-mode interactions.
		playMode = false;
		editError = null;
		editChar = ensureBackstoryShape(cloneCharacter(char));
		editMode = true;
	}

	function cancelEdit() {
		editMode = false;
		editSaving = false;
		editError = null;
		editChar = null;
	}

	function mutateEditChar(updater: (c: CoCCharacterData) => CoCCharacterData) {
		if (!editChar) return;
		editChar = updater(editChar);
	}

	async function persistCharacter(next: CoCCharacterData): Promise<{ ok: true } | { ok: false; message: string }> {
		const res = await fetch(`/api/investigators/${data.investigator.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ character: next })
		});

		if (res.ok) return { ok: true };
		const text = await res.text().catch(() => '');
		return { ok: false, message: text || `Save failed (HTTP ${res.status})` };
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

	function setSkillTotal(draft: CoCCharacterData, skillId: string, desiredTotal: number): CoCCharacterData {
		const idx = draft.skills.findIndex((s) => s.skillId === skillId);
		if (idx === -1) return draft;
		const skill = draft.skills[idx];
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
		return skillId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
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
			lastRollBanner = {
				title: `${labelShort}: ${outcomeDescription(checked)}`,
				detail: `Rolled ${rawRoll}`
			};
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
			lastRollBanner = {
				title: `${labelShort}: ${outcomeDescription(checked)}`,
				detail: `Rolled ${rawRoll}`
			};
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
		if (entry.targetKind === 'characteristic' && entry.characteristicId) {
			return CHARACTERISTIC_LABELS[entry.characteristicId];
		}
		return entry.skillDisplayLabel ?? entry.skillId ?? 'Skill';
	}

	async function exportPDF() {
		pdfError = null;
		pdfExporting = true;
		try {
			const occName = occupation?.name ?? 'Unknown';
			const pdfBytes = await generatePDF(char, occName, data.skills, data.occupations);
			const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${(char.name || 'investigator').replace(/\s+/g, '-')}.pdf`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			pdfError = e instanceof Error ? e.message : 'PDF generation failed';
			console.error('PDF export error:', e);
		} finally {
			pdfExporting = false;
		}
	}

	// Skills sorted by total descending
	const sortedSkills = $derived.by(() => {
		const skills = editMode && editChar ? editChar.skills : char.skills;
		return skills
			.filter((s) => s.total > s.baseValue || s.isOccupation)
			.slice()
			.sort((a, b) => b.total - a.total);
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
					<button
						type="button"
						onclick={exportPDF}
						disabled={pdfExporting}
						class="cursor-pointer rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{pdfExporting ? 'Exporting...' : 'PDF'}
					</button>
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
				<a
					href="/investigators"
					class="cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-accent)]"
				>
					Back
				</a>
			{/if}
		</div>
	</div>

	{#if pdfError}
		<div class="rounded-md border border-[var(--color-destructive)] bg-[var(--color-destructive)]/10 p-3 text-sm text-[var(--color-destructive)]">
			PDF export failed: {pdfError}
		</div>
	{/if}

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

			{#if diceRolling}
				<div class="border-b border-[var(--color-border)] pb-3 text-xs text-[var(--color-muted-foreground)]">
					Rolling…
				</div>
			{/if}

			{#if lastRollBanner}
				<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-accent)]/30 px-3 py-2 text-sm">
					<p class="font-semibold">{lastRollBanner.title}</p>
					<p class="text-xs text-[var(--color-muted-foreground)]">{lastRollBanner.detail}</p>
				</div>
			{/if}

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
					<p class="text-xs text-[var(--color-muted-foreground)]">No rolls yet. Tap a characteristic or skill below.</p>
				{:else}
					<ul class="max-h-48 space-y-2 overflow-y-auto text-xs">
						{#each playRollHistory as entry}
							<li class="rounded border border-[var(--color-border)]/50 bg-[var(--color-background)]/50 px-2 py-1.5">
								<div class="flex flex-wrap justify-between gap-1">
									<span class="font-medium">{logEntryTitle(entry)}</span>
									<span class="tabular-nums text-[var(--color-muted-foreground)]">{formatLogTime(entry.at)}</span>
								</div>
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
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	{/if}

	<!-- Characteristics & Derived -->
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
					{:else}
						<div class="rounded-md border border-[var(--color-border)]/50 p-2">
							<span class="block text-xs uppercase text-[var(--color-muted-foreground)]">{statId}</span>
							<span class="block text-xl font-bold">{v}</span>
							<span class="block text-xs text-[var(--color-muted-foreground)]">{halfValue(v)} / {fifthValue(v)}</span>
						</div>
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

	<!-- Skills -->
	{#if sortedSkills.length > 0}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Skills</h2>
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
							<div class="flex items-center gap-1">
								<button
									type="button"
									onclick={() => mutateEditChar((c) => setSkillTotal(c, skill.skillId, skill.total - 1))}
									aria-label="Decrease {skillDisplayName(skill.skillId)}"
									class="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] text-base font-bold hover:bg-[var(--color-accent)]"
								>
									−
								</button>
								<input
									type="number"
									min="0"
									max="99"
									value={skill.total}
									aria-label="{skillDisplayName(skill.skillId)} total"
									oninput={(e) => {
										const v = parseInt((e.currentTarget as HTMLInputElement).value) || 0;
										mutateEditChar((c) => setSkillTotal(c, skill.skillId, v));
									}}
									class="no-spinner w-16 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-1.5 py-0.5 text-center text-sm"
								/>
								<button
									type="button"
									onclick={() => mutateEditChar((c) => setSkillTotal(c, skill.skillId, skill.total + 1))}
									aria-label="Increase {skillDisplayName(skill.skillId)}"
									class="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] text-base font-bold hover:bg-[var(--color-accent)]"
								>
									+
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
					{:else}
						<div class="flex justify-between text-sm">
							<span>
								{skillDisplayName(skill.skillId)}
								{#if skill.customName?.trim()}
									<span class="text-[var(--color-muted-foreground)]"> ({skill.customName})</span>
								{/if}
								{#if skill.isOccupation}
									<span class="text-[10px] text-[var(--color-primary)]">&#x2022;</span>
								{/if}
							</span>
							<span class="font-bold tabular-nums">{skill.total}%
								<span class="text-xs font-normal text-[var(--color-muted-foreground)]">({skill.half}/{skill.fifth})</span>
							</span>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	<!-- Backstory -->
	{#if editMode && editChar}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Backstory</h2>
			<div class="space-y-4">
				{#each BACKSTORY_FIELDS as key (key)}
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
	{:else if Object.values(char.backstory).some((v) => v.trim())}
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

	<!-- Equipment -->
	{#if char.equipment.items.length > 0 || char.equipment.weapons.length > 0}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Equipment</h2>
			<p class="mb-2 text-sm text-[var(--color-muted-foreground)]">
				{char.equipment.livingStandard} &middot; Spending Level: ${char.equipment.spendingLevel.toLocaleString()} &middot; Cash: ${char.equipment.cash.toLocaleString()} &middot; Assets: {char.equipment.assetsLabel}
			</p>
			{#if char.equipment.weapons.length > 0}
				<div class="mb-2 overflow-x-auto">
					<table class="w-full text-xs">
						<thead>
							<tr class="border-b border-[var(--color-border)] text-left uppercase text-[var(--color-muted-foreground)]">
								<th class="pb-1 pr-2">Weapon</th><th class="pb-1 pr-2">Damage</th><th class="pb-1 pr-2">Range</th><th class="pb-1">Attacks</th>
							</tr>
						</thead>
						<tbody>
							{#each char.equipment.weapons as w}
								<tr class="border-b border-[var(--color-border)]/20">
									<td class="py-1 pr-2 font-medium">{w.name}</td><td class="py-1 pr-2">{w.damage}</td><td class="py-1 pr-2">{w.range}</td><td class="py-1">{w.attacksPerRound}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
			{#if char.equipment.items.length > 0}
				<p class="text-sm">{char.equipment.items.map((i) => i.name).join(', ')}</p>
			{/if}
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
