<script lang="ts">
	import { page } from '$app/state';
	import type { CampaignSummary } from '$lib/server/campaign/campaign';

	const data = page.data as { campaigns: CampaignSummary[] };

	const keepering = $derived(data.campaigns.filter((c) => c.role === 'keeper'));
	const playing = $derived(data.campaigns.filter((c) => c.role === 'player'));
</script>

<svelte:head>
	<title>Campaigns — Miskatonic University Registrar</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
	<div class="mb-6 flex flex-wrap items-center gap-4">
		<h1 class="text-2xl font-bold" data-heading>Campaigns</h1>
		<a
			href="/campaigns/new"
			class="ml-auto rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium
				text-[var(--color-primary-foreground)] transition-colors hover:opacity-90"
		>
			+ New Campaign
		</a>
	</div>

	{#if data.campaigns.length === 0}
		<div class="rounded-md border border-dashed border-[var(--color-border)] p-12 text-center">
			<p class="mb-2 text-lg text-[var(--color-muted-foreground)]" data-flavor>
				&ldquo;No expedition is yet underway...&rdquo;
			</p>
			<p class="text-sm text-[var(--color-muted-foreground)]">
				Create a campaign to gather your fellow investigators, or follow a join link from a Keeper.
			</p>
		</div>
	{:else}
		{#if keepering.length > 0}
			<section class="mb-8">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
					Campaigns I'm running
				</h2>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each keepering as c}
						<a
							href="/campaigns/{c.id}"
							class="block rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4 no-underline transition-colors hover:border-[var(--color-primary)]/50"
						>
							<h3 class="font-semibold" data-heading>
								{c.name || 'Untitled Campaign'}
								{#if !c.isOpen}
									<span class="ml-1 rounded bg-[var(--color-muted)]/30 px-1.5 py-0.5 text-[10px] font-normal text-[var(--color-muted-foreground)]">CLOSED</span>
								{/if}
							</h3>
							{#if c.description}
								<p class="mt-1 line-clamp-2 text-sm text-[var(--color-muted-foreground)]">{c.description}</p>
							{/if}
							<p class="mt-2 text-xs text-[var(--color-muted-foreground)]">
								{c.memberCount} player{c.memberCount === 1 ? '' : 's'}
								{#if c.hasShareLink}
									&middot; <span class="text-[var(--color-primary)]">Share link active</span>
								{/if}
							</p>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if playing.length > 0}
			<section>
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
					Campaigns I'm playing in
				</h2>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each playing as c}
						<a
							href="/campaigns/{c.id}"
							class="block rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4 no-underline transition-colors hover:border-[var(--color-primary)]/50"
						>
							<h3 class="font-semibold" data-heading>{c.name || 'Untitled Campaign'}</h3>
							{#if c.description}
								<p class="mt-1 line-clamp-2 text-sm text-[var(--color-muted-foreground)]">{c.description}</p>
							{/if}
							<p class="mt-2 text-xs text-[var(--color-muted-foreground)]">
								{c.memberCount} player{c.memberCount === 1 ? '' : 's'}
							</p>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>
