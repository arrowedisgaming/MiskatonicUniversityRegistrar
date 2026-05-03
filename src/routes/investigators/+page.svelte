<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	const data = page.data as {
		investigators: {
			id: string;
			name: string;
			era: string;
			occupation: string;
			isDraft: boolean;
			createdAt: Date;
			updatedAt: Date;
		}[];
	};

	async function archiveInvestigator(id: string) {
		if (!confirm('Archive this investigator? You can restore them later.')) return;
		await fetch(`/api/investigators/${id}`, { method: 'DELETE' });
		invalidateAll();
	}

	async function duplicateInvestigator(id: string) {
		await fetch(`/api/investigators/${id}/duplicate`, { method: 'POST' });
		invalidateAll();
	}
</script>

<svelte:head>
	<title>Investigators — Miskatonic University Registrar</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold" data-heading>Your Investigators</h1>
		<a
			href="/create/coc7e/characteristics"
			class="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium
				text-[var(--color-primary-foreground)] transition-colors hover:opacity-90"
		>
			+ New Investigator
		</a>
	</div>

	{#if data.investigators.length === 0}
		<div class="rounded-md border border-dashed border-[var(--color-border)] p-12 text-center">
			<p class="mb-2 text-lg text-[var(--color-muted-foreground)]" data-flavor>
				&ldquo;No investigator has yet dared to enroll...&rdquo;
			</p>
			<p class="text-sm text-[var(--color-muted-foreground)]">
				Create your first investigator to begin.
			</p>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.investigators as inv}
				<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:border-[var(--color-primary)]/50">
					<a href="/sheet/{inv.id}" class="block no-underline">
						<h3 class="font-semibold" data-heading>
							{inv.name || 'Unnamed'}
							{#if inv.isDraft}
								<span class="ml-1 rounded bg-[var(--color-warning)]/20 px-1.5 py-0.5 text-[10px] font-normal text-[var(--color-warning)]">DRAFT</span>
							{/if}
						</h3>
						<p class="text-sm text-[var(--color-muted-foreground)]">
							{inv.occupation || 'No occupation'} &middot; {inv.era}
						</p>
					</a>

					<div class="mt-3 flex gap-2 text-xs">
						<a
							href="/sheet/{inv.id}"
							class="rounded border border-[var(--color-border)] px-2 py-1 transition-colors hover:bg-[var(--color-accent)]"
						>
							View
						</a>
						<button
							type="button"
							onclick={() => duplicateInvestigator(inv.id)}
							class="rounded border border-[var(--color-border)] px-2 py-1 transition-colors hover:bg-[var(--color-accent)]"
						>
							Duplicate
						</button>
						<button
							type="button"
							onclick={() => archiveInvestigator(inv.id)}
							class="rounded border border-[var(--color-border)] px-2 py-1 text-[var(--color-destructive)] transition-colors hover:bg-[var(--color-destructive)]/10"
						>
							Archive
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
