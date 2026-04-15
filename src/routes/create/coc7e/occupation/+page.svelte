<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import { filterOccupationsByEra, getOccupationSkillLists, INTERPERSONAL_SKILLS } from '$lib/engine/occupation-filter';
	import { calculateOccupationSkillPoints, calculatePersonalInterestPoints } from '$lib/engine/skills';
	import { CHARACTERISTIC_LABELS } from '$lib/types/common';
	import type { CharacteristicId } from '$lib/types/common';
	import type { CoCContentPack, CoCOccupationDefinition, CoCSkillDefinition, SkillPointFormula } from '$lib/types/content-pack';

	const data = page.data as {
		contentPack: CoCContentPack;
		skills: CoCSkillDefinition[];
		occupations: CoCOccupationDefinition[];
	};

	const occupations = filterOccupationsByEra(data.occupations, $wizard.character.era);
	const skillMap = new Map(data.skills.map((s) => [s.id, s]));

	let searchQuery = $state('');
	let selectedOccupation = $state<CoCOccupationDefinition | null>(
		$wizard.character.occupation
			? occupations.find((o) => o.id === $wizard.character.occupation?.occupationId) ?? null
			: null
	);
	let formulaChoices = $state<Record<string, CharacteristicId>>(
		$wizard.character.occupation?.formulaChoices ?? {}
	);

	// Filtered occupations
	let filteredOccupations = $derived(
		searchQuery
			? occupations.filter((o) => o.name.toLowerCase().includes(searchQuery.toLowerCase()))
			: occupations
	);

	// Selected occupation details
	let selectedSkillLists = $derived(
		selectedOccupation ? getOccupationSkillLists(selectedOccupation, data.skills) : null
	);

	let occupationPoints = $derived(
		selectedOccupation
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

	function selectOccupation(occ: CoCOccupationDefinition) {
		selectedOccupation = occ;
		formulaChoices = {};
	}

	async function proceed() {
		if (!selectedOccupation) return;

		wizard.updateCharacter((c) => ({
			...c,
			occupation: {
				occupationId: selectedOccupation!.id,
				formulaChoices: { ...formulaChoices }
			}
		}));
		wizard.completeStep(1);
		await goto(WIZARD_STEPS[2].path);
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-2xl font-bold" data-heading>Occupation</h2>
		<p class="mt-1 text-sm text-[var(--color-muted-foreground)]">
			Choose your investigator's occupation. This determines your occupation skill points
			({occupationPoints} pts) and which skills you can invest them in.
			You also have {personalInterestPoints} personal interest points (INT &times; 2).
		</p>
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
		</div>

		<!-- Occupation detail panel -->
		{#if selectedOccupation}
			<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4 space-y-4">
				<h3 class="text-xl font-bold" data-heading>{selectedOccupation.name}</h3>

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
		<button
			onclick={proceed}
			disabled={!selectedOccupation}
			class="rounded-md bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium
				text-[var(--color-primary-foreground)] transition-colors
				hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Next: Allocate Skills &rarr;
		</button>
	</div>
</div>
