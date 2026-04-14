<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import { getAgeModifier } from '$lib/engine/derived-stats';
	import type { CoCContentPack } from '$lib/types/content-pack';

	const data = page.data as { contentPack: CoCContentPack };

	// Identity fields
	let name = $state($wizard.character.name);
	let age = $state($wizard.character.age);
	let gender = $state($wizard.character.gender);
	let pronouns = $state($wizard.character.pronouns);
	let residence = $state($wizard.character.residence);
	let birthplace = $state($wizard.character.birthplace);

	// Backstory fields
	let ideologyBeliefs = $state($wizard.character.backstory.ideologyBeliefs);
	let significantPeople = $state($wizard.character.backstory.significantPeople);
	let meaningfulLocations = $state($wizard.character.backstory.meaningfulLocations);
	let treasuredPossessions = $state($wizard.character.backstory.treasuredPossessions);
	let traits = $state($wizard.character.backstory.traits);
	let injuriesScars = $state($wizard.character.backstory.injuriesScars);
	let phobiasManias = $state($wizard.character.backstory.phobiasManias);
	let arcaneTomesSpellsArtifacts = $state($wizard.character.backstory.arcaneTomesSpellsArtifacts);
	let encountersWithStrangeEntities = $state($wizard.character.backstory.encountersWithStrangeEntities);
	let keyConnection = $state($wizard.character.backstory.keyConnection);

	// Age modifier display
	let ageModifier = $derived(getAgeModifier(age, data.contentPack.ageModifiers));
	let ageWarning = $derived.by(() => {
		if (!ageModifier) return age < 15 ? 'Age must be at least 15.' : age > 89 ? 'Age cannot exceed 89.' : null;
		if (ageModifier.strConDexDeduction > 0 && ageModifier.minAge >= 40) {
			return `Age ${age}: Deduct ${ageModifier.strConDexDeduction} points from STR/CON/DEX (distributed), and ${ageModifier.appDeduction} from APP. ${ageModifier.eduImprovementChecks} EDU improvement check(s).`;
		}
		if (ageModifier.special === 'deduct-str-or-siz') {
			return `Age ${age}: Deduct 5 points from STR or SIZ. Luck: roll twice, use higher.`;
		}
		if (ageModifier.eduImprovementChecks > 0 && ageModifier.strConDexDeduction === 0) {
			return `Age ${age}: ${ageModifier.eduImprovementChecks} EDU improvement check(s). No stat penalties.`;
		}
		return null;
	});

	const backstoryFields = [
		{ key: 'ideologyBeliefs', label: 'Ideology/Beliefs', placeholder: 'What does your investigator believe in? Religious faith, political stance, philosophical outlook...' },
		{ key: 'significantPeople', label: 'Significant People', placeholder: 'Who matters most? A parent, lover, childhood friend, mentor...' },
		{ key: 'meaningfulLocations', label: 'Meaningful Locations', placeholder: 'Places of importance: childhood home, favorite bar, a hidden grove...' },
		{ key: 'treasuredPossessions', label: 'Treasured Possessions', placeholder: 'A family heirloom, a lucky charm, a photograph...' },
		{ key: 'traits', label: 'Traits', placeholder: 'Personality quirks, habits, mannerisms...' },
		{ key: 'injuriesScars', label: 'Injuries & Scars', placeholder: 'Old wounds, distinguishing marks...' },
		{ key: 'phobiasManias', label: 'Phobias & Manias', placeholder: 'What terrifies or obsesses your investigator?' },
		{ key: 'arcaneTomesSpellsArtifacts', label: 'Arcane Tomes, Spells & Artifacts', placeholder: 'Usually blank at creation. Acquired during play.' },
		{ key: 'encountersWithStrangeEntities', label: 'Encounters with Strange Entities', placeholder: 'Usually blank at creation. Filled in during play.' },
		{ key: 'keyConnection', label: 'Key Backstory Connection', placeholder: 'The link between your backstory elements — why these people, places, and beliefs matter together.' }
	] as const;

	// Bind backstory values to a map for easier access
	let backstoryValues: Record<string, string> = $state({
		ideologyBeliefs, significantPeople, meaningfulLocations, treasuredPossessions,
		traits, injuriesScars, phobiasManias, arcaneTomesSpellsArtifacts,
		encountersWithStrangeEntities, keyConnection
	});

	let canProceed = $derived(name.trim().length > 0 && age >= 15 && age <= 89);

	function proceed() {
		wizard.updateCharacter((c) => ({
			...c,
			name: name.trim(),
			age,
			gender,
			pronouns,
			residence,
			birthplace,
			backstory: {
				ideologyBeliefs: backstoryValues.ideologyBeliefs,
				significantPeople: backstoryValues.significantPeople,
				meaningfulLocations: backstoryValues.meaningfulLocations,
				treasuredPossessions: backstoryValues.treasuredPossessions,
				traits: backstoryValues.traits,
				injuriesScars: backstoryValues.injuriesScars,
				phobiasManias: backstoryValues.phobiasManias,
				arcaneTomesSpellsArtifacts: backstoryValues.arcaneTomesSpellsArtifacts,
				encountersWithStrangeEntities: backstoryValues.encountersWithStrangeEntities,
				keyConnection: backstoryValues.keyConnection
			}
		}));
		wizard.completeStep(3);
		goto(WIZARD_STEPS[4].path);
	}
</script>

<div class="space-y-8">
	<div>
		<h2 class="text-2xl font-bold" data-heading>Backstory &amp; Details</h2>
		<p class="mt-1 text-sm text-[var(--color-muted-foreground)]">
			Give your investigator a name, age, and backstory. These details bring them to life.
		</p>
	</div>

	<!-- Identity -->
	<div class="space-y-4">
		<h3 class="text-lg font-semibold" data-heading>Identity</h3>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label for="name" class="mb-1 block text-sm font-medium">Name <span class="text-[var(--color-destructive)]">*</span></label>
				<input id="name" type="text" bind:value={name} placeholder="Dr. Henry Armitage"
					class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm
						placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]" />
			</div>
			<div>
				<label for="age" class="mb-1 block text-sm font-medium">Age <span class="text-[var(--color-destructive)]">*</span></label>
				<input id="age" type="number" min="15" max="89" bind:value={age}
					class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm
						focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]" />
				{#if ageWarning}
					<p class="mt-1 text-xs text-[var(--color-warning)]">{ageWarning}</p>
				{/if}
			</div>
			<div>
				<label for="gender" class="mb-1 block text-sm font-medium">Gender</label>
				<input id="gender" type="text" bind:value={gender} placeholder="Male, Female, Non-binary..."
					class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm
						placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]" />
			</div>
			<div>
				<label for="pronouns" class="mb-1 block text-sm font-medium">Pronouns</label>
				<input id="pronouns" type="text" bind:value={pronouns} placeholder="he/him, she/her, they/them..."
					class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm
						placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]" />
			</div>
			<div>
				<label for="residence" class="mb-1 block text-sm font-medium">Residence</label>
				<input id="residence" type="text" bind:value={residence} placeholder="Arkham, Massachusetts"
					class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm
						placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]" />
			</div>
			<div>
				<label for="birthplace" class="mb-1 block text-sm font-medium">Birthplace</label>
				<input id="birthplace" type="text" bind:value={birthplace} placeholder="Dunwich, Massachusetts"
					class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm
						placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]" />
			</div>
		</div>
	</div>

	<!-- Backstory -->
	<div class="space-y-4">
		<h3 class="text-lg font-semibold" data-heading>Backstory</h3>
		<p class="text-sm text-[var(--color-muted-foreground)]" data-flavor>
			&ldquo;The most merciful thing in the world is the inability of the human mind to correlate all its contents.&rdquo;
		</p>

		{#each backstoryFields as field}
			<div>
				<label for={field.key} class="mb-1 block text-sm font-medium">{field.label}</label>
				<textarea
					id={field.key}
					bind:value={backstoryValues[field.key]}
					placeholder={field.placeholder}
					rows="2"
					class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm
						placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]
						resize-y"
				></textarea>
			</div>
		{/each}
	</div>

	<!-- Navigation -->
	<div class="flex justify-between pt-4">
		<a
			href={WIZARD_STEPS[2].path}
			class="rounded-md border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium
				text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-accent)]"
		>
			&larr; Skills
		</a>
		<button
			onclick={proceed}
			disabled={!canProceed}
			class="rounded-md bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium
				text-[var(--color-primary-foreground)] transition-colors
				hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Next: Equipment &rarr;
		</button>
	</div>
</div>
