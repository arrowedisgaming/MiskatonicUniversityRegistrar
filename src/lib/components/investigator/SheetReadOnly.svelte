<script lang="ts">
	import { ALL_CHARACTERISTICS } from '$lib/types/common';
	import { halfValue, fifthValue } from '$lib/engine/characteristics';
	import { shouldShowInvestigatorSkillOnSheet } from '$lib/engine/investigator-sheet-skills';
	import { createSkillAllocation } from '$lib/engine/skills';
	import { browser } from '$app/environment';
	import { sortSkillsForDisplay, type SkillSortDirection, type SkillSortMode } from '$lib/engine/skill-sort';
	import type { CoCCharacterData, CoCSkillAllocation } from '$lib/types/character';
	import type { CoCSkillDefinition, CoCOccupationDefinition } from '$lib/types/content-pack';
	import { BACKSTORY_LABEL_BY_KEY, type BackstoryKey } from '$lib/engine/backstory';
	import { resolveSkillDisplayName } from '$lib/engine/occupation-filter';
	import SkillSortControls from '$lib/components/skills/SkillSortControls.svelte';

	type Props = {
		character: CoCCharacterData;
		skills: CoCSkillDefinition[];
		occupations: CoCOccupationDefinition[];
	};

	let { character, skills }: Props = $props();

	const SORT_KEY = 'mur.skillSort.read';
	let skillSortMode = $state<SkillSortMode>('rating');
	let skillSortDirection = $state<SkillSortDirection>('desc');

	if (browser) {
		try {
			const saved = JSON.parse(localStorage.getItem(SORT_KEY) ?? 'null') as
				| { mode?: SkillSortMode; direction?: SkillSortDirection }
				| null;
			if (saved?.mode === 'alphabetical' || saved?.mode === 'rating') skillSortMode = saved.mode;
			if (saved?.direction === 'asc' || saved?.direction === 'desc') skillSortDirection = saved.direction;
		} catch {
			// Keep defaults.
		}
	}

	const sortedSkills = $derived.by(() => {
		const existing = character.skills.filter(shouldShowInvestigatorSkillOnSheet);
		const existingIds = new Set(existing.map((s) => s.skillId));
		// Custom skill defs that didn't make it into character.skills (e.g. zero-
		// allocation saves from before the fix) are synthesised here so they always
		// appear on the sheet.
		const extra: CoCSkillAllocation[] = (character.customSkillDefs ?? [])
			.filter((d) => !existingIds.has(d.id))
			.map((d) => createSkillAllocation(d.id, d.baseValue, [], false));
		return sortSkillsForDisplay([...existing, ...extra], skillSortMode, skillSortDirection, skillRowLabel);
	});

	function updateSort(next: { mode: SkillSortMode; direction: SkillSortDirection }) {
		skillSortMode = next.mode;
		skillSortDirection = next.direction;
		if (browser) localStorage.setItem(SORT_KEY, JSON.stringify(next));
	}

	function backstoryLabel(key: string): string {
		return (
			BACKSTORY_LABEL_BY_KEY[key as BackstoryKey] ?? key.replace(/([A-Z])/g, ' $1').trim()
		);
	}

	function skillDisplayName(skillId: string): string {
		return resolveSkillDisplayName(skillId, character.customSkillDefs ?? [], skills);
	}

	function skillRowLabel(skill: CoCSkillAllocation): string {
		const base = skillDisplayName(skill.skillId);
		return skill.customName?.trim() ? `${base} (${skill.customName})` : base;
	}
</script>

<!-- Characteristics & Derived -->
<div class="grid gap-6 lg:grid-cols-2">
	<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
		<h2 class="mb-3 font-semibold" data-heading>Characteristics</h2>
		<div class="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
			{#each ALL_CHARACTERISTICS as statId}
				{@const v = character.characteristics.values[statId]}
				<div class="rounded-md border border-[var(--color-border)]/50 p-2">
					<span class="block text-xs uppercase text-[var(--color-muted-foreground)]">{statId}</span>
					<span class="block text-xl font-bold">{v}</span>
					<span class="block text-xs text-[var(--color-muted-foreground)]">{halfValue(v)} / {fifthValue(v)}</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
		<h2 class="mb-3 font-semibold" data-heading>Derived Attributes</h2>
		<div class="grid grid-cols-2 gap-2 text-sm">
			{#each [
				['Hit Points', `${character.derivedStats.hp.current}/${character.derivedStats.hp.max}`],
				['Magic Points', `${character.derivedStats.mp.current}/${character.derivedStats.mp.max}`],
				['Sanity', `${character.derivedStats.sanity.current}/${character.derivedStats.sanity.max}`],
				['Luck', `${character.derivedStats.luck.current}`],
				['Damage Bonus', character.derivedStats.damageBonus],
				['Build', String(character.derivedStats.build)],
				['Move Rate', String(character.derivedStats.moveRate)]
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
		<div class="mb-3 flex flex-wrap items-end justify-between gap-3">
			<h2 class="font-semibold" data-heading>Skills</h2>
			<SkillSortControls
				mode={skillSortMode}
				direction={skillSortDirection}
				idPrefix="read-skill-sort"
				onChange={updateSort}
			/>
		</div>
		<div class="columns-1 gap-x-[clamp(0.5rem,2vw,1.5rem)] sm:columns-2 lg:columns-3 2xl:columns-4">
			{#each sortedSkills as skill (skillRowLabel(skill))}
				<div class="flex break-inside-avoid justify-between py-0.5 text-sm">
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
			{/each}
		</div>
		<p class="mt-3 text-xs text-[var(--color-muted-foreground)]">
			Only non-base skills are shown here. Enter Play Mode to see and roll all skills.
		</p>
	</div>
{/if}

<!-- Equipment -->
{#if character.equipment.items.length > 0 || character.equipment.weapons.length > 0 || (character.equipment.assetsList ?? []).length > 0 || character.equipment.assetsLabel}
	<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
		<h2 class="mb-3 font-semibold" data-heading>Equipment</h2>

		<p class="mb-2 text-sm text-[var(--color-muted-foreground)]">
			{character.equipment.livingStandard} &middot; Spending Level: ${character.equipment.spendingLevel.toLocaleString()} &middot; Cash: ${character.equipment.cash.toLocaleString()} &middot; Assets: {character.equipment.assetsLabel}
		</p>

		{#if character.equipment.weapons.length > 0}
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
						{#each character.equipment.weapons as w, wi (wi)}
							<tr class="border-b border-[var(--color-border)]/20 align-top">
								<td class="py-1 pr-2 font-medium">{w.name}</td>
								<td class="py-1 pr-2"><span class="font-mono">{w.damage}</span></td>
								<td class="py-1 pr-2">{w.range}</td>
								<td class="py-1">{w.attacksPerRound}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if character.equipment.items.length > 0}
			<p class="text-sm">{character.equipment.items.map((i) => i.name).join(', ')}</p>
		{/if}

		{#if (character.equipment.assetsList ?? []).length > 0}
			<div class="mt-3">
				<h3 class="mb-1 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Itemized Assets</h3>
				<ul class="space-y-1 text-sm">
					{#each character.equipment.assetsList ?? [] as asset}
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
{#if Object.values(character.backstory).some((v) => v.trim())}
	<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
		<h2 class="mb-3 font-semibold" data-heading>Backstory</h2>
		<div class="space-y-3 text-sm">
			{#each Object.entries(character.backstory).filter(([, v]) => v.trim()) as [key, value]}
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
