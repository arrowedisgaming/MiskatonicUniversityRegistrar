<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	type Data = {
		campaign: { id: string; name: string; description: string };
		shareId: string;
		investigators: Array<{ id: string; name: string; occupation: string; era: string }>;
	};
	const data = page.data as Data;

	let selectedInvestigatorId = $state(data.investigators[0]?.id ?? '');
	let submitting = $state(false);
	let error: string | null = $state(null);

	async function join(e: Event) {
		e.preventDefault();
		if (submitting || !selectedInvestigatorId) return;
		submitting = true;
		error = null;
		try {
			const res = await fetch(`/api/campaigns/join/${data.shareId}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ investigatorId: selectedInvestigatorId })
			});
			if (!res.ok) {
				error = (await res.text()) || 'Failed to join campaign';
				submitting = false;
				return;
			}
			await goto(`/campaigns/${data.campaign.id}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to join';
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Join {data.campaign.name || 'Campaign'} — Miskatonic University Registrar</title>
</svelte:head>

<div class="mx-auto max-w-xl px-4 py-8">
	<h1 class="text-2xl font-bold" data-heading>
		Join &ldquo;{data.campaign.name || 'Untitled Campaign'}&rdquo;
	</h1>
	{#if data.campaign.description}
		<p class="mt-2 whitespace-pre-line text-sm text-[var(--color-muted-foreground)]">
			{data.campaign.description}
		</p>
	{/if}

	{#if data.investigators.length === 0}
		<div class="mt-6 rounded-md border border-dashed border-[var(--color-border)] p-6 text-center">
			<p class="mb-3 text-sm text-[var(--color-muted-foreground)]">
				You don't have any finished investigators available to bring into this campaign.
			</p>
			<a
				href="/create/coc7e/characteristics"
				class="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
			>
				Create an Investigator
			</a>
		</div>
	{:else}
		<form onsubmit={join} class="mt-6 space-y-5 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-6">
			<fieldset>
				<legend class="text-sm font-medium">Bring an investigator</legend>
				<div class="mt-2 space-y-2">
					{#each data.investigators as inv}
						<label class="flex cursor-pointer items-center gap-3 rounded-md border border-[var(--color-border)] p-3 hover:bg-[var(--color-accent)]/40">
							<input
								type="radio"
								name="investigator"
								value={inv.id}
								bind:group={selectedInvestigatorId}
							/>
							<span>
								<span class="block font-semibold" data-heading>{inv.name || 'Unnamed'}</span>
								<span class="block text-xs text-[var(--color-muted-foreground)]">
									{inv.occupation || 'No occupation'} &middot; {inv.era}
								</span>
							</span>
						</label>
					{/each}
				</div>
			</fieldset>

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
					disabled={submitting || !selectedInvestigatorId}
					class="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{submitting ? 'Joining…' : 'Join Campaign'}
				</button>
			</div>
		</form>
	{/if}
</div>
