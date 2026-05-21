<script lang="ts">
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(d: Date): string {
		return d.toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Admin · Investigators</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold" data-heading>Investigators</h1>
			<p class="text-sm text-[var(--color-muted-foreground)]">
				{data.total.toLocaleString()} total{#if data.userId}
					· filtered to one user
					<a class="underline" href="/admin/investigators">clear</a>
				{/if}
			</p>
		</div>
		<form class="flex gap-2" method="get" action="/admin/investigators">
			{#if data.userId}<input type="hidden" name="userId" value={data.userId} />{/if}
			<input
				type="search"
				name="q"
				value={data.search}
				placeholder="Search by name or owner email"
				class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm"
			/>
			<button
				type="submit"
				class="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-accent)]"
			>
				Search
			</button>
		</form>
	</div>

	<div class="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-card)]">
		<table class="w-full text-sm">
			<thead class="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
				<tr>
					<th class="px-3 py-2">Name</th>
					<th class="px-3 py-2">Owner</th>
					<th class="px-3 py-2">Era</th>
					<th class="px-3 py-2">Occupation</th>
					<th class="px-3 py-2">Status</th>
					<th class="px-3 py-2">Created</th>
					<th class="px-3 py-2">Updated</th>
					<th class="px-3 py-2"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.rows as inv}
					<tr class="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30">
						<td class="px-3 py-2 font-medium">{inv.name || 'Unnamed'}</td>
						<td class="px-3 py-2 text-[var(--color-muted-foreground)]">{inv.ownerEmail ?? '—'}</td>
						<td class="px-3 py-2">{inv.era}</td>
						<td class="px-3 py-2 text-[var(--color-muted-foreground)]">{inv.occupation || '—'}</td>
						<td class="px-3 py-2">
							{#if inv.isArchived}
								<span class="rounded bg-[var(--color-muted)]/30 px-1.5 py-0.5 text-[10px] uppercase">Archived</span>
							{:else if inv.isDraft}
								<span class="rounded bg-[var(--color-warning)]/20 px-1.5 py-0.5 text-[10px] uppercase text-[var(--color-warning)]">Draft</span>
							{:else}
								<span class="rounded bg-[var(--color-primary)]/15 px-1.5 py-0.5 text-[10px] uppercase text-[var(--color-primary)]">Live</span>
							{/if}
						</td>
						<td class="px-3 py-2 text-[var(--color-muted-foreground)]">{formatDate(inv.createdAt)}</td>
						<td class="px-3 py-2 text-[var(--color-muted-foreground)]">{formatDate(inv.updatedAt)}</td>
						<td class="px-3 py-2 text-right">
							<a
								href="/sheet/{inv.id}"
								class="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-accent)]"
							>
								Open sheet
							</a>
						</td>
					</tr>
				{/each}
				{#if data.rows.length === 0}
					<tr>
						<td colspan="8" class="px-3 py-8 text-center text-[var(--color-muted-foreground)]">
							No investigators match.
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>

	<Pagination
		page={data.page}
		pageSize={data.pageSize}
		total={data.total}
		basePath="/admin/investigators"
		searchParams={{ q: data.search || undefined, userId: data.userId || undefined }}
	/>
</div>
