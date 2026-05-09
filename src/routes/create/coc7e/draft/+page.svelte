<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import { ALL_CHARACTERISTICS, CHARACTERISTIC_LABELS } from '$lib/types/common';
	import type { CharacteristicId } from '$lib/types/common';
	import { halfValue, fifthValue } from '$lib/engine/characteristics';
	import { rollDie } from '$lib/engine/dice';
	import { showDiceRoll } from '$lib/stores/dice-rolls';
	import { makeDiceRollRequest } from '$lib/dice/protocol';
	import { evaluateCoC7ePercentileCheck } from '$lib/engine/coc-percentile-check';
	import { buildPlayModeSkills } from '$lib/engine/investigator-sheet-skills';
	import { resolveSkillDisplayName } from '$lib/engine/occupation-filter';
	import type { CoCOccupationDefinition, CoCSkillDefinition, CoCContentPack } from '$lib/types/content-pack';
	import type { CoCSkillAllocation, PlayRollHistoryEntry } from '$lib/types/character';
	import PDFExportButton from '$lib/components/investigator/PDFExportButton.svelte';

	const data = page.data as {
		contentPack: CoCContentPack;
		skills: CoCSkillDefinition[];
		occupations: CoCOccupationDefinition[];
	};

	const ROLL_HISTORY_KEEP = 200;

	// Character data sourced from wizard localStorage (no DB, no auth required)
	let char = $derived($wizard.character);

	const occupation = $derived(
		data.occupations.find((o) => o.id === char.occupation?.occupationId)
	);
	const occupationName = $derived(
		char.occupation?.customName ?? occupation?.name ?? 'Custom Occupation'
	);

	// In-play stat trackers — intentional one-shot snapshots, persisted back to wizard state.
	// untrack() makes the non-reactive read explicit so player adjustments persist across
	// navigation rather than auto-resetting when the wizard store re-emits.
	let currentHP = $state(untrack(() => char.derivedStats.hp.current));
	let currentMP = $state(untrack(() => char.derivedStats.mp.current));
	let currentSanity = $state(untrack(() => char.derivedStats.sanity.current));
	let currentLuck = $state(untrack(() => char.derivedStats.luck.current));

	let playRollHistory = $state<PlayRollHistoryEntry[]>(untrack(() => [...(char.playRollHistory ?? [])]));
	let diceRolling = $state(false);
	let lastRollBanner = $state<{ title: string; detail: string } | null>(null);
	let lastRollClearTimer: ReturnType<typeof setTimeout> | null = null;

	// All skills including base/unallocated ones (full play-mode list), sorted alphabetically
	const sortedSkills = $derived(
		buildPlayModeSkills(char, data.skills).sort((a, b) =>
			skillLabel(a).localeCompare(skillLabel(b))
		)
	);

	let skillSearch = $state('');
	const filteredSkills = $derived(
		skillSearch
			? sortedSkills.filter((s) => {
					const name = resolveSkillDisplayName(s.skillId, char.customSkillDefs ?? [], data.skills);
					return name.toLowerCase().includes(skillSearch.toLowerCase());
				})
			: sortedSkills
	);

	function skillLabel(skill: CoCSkillAllocation): string {
		return resolveSkillDisplayName(skill.skillId, char.customSkillDefs ?? [], data.skills);
	}

	function persistToWizard() {
		wizard.updateCharacter((c) => ({
			...c,
			derivedStats: {
				...c.derivedStats,
				hp: { ...c.derivedStats.hp, current: currentHP },
				mp: { ...c.derivedStats.mp, current: currentMP },
				sanity: { ...c.derivedStats.sanity, current: currentSanity },
				luck: { ...c.derivedStats.luck, current: currentLuck }
			},
			playRollHistory: playRollHistory.slice(0, ROLL_HISTORY_KEEP)
		}));
	}

	function outcomeDescription(checked: ReturnType<typeof evaluateCoC7ePercentileCheck>): string {
		switch (checked.outcome) {
			case 'critical': return 'Critical success!';
			case 'extreme': return 'Extreme success';
			case 'hard': return 'Hard success';
			case 'regular': return 'Regular success';
			case 'failure': return checked.isFumble ? 'Fumble!' : 'Failure';
		}
	}

	function showTransientRollBanner(next: { title: string; detail: string }) {
		lastRollBanner = next;
		if (lastRollClearTimer) clearTimeout(lastRollClearTimer);
		lastRollClearTimer = setTimeout(() => {
			lastRollBanner = null;
			lastRollClearTimer = null;
		}, 3500);
	}

	async function rollCharacteristic(statId: CharacteristicId) {
		if (diceRolling) return;
		const target = char.characteristics.values[statId];
		const half = halfValue(target);
		const fifth = fifthValue(target);
		const rawRoll = rollDie(100);
		const label = CHARACTERISTIC_LABELS[statId];
		diceRolling = true;
		try {
			await showDiceRoll(
				makeDiceRollRequest([{ count: 1, sides: 100, results: [rawRoll] }], {
					label,
					reveal: 'after-settle'
				})
			);
			const checked = evaluateCoC7ePercentileCheck({ rawRoll, target, half, fifth });
			const entry: PlayRollHistoryEntry = {
				id: crypto.randomUUID(),
				at: new Date().toISOString(),
				targetKind: 'characteristic',
				characteristicId: statId,
				target, half, fifth,
				rawRoll,
				effectiveRoll: checked.effectiveRoll,
				outcome: checked.outcome,
				isFumble: checked.isFumble
			};
			playRollHistory = [entry, ...playRollHistory].slice(0, ROLL_HISTORY_KEEP);
			showTransientRollBanner({ title: `${label}: ${outcomeDescription(checked)}`, detail: `Rolled ${rawRoll}` });
			persistToWizard();
		} finally {
			diceRolling = false;
		}
	}

	async function rollSkill(skill: CoCSkillAllocation) {
		if (diceRolling) return;
		const label = skillLabel(skill);
		const rawRoll = rollDie(100);
		diceRolling = true;
		try {
			await showDiceRoll(
				makeDiceRollRequest([{ count: 1, sides: 100, results: [rawRoll] }], {
					label,
					reveal: 'after-settle'
				})
			);
			const checked = evaluateCoC7ePercentileCheck({
				rawRoll,
				target: skill.total,
				half: skill.half,
				fifth: skill.fifth
			});
			const entry: PlayRollHistoryEntry = {
				id: crypto.randomUUID(),
				at: new Date().toISOString(),
				targetKind: 'skill',
				skillId: skill.skillId,
				skillDisplayLabel: label,
				target: skill.total,
				half: skill.half,
				fifth: skill.fifth,
				rawRoll,
				effectiveRoll: checked.effectiveRoll,
				outcome: checked.outcome,
				isFumble: checked.isFumble
			};
			playRollHistory = [entry, ...playRollHistory].slice(0, ROLL_HISTORY_KEEP);
			showTransientRollBanner({ title: `${label}: ${outcomeDescription(checked)}`, detail: `Rolled ${rawRoll}` });
			persistToWizard();
		} finally {
			diceRolling = false;
		}
	}

	function clampTracker(val: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, val));
	}
</script>

<svelte:head>
	<title>{char.name || 'Draft Investigator'} — Play Mode</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 px-4 py-6">

	<!-- Unsaved banner -->
	<div class="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-3">
		<div class="flex flex-wrap items-center gap-3">
			<p class="text-sm text-[var(--color-warning)]">
				<strong>Draft — not saved.</strong> Rolls and stat changes are stored locally. Sign in to save permanently and get a share link.
			</p>
			<div class="ml-auto flex items-center gap-2">
				<a
					href="/create/coc7e/review"
					class="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium
						text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-accent)]"
				>
					&larr; Back to Review
				</a>
				<a
					href="/login?callbackUrl=/create/coc7e/review"
					class="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold
						text-[var(--color-primary-foreground)] transition-colors hover:opacity-90"
				>
					Sign in to Save
				</a>
			</div>
		</div>
	</div>

	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold" data-heading>{char.name || 'Unnamed Investigator'}</h1>
		<p class="mt-1 text-sm text-[var(--color-muted-foreground)]">
			{occupationName} &middot; Age {char.age} &middot; {char.era} Era
		</p>
		<div class="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-muted-foreground)]">
			{#each [
				['Characteristics', WIZARD_STEPS[0].path],
				['Occupation', WIZARD_STEPS[1].path],
				['Skills', WIZARD_STEPS[2].path],
				['Backstory', WIZARD_STEPS[3].path],
				['Equipment', WIZARD_STEPS[4].path]
			] as [label, path]}
				<a href={path} class="underline underline-offset-2 hover:text-[var(--color-foreground)]">
					Edit {label}
				</a>
			{/each}
		</div>
	</div>

	<!-- Last roll banner -->
	<div class="min-h-12">
		{#if diceRolling}
			<div class="border-b border-[var(--color-border)] pb-3 text-xs text-[var(--color-muted-foreground)]">Rolling…</div>
		{:else if lastRollBanner}
			<div class="rounded-md border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-4 py-2.5 text-sm">
				<span class="font-semibold">{lastRollBanner.title}</span>
				<span class="ml-2 text-[var(--color-muted-foreground)]">{lastRollBanner.detail}</span>
			</div>
		{/if}
	</div>

	<!-- Stat trackers -->
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
		{#each [
			{ label: 'Hit Points', current: currentHP, max: char.derivedStats.hp.max, set: (v: number) => { currentHP = clampTracker(v, 0, char.derivedStats.hp.max); persistToWizard(); } },
			{ label: 'Magic Points', current: currentMP, max: char.derivedStats.mp.max, set: (v: number) => { currentMP = clampTracker(v, 0, char.derivedStats.mp.max); persistToWizard(); } },
			{ label: 'Sanity', current: currentSanity, max: char.derivedStats.sanity.max, set: (v: number) => { currentSanity = clampTracker(v, 0, char.derivedStats.sanity.max); persistToWizard(); } },
			{ label: 'Luck', current: currentLuck, max: char.derivedStats.luck.max, set: (v: number) => { currentLuck = clampTracker(v, 0, char.derivedStats.luck.max); persistToWizard(); } }
		] as tracker}
			<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
				<span class="block text-xs uppercase text-[var(--color-muted-foreground)]">{tracker.label}</span>
				<div class="mt-1 flex items-center gap-2">
					<button
						type="button"
						onclick={() => tracker.set(tracker.current - 1)}
						class="h-7 w-7 rounded border border-[var(--color-border)] text-sm font-bold hover:bg-[var(--color-accent)]"
					>−</button>
					<span class="flex-1 text-center text-lg font-bold">
						{tracker.current}<span class="text-sm font-normal text-[var(--color-muted-foreground)]">/{tracker.max}</span>
					</span>
					<button
						type="button"
						onclick={() => tracker.set(tracker.current + 1)}
						class="h-7 w-7 rounded border border-[var(--color-border)] text-sm font-bold hover:bg-[var(--color-accent)]"
					>+</button>
				</div>
				<div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
					<div
						class="h-full rounded-full bg-[var(--color-primary)] transition-all"
						style="width: {tracker.max > 0 ? Math.max(0, Math.min(100, (tracker.current / tracker.max) * 100)) : 0}%"
					></div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Characteristics (clickable for rolls) -->
	<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
		<h2 class="mb-3 font-semibold" data-heading>Characteristics <span class="text-xs font-normal text-[var(--color-muted-foreground)]">— click to roll</span></h2>
		<div class="grid grid-cols-4 gap-2 text-center text-sm sm:grid-cols-8">
			{#each ALL_CHARACTERISTICS as statId}
				{@const v = char.characteristics.values[statId]}
				<button
					type="button"
					onclick={() => rollCharacteristic(statId)}
					disabled={diceRolling}
					class="rounded-md border border-[var(--color-border)]/50 p-2 transition-colors
						hover:border-[var(--color-primary)]/60 hover:bg-[var(--color-accent)]
						disabled:cursor-not-allowed disabled:opacity-50"
				>
					<span class="block text-xs uppercase text-[var(--color-muted-foreground)]">{statId}</span>
					<span class="block text-xl font-bold">{v}</span>
					<span class="block text-xs text-[var(--color-muted-foreground)]">{halfValue(v)} / {fifthValue(v)}</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- Skills (clickable for rolls) -->
	<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
		<div class="mb-3 flex items-center justify-between gap-3">
			<h2 class="font-semibold" data-heading>Skills <span class="text-xs font-normal text-[var(--color-muted-foreground)]">— click to roll</span></h2>
			<input
				type="text"
				placeholder="Search..."
				bind:value={skillSearch}
				class="rounded-md border border-[var(--color-border)] bg-[var(--color-background)]
					px-3 py-1 text-sm placeholder:text-[var(--color-muted-foreground)]
					focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
			/>
		</div>
		<div class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
			{#each filteredSkills as skill (skill.skillId)}
				<button
					type="button"
					onclick={() => rollSkill(skill)}
					disabled={diceRolling}
					class="flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors
						hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50
						{skill.isOccupation ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]'}"
				>
					<span class="text-left">
						{skillLabel(skill)}
						{#if skill.customName?.trim()}
							<span class="opacity-70"> ({skill.customName})</span>
						{/if}
						{#if skill.isOccupation}
							<span class="ml-0.5 text-[10px] text-[var(--color-primary)]">&#x2022;</span>
						{/if}
					</span>
					<span class="font-bold tabular-nums">{skill.total}%</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- Roll history -->
	{#if playRollHistory.length > 0}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Roll History</h2>
			<div class="space-y-1 text-sm">
				{#each playRollHistory.slice(0, 20) as entry (entry.id)}
					{#if entry.targetKind === 'characteristic' || entry.targetKind === 'skill'}
						{@const label = entry.targetKind === 'characteristic'
							? CHARACTERISTIC_LABELS[entry.characteristicId!]
							: (entry.skillDisplayLabel ?? entry.skillId ?? '')}
						{@const outcomeColor =
							entry.outcome === 'critical' || entry.outcome === 'extreme' ? 'text-[var(--color-primary)]' :
							entry.outcome === 'failure' ? 'text-[var(--color-destructive)]' :
							'text-[var(--color-foreground)]'}
						<div class="flex items-center justify-between border-b border-[var(--color-border)]/20 pb-1">
							<span>{label} — <span class="{outcomeColor} font-medium">{entry.outcome}</span>{entry.isFumble ? ' (fumble)' : ''}</span>
							<span class="text-[var(--color-muted-foreground)]">Rolled {entry.rawRoll} vs {entry.target}</span>
						</div>
					{:else if entry.targetKind === 'weaponDamage'}
						<div class="flex items-center justify-between border-b border-[var(--color-border)]/20 pb-1">
							<span>{entry.weaponName} — <span class="font-medium">{entry.total}</span></span>
							<span class="text-[var(--color-muted-foreground)]">{entry.formula}</span>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	<!-- Footer actions -->
	<div class="flex flex-wrap items-center gap-3 pb-4">
		<a
			href="/create/coc7e/review"
			class="rounded-md border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium
				text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-accent)]"
		>
			&larr; Back to Review
		</a>
		<div class="ml-auto flex items-center gap-3">
			<PDFExportButton
				character={char}
				{occupationName}
				skills={data.skills}
				occupations={data.occupations}
				contentPack={data.contentPack}
			/>
			<a
				href="/login?callbackUrl=/create/coc7e/review"
				class="rounded-md bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold
					text-[var(--color-primary-foreground)] transition-colors hover:opacity-90"
			>
				Sign in to Save
			</a>
		</div>
	</div>
</div>
