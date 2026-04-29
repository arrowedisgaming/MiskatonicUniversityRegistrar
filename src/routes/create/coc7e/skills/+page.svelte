<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import {
		calculateOccupationSkillPoints,
		calculatePersonalInterestPoints,
		resolveSkillBaseValue,
		computeSkillValues,
		createSkillAllocation,
		validateSkillAllocation
	} from '$lib/engine/skills';
	import { halfValue, fifthValue } from '$lib/engine/characteristics';
	import { getSkillsByGroup, INTERPERSONAL_SKILLS } from '$lib/engine/occupation-filter';
	import type { CoCContentPack, CoCOccupationDefinition, CoCSkillDefinition } from '$lib/types/content-pack';
	import type { CoCSkillAllocation, SkillPointAllocation } from '$lib/types/character';
	import type { CharacteristicId } from '$lib/types/common';

	const data = page.data as {
		contentPack: CoCContentPack;
		skills: CoCSkillDefinition[];
		occupations: CoCOccupationDefinition[];
	};

	const char = $wizard.character;
	const occupation = data.occupations.find((o) => o.id === char.occupation?.occupationId);

	// Redirect if no occupation selected (e.g. direct URL access)
	if (!occupation && typeof window !== 'undefined') {
		goto(WIZARD_STEPS[1].path);
	}

	const totalOccPoints = occupation
		? calculateOccupationSkillPoints(
				occupation.skillPointFormula,
				char.characteristics.values,
				char.occupation?.formulaChoices
			)
		: 0;
	const totalPersonalPoints = calculatePersonalInterestPoints(char.characteristics.values.int);

	const requiredOccSkillIds = new Set(occupation?.occupationSkills.map((s) => s.skillId) ?? []);

	// All allocatable skills (exclude Cthulhu Mythos)
	const allSkills = data.skills.filter((s) => !s.noPointAllocation && s.eras.some((era) => era === 'all' || era === char.era));
	const combatSkills = [
		...getSkillsByGroup('fighting', allSkills),
		...getSkillsByGroup('firearms', allSkills)
	];
	const scienceSkills = getSkillsByGroup('science', allSkills);

	// Track point allocations per skill: { skillId: { occupation: number, personal: number } }
	type PointMap = Record<string, { occupation: number; personal: number }>;

	// Initialize from existing character data or empty
	let pointAllocations = $state<PointMap>(initializeFromCharacter());
	let selectedInterpersonal = $state<string[]>(initialChoiceIds('interpersonal'));
	let selectedCombat = $state<string[]>(initialChoiceIds('combat'));
	let selectedScience = $state<string[]>(initialChoiceIds('science'));
	let selectedAny = $state<string[]>(initialChoiceIds('any'));

	let eligibleOccupationSkillIds = $derived.by(() => {
		const ids = new Set(requiredOccSkillIds);
		ids.add('credit-rating');
		for (const id of selectedInterpersonal) ids.add(id);
		for (const id of selectedCombat) ids.add(id);
		for (const id of selectedScience) ids.add(id);
		for (const id of selectedAny) ids.add(id);
		return ids;
	});

	function initializeFromCharacter(): PointMap {
		const map: PointMap = {};
		for (const skill of char.skills) {
			const occ = skill.allocations.find((a) => a.source === 'occupation');
			const pi = skill.allocations.find((a) => a.source === 'personal-interest');
			map[skill.skillId] = {
				occupation: occ?.points ?? 0,
				personal: pi?.points ?? 0
			};
		}
		return map;
	}

	function initialChoiceIds(kind: 'interpersonal' | 'combat' | 'science' | 'any'): string[] {
		const existing = char.skills
			.filter((skill) => skill.isOccupation && !requiredOccSkillIds.has(skill.skillId) && skill.skillId !== 'credit-rating')
			.map((skill) => skill.skillId);
		if (kind === 'interpersonal') return existing.filter((id) => INTERPERSONAL_SKILLS.includes(id)).slice(0, occupation?.interpersonalChoiceCount ?? 0);
		if (kind === 'combat') return existing.filter((id) => combatSkills.some((skill) => skill.id === id)).slice(0, occupation?.combatChoiceCount ?? 0);
		if (kind === 'science') return existing.filter((id) => scienceSkills.some((skill) => skill.id === id)).slice(0, occupation?.scienceChoiceCount ?? 0);
		const reserved = new Set([
			...initialChoiceIds('interpersonal'),
			...initialChoiceIds('combat'),
			...initialChoiceIds('science')
		]);
		return existing.filter((id) => !reserved.has(id)).slice(0, occupation?.personalChoiceCount ?? 0);
	}

	function getAlloc(skillId: string) {
		return pointAllocations[skillId] ?? { occupation: 0, personal: 0 };
	}

	function getBase(skill: CoCSkillDefinition): number {
		return resolveSkillBaseValue(skill, char.characteristics.values);
	}

	function getTotal(skill: CoCSkillDefinition): number {
		const alloc = getAlloc(skill.id);
		return getBase(skill) + alloc.occupation + alloc.personal;
	}

	// Point tracking
	let usedOccPoints = $derived(
		Object.values(pointAllocations).reduce((sum, a) => sum + a.occupation, 0)
	);
	let usedPersonalPoints = $derived(
		Object.values(pointAllocations).reduce((sum, a) => sum + a.personal, 0)
	);
	let remainingOcc = $derived(totalOccPoints - usedOccPoints);
	let remainingPersonal = $derived(totalPersonalPoints - usedPersonalPoints);

	// Skill filter/search
	let searchQuery = $state('');
	let showCategory = $state<string>('all');

	const categories = [
		{ id: 'all', label: 'All' },
		{ id: 'occupation', label: 'Occupation' },
		{ id: 'combat', label: 'Combat' },
		{ id: 'investigation', label: 'Investigation' },
		{ id: 'social', label: 'Social' },
		{ id: 'academic', label: 'Academic' },
		{ id: 'practical', label: 'Practical' },
		{ id: 'other', label: 'Other' }
	];

	let filteredSkills = $derived.by(() => {
		let skills = allSkills;
		if (showCategory === 'occupation') {
			skills = skills.filter((s) => eligibleOccupationSkillIds.has(s.id));
		} else if (showCategory !== 'all') {
			skills = skills.filter((s) => s.category === showCategory);
		}
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			skills = skills.filter((s) => s.name.toLowerCase().includes(q));
		}
		return skills;
	});

	function setOccPoints(skillId: string, value: number) {
		if (!eligibleOccupationSkillIds.has(skillId)) return;
		const alloc = getAlloc(skillId);
		const diff = value - alloc.occupation;
		if (diff > remainingOcc) return; // can't overspend
		alloc.occupation = Math.max(0, value);
		pointAllocations = { ...pointAllocations };
	}

	function setPersonalPoints(skillId: string, value: number) {
		const alloc = getAlloc(skillId);
		const diff = value - alloc.personal;
		if (diff > remainingPersonal) return;
		alloc.personal = Math.max(0, value);
		pointAllocations = { ...pointAllocations };
	}

	function buildSkillAllocations(): CoCSkillAllocation[] {
		const result: CoCSkillAllocation[] = [];
		for (const skill of allSkills) {
			const alloc = getAlloc(skill.id);
			if (alloc.occupation === 0 && alloc.personal === 0 && !eligibleOccupationSkillIds.has(skill.id)) continue;

			const allocations: SkillPointAllocation[] = [];
			if (alloc.occupation > 0) {
				allocations.push({
					points: alloc.occupation,
					source: 'occupation',
					sourceLabel: occupation?.name ?? 'Occupation'
				});
			}
			if (alloc.personal > 0) {
				allocations.push({
					points: alloc.personal,
					source: 'personal-interest',
					sourceLabel: 'Personal Interest'
				});
			}

			const base = getBase(skill);
			result.push(createSkillAllocation(skill.id, base, allocations, eligibleOccupationSkillIds.has(skill.id)));
		}
		return result;
	}

	function toggleChoice(list: string[], id: string, limit: number): string[] {
		if (list.includes(id)) return list.filter((existing) => existing !== id);
		if (list.length >= limit) return list;
		return [...list, id];
	}

	function setOccChoice(kind: 'interpersonal' | 'combat' | 'science' | 'any', id: string, limit: number) {
		if (kind === 'interpersonal') selectedInterpersonal = toggleChoice(selectedInterpersonal, id, limit);
		if (kind === 'combat') selectedCombat = toggleChoice(selectedCombat, id, limit);
		if (kind === 'science') selectedScience = toggleChoice(selectedScience, id, limit);
		if (kind === 'any') selectedAny = toggleChoice(selectedAny, id, limit);
	}

	let validation = $derived(
		occupation
			? validateSkillAllocation(
					buildSkillAllocations(),
					totalOccPoints,
					totalPersonalPoints,
					occupation.creditRating,
					eligibleOccupationSkillIds
				)
			: null
	);

	let choiceErrors = $derived.by(() => {
		const errors: string[] = [];
		if ((occupation?.interpersonalChoiceCount ?? 0) !== selectedInterpersonal.length) {
			errors.push(`Choose ${occupation?.interpersonalChoiceCount} interpersonal skill${occupation?.interpersonalChoiceCount === 1 ? '' : 's'}.`);
		}
		if ((occupation?.combatChoiceCount ?? 0) !== selectedCombat.length) {
			errors.push(`Choose ${occupation?.combatChoiceCount} combat skill${occupation?.combatChoiceCount === 1 ? '' : 's'}.`);
		}
		if ((occupation?.scienceChoiceCount ?? 0) !== selectedScience.length) {
			errors.push(`Choose ${occupation?.scienceChoiceCount} science skill${occupation?.scienceChoiceCount === 1 ? '' : 's'}.`);
		}
		if ((occupation?.personalChoiceCount ?? 0) !== selectedAny.length) {
			errors.push(`Choose ${occupation?.personalChoiceCount} additional occupation skill${occupation?.personalChoiceCount === 1 ? '' : 's'}.`);
		}
		return errors;
	});

	let canProceed = $derived(Boolean(validation?.valid && choiceErrors.length === 0));

	function proceed() {
		if (!canProceed) return;
		wizard.updateCharacter((c) => ({
			...c,
			skills: buildSkillAllocations()
		}));
		wizard.completeStep(2);
		goto(WIZARD_STEPS[3].path);
	}
</script>

{#if occupation}
<div class="space-y-6">
	<div>
		<h2 class="text-2xl font-bold" data-heading>Skills</h2>
		<p class="mt-1 text-sm text-[var(--color-muted-foreground)]">
			Allocate skill points from your occupation and personal interests.
		</p>
	</div>

	<!-- Point budget display -->
	<div class="grid grid-cols-2 gap-4">
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
			<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Occupation Points</span>
			<p class="text-lg font-bold">
				<span class={remainingOcc < 0 ? 'text-[var(--color-destructive)]' : remainingOcc === 0 ? 'text-[var(--color-primary)]' : ''}>
					{remainingOcc}
				</span>
				<span class="text-sm font-normal text-[var(--color-muted-foreground)]">/ {totalOccPoints}</span>
			</p>
		</div>
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
			<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Personal Interest Points</span>
			<p class="text-lg font-bold">
				<span class={remainingPersonal < 0 ? 'text-[var(--color-destructive)]' : remainingPersonal === 0 ? 'text-[var(--color-primary)]' : ''}>
					{remainingPersonal}
				</span>
				<span class="text-sm font-normal text-[var(--color-muted-foreground)]">/ {totalPersonalPoints}</span>
			</p>
		</div>
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-2">
		{#each categories as cat}
			<button
				onclick={() => (showCategory = cat.id)}
				class="rounded-full px-3 py-1 text-xs font-medium transition-colors
					{showCategory === cat.id
						? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
						: 'border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]'}"
			>
				{cat.label}
			</button>
		{/each}
		<input
			type="text"
			placeholder="Search..."
			bind:value={searchQuery}
			class="ml-auto rounded-md border border-[var(--color-border)] bg-[var(--color-card)]
				px-3 py-1 text-sm placeholder:text-[var(--color-muted-foreground)]
				focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
		/>
	</div>

	<!-- Occupation choice slots -->
	{#if (occupation.interpersonalChoiceCount ?? 0) > 0 || (occupation.combatChoiceCount ?? 0) > 0 || (occupation.scienceChoiceCount ?? 0) > 0 || (occupation.personalChoiceCount ?? 0) > 0}
		<div class="space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
			<h3 class="text-sm font-semibold" data-heading>Occupation Skill Choices</h3>
			{#if (occupation.interpersonalChoiceCount ?? 0) > 0}
				<div>
					<p class="mb-1 text-xs uppercase text-[var(--color-muted-foreground)]">Interpersonal ({selectedInterpersonal.length}/{occupation.interpersonalChoiceCount})</p>
					<div class="flex flex-wrap gap-1">
						{#each allSkills.filter((s) => INTERPERSONAL_SKILLS.includes(s.id)) as skill}
							<button onclick={() => setOccChoice('interpersonal', skill.id, occupation.interpersonalChoiceCount ?? 0)}
								class="rounded border px-2 py-1 text-xs {selectedInterpersonal.includes(skill.id) ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border)]'}">
								{skill.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{#if (occupation.combatChoiceCount ?? 0) > 0}
				<div>
					<p class="mb-1 text-xs uppercase text-[var(--color-muted-foreground)]">Combat ({selectedCombat.length}/{occupation.combatChoiceCount})</p>
					<div class="flex flex-wrap gap-1">
						{#each combatSkills as skill}
							<button onclick={() => setOccChoice('combat', skill.id, occupation.combatChoiceCount ?? 0)}
								class="rounded border px-2 py-1 text-xs {selectedCombat.includes(skill.id) ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border)]'}">
								{skill.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{#if (occupation.scienceChoiceCount ?? 0) > 0}
				<div>
					<p class="mb-1 text-xs uppercase text-[var(--color-muted-foreground)]">Science ({selectedScience.length}/{occupation.scienceChoiceCount})</p>
					<div class="flex flex-wrap gap-1">
						{#each scienceSkills as skill}
							<button onclick={() => setOccChoice('science', skill.id, occupation.scienceChoiceCount ?? 0)}
								class="rounded border px-2 py-1 text-xs {selectedScience.includes(skill.id) ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border)]'}">
								{skill.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{#if (occupation.personalChoiceCount ?? 0) > 0}
				<div>
					<p class="mb-1 text-xs uppercase text-[var(--color-muted-foreground)]">Additional ({selectedAny.length}/{occupation.personalChoiceCount})</p>
					<div class="flex flex-wrap gap-1">
						{#each allSkills.filter((s) => !requiredOccSkillIds.has(s.id) && s.id !== 'credit-rating') as skill}
							<button onclick={() => setOccChoice('any', skill.id, occupation.personalChoiceCount ?? 0)}
								class="rounded border px-2 py-1 text-xs {selectedAny.includes(skill.id) ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border)]'}">
								{skill.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if choiceErrors.length > 0 || validation?.errors.length}
		<div class="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-3 text-sm text-[var(--color-warning)]">
			<ul class="space-y-1">
				{#each choiceErrors as error}
					<li>{error}</li>
				{/each}
				{#each validation?.errors ?? [] as error}
					<li>{error}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Skills table -->
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted-foreground)]">
					<th class="pb-2 pr-2">Skill</th>
					<th class="pb-2 pr-2 text-center w-14">Base</th>
					<th class="pb-2 pr-2 text-center w-20">Occ. Pts</th>
					<th class="pb-2 pr-2 text-center w-20">Pers. Pts</th>
					<th class="pb-2 pr-2 text-center w-14">Total</th>
					<th class="pb-2 pr-2 text-center w-14">Half</th>
					<th class="pb-2 text-center w-14">Fifth</th>
				</tr>
			</thead>
			<tbody>
				{#each filteredSkills as skill (skill.id)}
					{@const base = getBase(skill)}
					{@const alloc = getAlloc(skill.id)}
					{@const total = base + alloc.occupation + alloc.personal}
					{@const isOcc = eligibleOccupationSkillIds.has(skill.id)}
					<tr class="border-b border-[var(--color-border)]/30 {isOcc ? 'bg-[var(--color-accent)]/30' : ''}">
						<td class="py-1.5 pr-2">
							<span class="font-medium">{skill.name}</span>
							{#if isOcc}
								<span class="ml-1 rounded bg-[var(--color-primary)]/20 px-1 text-[10px] text-[var(--color-primary)]">OCC</span>
							{/if}
						</td>
						<td class="py-1.5 pr-2 text-center text-[var(--color-muted-foreground)]">{base}</td>
						<td class="py-1.5 pr-2 text-center">
							<input
								type="number"
								min="0"
								max="99"
								value={alloc.occupation}
								disabled={!isOcc}
								oninput={(e) => setOccPoints(skill.id, parseInt((e.currentTarget as HTMLInputElement).value) || 0)}
								class="w-16 rounded border border-[var(--color-border)] bg-[var(--color-card)]
									px-1.5 py-0.5 text-center text-sm
									focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)] disabled:opacity-30"
							/>
						</td>
						<td class="py-1.5 pr-2 text-center">
							<input
								type="number"
								min="0"
								max="99"
								value={alloc.personal}
								oninput={(e) => setPersonalPoints(skill.id, parseInt((e.currentTarget as HTMLInputElement).value) || 0)}
								class="w-16 rounded border border-[var(--color-border)] bg-[var(--color-card)]
									px-1.5 py-0.5 text-center text-sm
									focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
							/>
						</td>
						<td class="py-1.5 pr-2 text-center font-bold {total > 89 ? 'text-[var(--color-warning)]' : ''}">{total}</td>
						<td class="py-1.5 pr-2 text-center text-[var(--color-muted-foreground)]">{halfValue(total)}</td>
						<td class="py-1.5 text-center text-[var(--color-muted-foreground)]">{fifthValue(total)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Navigation -->
	<div class="flex justify-between pt-4">
		<a
			href={WIZARD_STEPS[1].path}
			class="rounded-md border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium
				text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-accent)]"
		>
			&larr; Occupation
		</a>
		<button
			onclick={proceed}
			disabled={!canProceed}
			class="rounded-md bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium
				text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Next: Backstory &rarr;
		</button>
	</div>
</div>
{:else}
<p class="py-8 text-center text-[var(--color-muted-foreground)]">Please select an occupation first.</p>
{/if}
