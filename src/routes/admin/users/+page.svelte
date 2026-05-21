<script lang="ts">
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDate(d: Date | null): string {
		if (!d) return '—';
		return d.toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Admin · Users</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold" data-heading>Users</h1>
			<p class="text-sm text-[var(--color-muted-foreground)]">
				{data.total.toLocaleString()} total
			</p>
		</div>
		<form class="flex gap-2" method="get" action="/admin/users">
			<input
				type="search"
				name="q"
				value={data.search}
				placeholder="Search email or name"
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
					<th class="px-3 py-2">Email</th>
					<th class="px-3 py-2">Name</th>
					<th class="px-3 py-2">Provider</th>
					<th class="px-3 py-2 text-right">Investigators</th>
					<th class="px-3 py-2">Last login</th>
					<th class="px-3 py-2"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.rows as user}
					<tr class="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-accent)]/30">
						<td class="px-3 py-2 font-medium">{user.email ?? '—'}</td>
						<td class="px-3 py-2 text-[var(--color-muted-foreground)]">{user.name ?? '—'}</td>
						<td class="px-3 py-2 capitalize">{user.primaryProvider ?? '—'}</td>
						<td class="px-3 py-2 text-right tabular-nums">{user.investigatorCount}</td>
						<td class="px-3 py-2 text-[var(--color-muted-foreground)]">{formatDate(user.lastLoginAt)}</td>
						<td class="px-3 py-2 text-right">
							<a
								href="/admin/investigators?userId={user.id}"
								class="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-accent)]"
							>
								View investigators
							</a>
						</td>
					</tr>
				{/each}
				{#if data.rows.length === 0}
					<tr>
						<td colspan="6" class="px-3 py-8 text-center text-[var(--color-muted-foreground)]">
							No users found.
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
		basePath="/admin/users"
		searchParams={{ q: data.search || undefined }}
	/>
</div>
