<script lang="ts">
	import { goto } from '$app/navigation';

	let name = $state('');
	let description = $state('');
	let submitting = $state(false);
	let error: string | null = $state(null);

	async function submit(e: Event) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		error = null;
		try {
			const res = await fetch('/api/campaigns', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name, description })
			});
			if (!res.ok) {
				const body = await res.text();
				error = body || 'Failed to create campaign';
				submitting = false;
				return;
			}
			const { id } = (await res.json()) as { id: string };
			await goto(`/campaigns/${id}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create campaign';
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>New Campaign — Miskatonic University Registrar</title>
</svelte:head>

<div class="mx-auto max-w-xl px-4 py-8">
	<h1 class="mb-6 text-2xl font-bold" data-heading>New Campaign</h1>

	<form onsubmit={submit} class="space-y-5 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-6">
		<div>
			<label for="campaign-name" class="block text-sm font-medium">Name</label>
			<input
				id="campaign-name"
				bind:value={name}
				required
				maxlength="120"
				placeholder="e.g. Masks of Nyarlathotep"
				class="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
			/>
		</div>

		<div>
			<label for="campaign-description" class="block text-sm font-medium">Description (optional)</label>
			<textarea
				id="campaign-description"
				bind:value={description}
				rows="4"
				maxlength="2000"
				placeholder="A short pitch the players will see when they join."
				class="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
			></textarea>
		</div>

		{#if error}
			<p class="rounded-md border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 p-3 text-sm text-[var(--color-destructive)]">
				{error}
			</p>
		{/if}

		<div class="flex justify-end gap-2">
			<a
				href="/campaigns"
				class="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--color-accent)]"
			>
				Cancel
			</a>
			<button
				type="submit"
				disabled={submitting || !name.trim()}
				class="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{submitting ? 'Creating…' : 'Create Campaign'}
			</button>
		</div>
	</form>
</div>
