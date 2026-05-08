<script lang="ts">
	import { ALL_CHARACTERISTICS } from '$lib/types/common';
	import { halfValue, fifthValue } from '$lib/engine/characteristics';
	import { shouldShowInvestigatorSkillOnSheet } from '$lib/engine/investigator-sheet-skills';
	import type { CoCCharacterData, CoCSkillAllocation } from '$lib/types/character';
	import type { CoCSkillDefinition, CoCOccupationDefinition } from '$lib/types/content-pack';
	import { BACKSTORY_LABEL_BY_KEY, type BackstoryKey } from '$lib/engine/backstory';

	type Props = {
		character: CoCCharacterData;
		skills: CoCSkillDefinition[];
		occupations: CoCOccupationDefinition[];
	};

	// `skills` and `occupations` are accepted for API symmetry with future
	// extensions (e.g. resolving skill display names from content-pack defs).
	// Currently only the character payload is needed for the read-only render.
	let { character }: Props = $props();

	const sortedSkills = $derived(
		character.skills
			.filter(shouldShowInvestigatorSkillOnSheet)
			.slice()
			.sort((a, b) => b.total - a.total)
	);

	function backstoryLabel(key: string): string {
		return (
			BACKSTORY_LABEL_BY_KEY[key as BackstoryKey] ?? key.replace(/([A-Z])/g, ' $1').trim()
		);
	}

	function skillDisplayName(skillId: string): string {
		return skillId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
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
		<div class="grid grid-cols-4 gap-2 text-center text-sm">
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
		<h2 class="mb-3 font-semibold" data-heading>Skills</h2>
		<div class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
			{#each sortedSkills as skill (skillRowLabel(skill))}
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
			{/each}
		</div>
		<p class="mt-3 text-xs text-[var(--color-muted-foreground)]">
			Only non-base skills are shown here. Enter Play Mode to see and roll all skills.
		</p>
	</div>
{/if}

<!-- Equipment -->
{#if character.equipment.items.length > 0 || character.equipment.weapons.length > 0}
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
