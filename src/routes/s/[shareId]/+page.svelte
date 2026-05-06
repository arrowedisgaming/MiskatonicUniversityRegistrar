<script lang="ts">
	import type { PageProps } from './$types';
	import SheetReadOnly from '$lib/components/investigator/SheetReadOnly.svelte';
	import PDFExportButton from '$lib/components/investigator/PDFExportButton.svelte';

	let { data }: PageProps = $props();

	const character = $derived(data.character);
	const occupation = $derived(
		data.occupations.find((o) => o.id === character.occupation?.occupationId)
	);
</script>

<svelte:head>
	<title>{character.name || 'Investigator'} — Miskatonic University Registrar</title>
	<!-- Discourage indexing of shared sheets so unlisted links stay unlisted. -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 px-4 py-6">
	<aside
		class="rounded-md border border-[var(--color-border)] bg-[var(--color-accent)]/30 px-4 py-3 text-sm"
		aria-label="Shared investigator notice"
	>
		<p class="font-semibold">Shared investigator (read-only)</p>
		<p class="text-xs text-[var(--color-muted-foreground)]">
			You are viewing a shared investigator. The owner can revoke this link at any time.
		</p>
	</aside>

	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="min-w-[16rem]">
			<h1 class="text-3xl font-bold" data-heading>{character.name || 'Unnamed Investigator'}</h1>
			<p class="text-sm text-[var(--color-muted-foreground)]">
				{occupation?.name ?? 'No occupation'} &middot; Age {character.age} &middot; {character.era}
			</p>
			{#if character.residence}
				<p class="text-xs text-[var(--color-muted-foreground)]">Residence: {character.residence}</p>
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			<PDFExportButton
				{character}
				occupationName={occupation?.name ?? 'Unknown'}
				skills={data.skills}
				occupations={data.occupations}
				contentPack={data.contentPack}
			/>
		</div>
	</div>

	<SheetReadOnly {character} skills={data.skills} occupations={data.occupations} />
</div>
