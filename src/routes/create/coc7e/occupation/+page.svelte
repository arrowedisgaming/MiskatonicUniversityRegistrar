<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import { filterOccupationsByEra, getOccupationSkillLists, INTERPERSONAL_SKILLS, isCustomOccupation } from '$lib/engine/occupation-filter';
	import { calculateOccupationSkillPoints, calculatePersonalInterestPoints } from '$lib/engine/skills';
	import { CHARACTERISTIC_LABELS } from '$lib/types/common';
	import type { CharacteristicId } from '$lib/types/common';
	import type { CoCContentPack, CoCOccupationDefinition, CoCSkillDefinition, SkillPointFormula } from '$lib/types/content-pack';

	const data = page.data as {
		contentPack: CoCContentPack;
		skills: CoCSkillDefinition[];
		occupations: CoCOccupationDefinition[];
	};

	const skillMap = new Map(data.skills.map((s) => [s.id, s]));

	const savedOccupation = $wizard.character.occupation;
	const savedIsCustom = savedOccupation ? isCustomOccupation(savedOccupation.occupationId) : false;

	let selectedEra = $state<string>($wizard.character.era);
	let searchQuery = $state('');
	let selectedOccupation = $state<CoCOccupationDefinition | null>(
		savedOccupation && !savedIsCustom
			? data.occupations.find((o) => o.id === savedOccupation.occupationId) ?? null
			: null
	);
	let formulaChoices = $state<Record<string, CharacteristicId>>(
		savedOccupation?.formulaChoices ?? {}
	);
	let isCustomSelected = $state(savedIsCustom);
	let customName = $state(savedOccupation?.customName ?? '');
	let customSkillPoints = $state<number>(savedOccupation?.customSkillPoints ?? 0);
	let customOccupationSkills = $state<string[]>(savedOccupation?.customOccupationSkills ?? []);
	let skillPickerSearch = $state('');

	// Era-appropriate, allocatable skills for the occupation-skill picker
	const pickerSkills = $derived(
		data.skills
			.filter((s) => !s.noPointAllocation && (s.eras.includes('all') || s.eras.includes(selectedEra)))
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	const filteredPickerSkills = $derived(
		skillPickerSearch.trim()
			? pickerSkills.filter((s) => s.name.toLowerCase().includes(skillPickerSearch.toLowerCase()))
			: pickerSkills
	);
	const customOccSkillSet = $derived(new Set(customOccupationSkills));

	function toggleOccupationSkill(id: string) {
		if (customOccSkillSet.has(id)) {
			customOccupationSkills = customOccupationSkills.filter((s) => s !== id);
		} else {
			customOccupationSkills = [...customOccupationSkills, id];
		}
	}

	// Era-filtered occupations (reactive to selectedEra)
	let eraOccupations = $derived(filterOccupationsByEra(data.occupations, selectedEra));

	// Filtered occupations (custom occupation card always shown separately)
	let filteredOccupations = $derived(
		searchQuery
			? eraOccupations.filter((o) => o.name.toLowerCase().includes(searchQuery.toLowerCase()))
			: eraOccupations
	);

	function switchEra(eraId: string) {
		selectedEra = eraId;
		if (selectedOccupation && !filterOccupationsByEra([selectedOccupation], eraId).length) {
			selectedOccupation = null;
			formulaChoices = {};
		}
		if (isCustomSelected) {
			customOccupationSkills = [];
		}
	}

	function selectOccupation(occ: CoCOccupationDefinition) {
		selectedOccupation = occ;
		isCustomSelected = false;
		formulaChoices = {};
	}

	function selectCustomOccupation() {
		selectedOccupation = null;
		formulaChoices = {};
		isCustomSelected = true;
	}

	// Selected occupation details
	let selectedSkillLists = $derived(
		selectedOccupation ? getOccupationSkillLists(selectedOccupation, data.skills) : null
	);

	let occupationPoints = $derived(
		isCustomSelected
			? customSkillPoints
			: selectedOccupation
				? calculateOccupationSkillPoints(
						selectedOccupation.skillPointFormula,
						$wizard.character.characteristics.values,
						formulaChoices
					)
				: 0
	);

	let personalInterestPoints = $derived(
		calculatePersonalInterestPoints($wizard.character.characteristics.values.int)
	);

	let canProceed = $derived(selectedOccupation !== null || isCustomSelected);

	/** Format a skill point formula for display */
	function formatFormula(formula: SkillPointFormula): string {
		const parts: string[] = [];
		for (const term of formula.terms) {
			parts.push(`${CHARACTERISTIC_LABELS[term.characteristic]} &times; ${term.multiplier}`);
		}
		if (formula.choiceTerms) {
			for (const choice of formula.choiceTerms) {
				const options = choice.options.map((o) => CHARACTERISTIC_LABELS[o]).join(' or ');
				parts.push(`(${options}) &times; ${choice.multiplier}`);
			}
		}
		return parts.join(' + ');
	}

	async function proceed() {
		if (!canProceed) return;

		if (isCustomSelected) {
			wizard.updateCharacter((c) => ({
				...c,
				era: selectedEra as typeof c.era,
				occupation: {
					occupationId: 'custom',
					formulaChoices: {},
					customName: customName.trim() || 'Custom Occupation',
					customSkillPoints,
					customOccupationSkills: [...customOccupationSkills]
				}
			}));
		} else {
			wizard.updateCharacter((c) => ({
				...c,
				era: selectedEra as typeof c.era,
				occupation: {
					occupationId: selectedOccupation!.id,
					formulaChoices: { ...formulaChoices }
				}
			}));
		}
		wizard.completeStep(1);
		await goto(WIZARD_STEPS[2].path);
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold" data-heading>Occupation</h1>
		<p class="mt-1 text-sm text-[var(--color-muted-foreground)]">
			Choose your investigator's occupation. This determines your occupation skill points
			({occupationPoints} pts) and which skills you can invest them in.
			You also have {personalInterestPoints} personal interest points (INT &times; 2).
		</p>
	</div>

	<!-- Era filter chips -->
	<div class="flex flex-wrap gap-2">
		{#each data.contentPack.eras as era}
			<button
				type="button"
				onclick={() => switchEra(era.id)}
				class="rounded-full border px-3 py-1 text-xs font-medium transition-colors
					{selectedEra === era.id
						? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
						: 'border-[var(--color-border)] hover:bg-[var(--color-accent)]'}"
			>
				{era.name}
			</button>
		{/each}
	</div>

	<!-- Search -->
	<input
		type="text"
		placeholder="Search occupations..."
		bind:value={searchQuery}
		class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)]
			px-3 py-2 text-sm placeholder:text-[var(--color-muted-foreground)]
			focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
	/>

	<div class="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
		<!-- Occupation list -->
		<div class="max-h-[500px] space-y-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-2">
			{#each filteredOccupations as occ}
				{@const isSelected = selectedOccupation?.id === occ.id}
				<button
					type="button"
					onclick={() => selectOccupation(occ)}
					class="w-full rounded-md px-3 py-2 text-left text-sm transition-colors
						{isSelected
							? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
							: 'hover:bg-[var(--color-accent)]'}"
				>
					<span class="font-medium">{occ.name}</span>
				</button>
			{/each}
			{#if filteredOccupations.length === 0}
				<p class="p-4 text-center text-sm text-[var(--color-muted-foreground)]">No occupations match.</p>
			{/if}
			<!-- Custom Occupation always shown at bottom -->
			<div class="mt-1 border-t border-[var(--color-border)] pt-1">
				<button
					type="button"
					onclick={selectCustomOccupation}
					class="w-full rounded-md px-3 py-2 text-left text-sm transition-colors
						{isCustomSelected
							? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
							: 'hover:bg-[var(--color-accent)]'}"
				>
					<span class="font-medium">Custom Occupation</span>
					<span class="block text-xs opacity-70">Homebrew or supplement</span>
				</button>
			</div>
		</div>

		<!-- Custom occupation detail panel -->
		{#if isCustomSelected}
			<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4 space-y-4">
				<h2 class="text-xl font-bold" data-heading>Custom Occupation</h2>
				<p class="text-sm text-[var(--color-muted-foreground)]" data-flavor>
					Define your own occupation for homebrew or supplement material not yet integrated.
				</p>

				<div class="space-y-3">
					<div>
						<label for="custom-occ-name" class="block text-xs uppercase text-[var(--color-muted-foreground)] mb-1">
							Occupation Name
						</label>
						<input
							id="custom-occ-name"
							type="text"
							bind:value={customName}
							placeholder="e.g. Antiquarian, Cultist, Time Traveller"
							class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)]
								px-3 py-2 text-sm placeholder:text-[var(--color-muted-foreground)]
								focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
						/>
					</div>

					<div>
						<label for="custom-occ-points" class="block text-xs uppercase text-[var(--color-muted-foreground)] mb-1">
							Occupation Skill Points
						</label>
						<input
							id="custom-occ-points"
							type="number"
							min="0"
							max="9999"
							bind:value={customSkillPoints}
							placeholder="e.g. 240"
							class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)]
								px-3 py-2 text-sm placeholder:text-[var(--color-muted-foreground)]
								focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
						/>
						<p class="mt-1 text-xs text-[var(--color-muted-foreground)]">
							Standard occupations use EDU × 4 (160–320 pts). Enter the total from your source.
						</p>
					</div>

					<!-- Occupation skill tagger -->
					<div>
						<label for="custom-occ-skill-search" class="block text-xs uppercase text-[var(--color-muted-foreground)] mb-1">
							Occupation Skills <span class="normal-case font-normal">(optional)</span>
						</label>
						<p class="text-xs text-[var(--color-muted-foreground)] mb-2">
							Tag which skills belong to this occupation. Only tagged skills can receive occupation points. Leave empty to allow any skill.
						</p>

						{#if customOccupationSkills.length > 0}
							<div class="mb-2 flex flex-wrap gap-1">
								{#each customOccupationSkills as id (id)}
									<button
										type="button"
										onclick={() => toggleOccupationSkill(id)}
										aria-label="Remove {skillMap.get(id)?.name ?? id}"
										class="flex items-center gap-1 rounded-full bg-[var(--color-primary)]/15 px-2 py-0.5 text-xs
											text-[var(--color-primary)] hover:bg-[var(--color-destructive)]/15 hover:text-[var(--color-destructive)]"
									>
										{skillMap.get(id)?.name ?? id} <span aria-hidden="true">×</span>
									</button>
								{/each}
							</div>
						{/if}

						<input
							id="custom-occ-skill-search"
							type="text"
							placeholder="Search skills to tag…"
							bind:value={skillPickerSearch}
							class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)]
								px-3 py-1.5 text-sm placeholder:text-[var(--color-muted-foreground)]
								focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
						/>
						{#if skillPickerSearch.trim()}
							<div class="mt-1 max-h-52 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-card)]">
								{#each filteredPickerSkills as skill (skill.id)}
									<button
										type="button"
										aria-pressed={customOccSkillSet.has(skill.id)}
										onclick={() => toggleOccupationSkill(skill.id)}
										class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-[var(--color-accent)] text-left
											{customOccSkillSet.has(skill.id) ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : ''}"
									>
										<span aria-hidden="true" class="w-3 text-center text-xs">{customOccSkillSet.has(skill.id) ? '✓' : '+'}</span>
										{skill.name}
									</button>
								{/each}
								{#if filteredPickerSkills.length === 0}
									<p class="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">No matching skills</p>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				<p class="text-sm font-bold text-[var(--color-primary)]">
					= {customSkillPoints} occupation points + {personalInterestPoints} personal interest
				</p>
				<p class="text-xs text-[var(--color-muted-foreground)]">
					{#if customOccupationSkills.length > 0}
						Only the {customOccupationSkills.length} tagged skill{customOccupationSkills.length === 1 ? '' : 's'} can receive occupation points.
					{:else}
						In the next step, any skill can be funded with occupation points.
					{/if}
				</p>
			</div>
		<!-- Standard occupation detail panel -->
		{:else if selectedOccupation}
			<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4 space-y-4">
				<h2 class="text-xl font-bold" data-heading>{selectedOccupation.name}</h2>

				<!-- Credit Rating -->
				<div>
					<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Credit Rating</span>
					<p class="font-semibold">{selectedOccupation.creditRating.min} – {selectedOccupation.creditRating.max}</p>
				</div>

				<!-- Skill Point Formula -->
				<div>
					<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Skill Points</span>
					<p class="text-sm">{@html formatFormula(selectedOccupation.skillPointFormula)}</p>

					<!-- Formula choice selectors -->
					{#if selectedOccupation.skillPointFormula.choiceTerms}
						{#each selectedOccupation.skillPointFormula.choiceTerms as choice, i}
							<div class="mt-2 flex items-center gap-2">
								<span class="text-xs text-[var(--color-muted-foreground)]">Choose:</span>
								{#each choice.options as option}
									<button
										type="button"
										onclick={() => { formulaChoices[String(i)] = option; formulaChoices = { ...formulaChoices }; }}
										class="rounded px-2 py-1 text-xs font-medium transition-colors
											{formulaChoices[String(i)] === option
												? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
												: 'border border-[var(--color-border)] hover:bg-[var(--color-accent)]'}"
									>
										{CHARACTERISTIC_LABELS[option]}
										({$wizard.character.characteristics.values[option]})
									</button>
								{/each}
							</div>
						{/each}
					{/if}

					<p class="mt-1 text-lg font-bold text-[var(--color-primary)]">
						= {occupationPoints} points
					</p>
				</div>

				<!-- Occupation Skills -->
				{#if selectedSkillLists}
					<div>
						<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Occupation Skills</span>
						<ul class="mt-1 space-y-0.5 text-sm">
							{#each selectedSkillLists.required as skill}
								<li class="flex items-center gap-2">
									<span class="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]"></span>
									{skill.name}
									<span class="text-xs text-[var(--color-muted-foreground)]">({skill.baseValue}%)</span>
								</li>
							{/each}
						</ul>
					</div>

					<!-- Interpersonal choices -->
					{#if selectedOccupation.interpersonalChoiceCount}
						<p class="text-sm text-[var(--color-muted-foreground)]">
							+ Choose {selectedOccupation.interpersonalChoiceCount} interpersonal skill{selectedOccupation.interpersonalChoiceCount > 1 ? 's' : ''}
							(Charm, Fast Talk, Intimidate, or Persuade)
						</p>
					{/if}

					<!-- Combat choices -->
					{#if selectedOccupation.combatChoiceCount}
						<p class="text-sm text-[var(--color-muted-foreground)]">
							+ Choose {selectedOccupation.combatChoiceCount} combat skill{selectedOccupation.combatChoiceCount > 1 ? 's' : ''}
							(Fighting or Firearms specialization)
						</p>
					{/if}

					<!-- Personal choices -->
					{#if selectedOccupation.personalChoiceCount}
						<p class="text-sm text-[var(--color-muted-foreground)]">
							+ Choose {selectedOccupation.personalChoiceCount} additional skill{selectedOccupation.personalChoiceCount > 1 ? 's' : ''}
							of your choice
						</p>
					{/if}
				{/if}

				<!-- Suggested contacts -->
				{#if selectedOccupation.suggestedContacts}
					<div>
						<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Suggested Contacts</span>
						<p class="text-sm" data-flavor>{selectedOccupation.suggestedContacts}</p>
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex items-center justify-center rounded-md border border-dashed border-[var(--color-border)] p-8">
				<p class="text-sm text-[var(--color-muted-foreground)]" data-flavor>
					Select an occupation to see details...
				</p>
			</div>
		{/if}

	</div>

	<!-- Navigation -->
	<div class="flex justify-between pt-4">
		<a
			href={WIZARD_STEPS[0].path}
			class="rounded-md border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium
				text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-accent)]"
		>
			&larr; Characteristics
		</a>
		<div class="flex items-center gap-3">
			{#if !canProceed}
				<p id="proceed-hint" class="text-sm text-[var(--color-muted-foreground)]">Select an occupation to continue.</p>
			{/if}
			<button
				type="button"
				onclick={proceed}
				disabled={!canProceed}
				aria-describedby={!canProceed ? 'proceed-hint' : undefined}
				class="rounded-md bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium
					text-[var(--color-primary-foreground)] transition-colors
					hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Next: Allocate Skills &rarr;
			</button>
		</div>
	</div>
</div>
