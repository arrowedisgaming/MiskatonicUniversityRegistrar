<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import { ALL_CHARACTERISTICS, CHARACTERISTIC_LABELS } from '$lib/types/common';
	import { halfValue, fifthValue } from '$lib/engine/characteristics';
	import type { CoCOccupationDefinition } from '$lib/types/content-pack';

	const data = page.data as {
		occupations: CoCOccupationDefinition[];
	};

	const char = $wizard.character;
	const occupation = data.occupations.find((o) => o.id === char.occupation?.occupationId);

	// Validation
	let warnings = $derived.by(() => {
		const w: string[] = [];
		if (!char.name.trim()) w.push('Investigator has no name.');
		if (!char.occupation) w.push('No occupation selected.');
		if (char.skills.length === 0) w.push('No skill points allocated.');
		if (char.derivedStats.luck.max === 0) w.push('Luck has not been rolled.');
		const cr = char.skills.find((s) => s.skillId === 'credit-rating');
		if (cr && occupation) {
			if (cr.total < occupation.creditRating.min)
				w.push(`Credit Rating (${cr.total}) below occupation minimum (${occupation.creditRating.min}).`);
			if (cr.total > occupation.creditRating.max)
				w.push(`Credit Rating (${cr.total}) above occupation maximum (${occupation.creditRating.max}).`);
		}
		return w;
	});

	// Skills grouped by occupation vs personal
	let occSkills = $derived(char.skills.filter((s) => s.isOccupation).sort((a, b) => b.total - a.total));
	let otherSkills = $derived(char.skills.filter((s) => !s.isOccupation && s.allocations.length > 0).sort((a, b) => b.total - a.total));

	let saving = $state(false);
	let saveError = $state<string | null>(null);

	async function saveInvestigator() {
		saving = true;
		saveError = null;

		// Build the final character with isDraft: false, but don't mutate wizard state yet
		const finalCharacter = { ...$wizard.character, isDraft: false, wizardStep: 6 };

		try {
			const response = await fetch('/api/investigators', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ character: finalCharacter })
			});

			if (!response.ok) {
				if (response.status === 401) {
					goto(`/login?callbackUrl=${encodeURIComponent('/create/coc7e/review')}`);
					return;
				}
				saveError = 'Failed to save investigator. Please try again.';
				saving = false;
				return;
			}

			const { id } = (await response.json()) as { id: string };
			// Only update wizard state after successful save
			wizard.completeStep(5);
			wizard.reset();
			goto(`/sheet/${id}`);
		} catch {
			saveError = 'Failed to save investigator. Please try again.';
			saving = false;
		}
	}
</script>

<div class="space-y-8">
	<div>
		<h2 class="text-2xl font-bold" data-heading>Review Investigator</h2>
		<p class="mt-1 text-sm text-[var(--color-muted-foreground)]">
			Review your investigator before saving. You can go back to any step to make changes.
		</p>
	</div>

	<!-- Warnings -->
	{#if warnings.length > 0}
		<div class="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-4">
			<h3 class="mb-2 text-sm font-semibold text-[var(--color-warning)]">Warnings</h3>
			<ul class="space-y-1 text-sm text-[var(--color-warning)]">
				{#each warnings as warning}
					<li>&#x26A0; {warning}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Header: Name & Occupation -->
	<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
		<h3 class="text-2xl font-bold" data-heading>{char.name || 'Unnamed Investigator'}</h3>
		<p class="text-sm text-[var(--color-muted-foreground)]">
			{occupation?.name ?? 'No occupation'} &middot;
			Age {char.age} &middot;
			{char.era} Era
		</p>
		{#if char.gender || char.pronouns}
			<p class="text-xs text-[var(--color-muted-foreground)]">
				{[char.gender, char.pronouns].filter(Boolean).join(' &middot; ')}
			</p>
		{/if}
		{#if char.residence || char.birthplace}
			<p class="text-xs text-[var(--color-muted-foreground)]">
				{char.residence ? `Lives in ${char.residence}` : ''}
				{char.residence && char.birthplace ? ' · ' : ''}
				{char.birthplace ? `Born in ${char.birthplace}` : ''}
			</p>
		{/if}
	</div>

	<!-- Characteristics & Derived Stats -->
	<div class="grid gap-6 lg:grid-cols-2">
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h3 class="mb-3 font-semibold" data-heading>Characteristics</h3>
			<div class="grid grid-cols-4 gap-2 text-center text-sm">
				{#each ALL_CHARACTERISTICS as charId}
					{@const v = char.characteristics.values[charId]}
					<div class="rounded-md border border-[var(--color-border)]/50 p-2">
						<span class="block text-xs uppercase text-[var(--color-muted-foreground)]">{charId}</span>
						<span class="block text-xl font-bold">{v}</span>
						<span class="block text-xs text-[var(--color-muted-foreground)]">{halfValue(v)} / {fifthValue(v)}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h3 class="mb-3 font-semibold" data-heading>Derived Attributes</h3>
			<div class="grid grid-cols-2 gap-3 text-sm">
				<div class="flex justify-between border-b border-[var(--color-border)]/30 pb-1">
					<span class="text-[var(--color-muted-foreground)]">Hit Points</span>
					<span class="font-bold">{char.derivedStats.hp.max}</span>
				</div>
				<div class="flex justify-between border-b border-[var(--color-border)]/30 pb-1">
					<span class="text-[var(--color-muted-foreground)]">Magic Points</span>
					<span class="font-bold">{char.derivedStats.mp.max}</span>
				</div>
				<div class="flex justify-between border-b border-[var(--color-border)]/30 pb-1">
					<span class="text-[var(--color-muted-foreground)]">Sanity</span>
					<span class="font-bold">{char.derivedStats.sanity.current}</span>
				</div>
				<div class="flex justify-between border-b border-[var(--color-border)]/30 pb-1">
					<span class="text-[var(--color-muted-foreground)]">Luck</span>
					<span class="font-bold">{char.derivedStats.luck.max}</span>
				</div>
				<div class="flex justify-between border-b border-[var(--color-border)]/30 pb-1">
					<span class="text-[var(--color-muted-foreground)]">Damage Bonus</span>
					<span class="font-bold">{char.derivedStats.damageBonus}</span>
				</div>
				<div class="flex justify-between border-b border-[var(--color-border)]/30 pb-1">
					<span class="text-[var(--color-muted-foreground)]">Build</span>
					<span class="font-bold">{char.derivedStats.build}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-[var(--color-muted-foreground)]">Move Rate</span>
					<span class="font-bold">{char.derivedStats.moveRate}</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Skills -->
	{#if char.skills.length > 0}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h3 class="mb-3 font-semibold" data-heading>Skills</h3>

			{#if occSkills.length > 0}
				<h4 class="mb-1 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Occupation Skills</h4>
				<div class="mb-3 grid gap-1 sm:grid-cols-2">
					{#each occSkills as skill}
						<div class="flex justify-between text-sm">
							<span>{skill.skillId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</span>
							<span class="font-bold">{skill.total}%
								<span class="text-xs font-normal text-[var(--color-muted-foreground)]">({skill.half}/{skill.fifth})</span>
							</span>
						</div>
					{/each}
				</div>
			{/if}

			{#if otherSkills.length > 0}
				<h4 class="mb-1 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Personal Interest Skills</h4>
				<div class="grid gap-1 sm:grid-cols-2">
					{#each otherSkills as skill}
						<div class="flex justify-between text-sm">
							<span>{skill.skillId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</span>
							<span class="font-bold">{skill.total}%
								<span class="text-xs font-normal text-[var(--color-muted-foreground)]">({skill.half}/{skill.fifth})</span>
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Backstory -->
	{#if Object.values(char.backstory).some((v) => v.trim())}
		{@const backstoryEntries = Object.entries(char.backstory).filter(([, v]) => v.trim())}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h3 class="mb-3 font-semibold" data-heading>Backstory</h3>
			<div class="space-y-2 text-sm">
				{#each backstoryEntries as [key, value]}
					<div>
						<span class="text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">
							{key.replace(/([A-Z])/g, ' $1').trim()}
						</span>
						<p>{value}</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Equipment -->
	{#if char.equipment.items.length > 0 || char.equipment.weapons.length > 0}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h3 class="mb-3 font-semibold" data-heading>Equipment &amp; Finances</h3>
			<p class="mb-2 text-sm">
				<span class="text-[var(--color-muted-foreground)]">Living Standard:</span> {char.equipment.livingStandard}
				&middot; <span class="text-[var(--color-muted-foreground)]">Spending Level:</span> ${char.equipment.spendingLevel.toLocaleString()}
				&middot; <span class="text-[var(--color-muted-foreground)]">Cash:</span> ${char.equipment.cash.toLocaleString()}
				&middot; <span class="text-[var(--color-muted-foreground)]">Assets:</span> {char.equipment.assetsLabel}
			</p>

			{#if char.equipment.weapons.length > 0}
				<h4 class="mt-2 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Weapons</h4>
				<ul class="text-sm">
					{#each char.equipment.weapons as weapon}
						<li>{weapon.name} — {weapon.damage} ({weapon.range})</li>
					{/each}
				</ul>
			{/if}

			{#if char.equipment.items.length > 0}
				<h4 class="mt-2 text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">Items</h4>
				<p class="text-sm">{char.equipment.items.map((i) => i.name).join(', ')}</p>
			{/if}
		</div>
	{/if}

	<!-- Navigation -->
	<div class="flex justify-between pt-4">
		<a
			href={WIZARD_STEPS[4].path}
			class="rounded-md border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium
				text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-accent)]"
		>
			&larr; Equipment
		</a>
		<div class="flex items-center gap-3">
			{#if saveError}
				<span class="text-sm text-[var(--color-destructive)]">{saveError}</span>
			{/if}
			<button
				onclick={saveInvestigator}
				disabled={saving}
				class="rounded-md bg-[var(--color-primary)] px-8 py-2.5 text-sm font-semibold
					text-[var(--color-primary-foreground)] transition-colors hover:opacity-90
					disabled:opacity-50"
			>
				{saving ? 'Saving...' : 'Save Investigator'}
			</button>
		</div>
	</div>
</div>
