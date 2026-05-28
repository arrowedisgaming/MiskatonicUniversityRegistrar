<script lang="ts">
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import SortableTh from '$lib/components/admin/SortableTh.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function shortUa(ua: string | null): string {
		if (!ua) return '—';
		if (ua.includes('Firefox')) return 'Firefox';
		if (ua.includes('Edg/')) return 'Edge';
		if (ua.includes('Chrome')) return 'Chrome';
		if (ua.includes('Safari')) return 'Safari';
		return ua.slice(0, 40);
	}

	function formatDate(d: Date): string {
		return d.toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Admin · Audit log</title>
</svelte:head>

<div class="space-y-4">
	<div>
		<h1 class="text-2xl font-bold" data-heading>Audit log</h1>
		<p class="text-sm text-[var(--color-muted-foreground)]">
			{data.total.toLocaleString()} admin requests logged. Anything unexpected here means
			someone other than you has admin email access — rotate <code>ADMIN_EMAILS</code> immediately.
		</p>
	</div>

	<div class="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-card)]">
		<table class="w-full text-sm">
			<thead class="border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
				<tr>
					<SortableTh
						label="When"
						sortKey="when"
						currentSort={data.sort}
						currentDir={data.dir}
						basePath="/admin/audit"
					/>
					<SortableTh
						label="Who"
						sortKey="who"
						currentSort={data.sort}
						currentDir={data.dir}
						basePath="/admin/audit"
					/>
					<SortableTh
						label="Method"
						sortKey="method"
						currentSort={data.sort}
						currentDir={data.dir}
						basePath="/admin/audit"
					/>
					<SortableTh
						label="Path"
						sortKey="path"
						currentSort={data.sort}
						currentDir={data.dir}
						basePath="/admin/audit"
					/>
					<SortableTh
						label="IP"
						sortKey="ip"
						currentSort={data.sort}
						currentDir={data.dir}
						basePath="/admin/audit"
					/>
					<th class="px-3 py-2">UA</th>
				</tr>
			</thead>
			<tbody>
				{#each data.rows as row}
					<tr class="border-b border-[var(--color-border)] last:border-b-0">
						<td class="px-3 py-2 tabular-nums text-[var(--color-muted-foreground)]">{formatDate(row.createdAt)}</td>
						<td class="px-3 py-2">
							{row.userEmail ?? row.actorEmail ?? row.userId ?? '(deleted user)'}
						</td>
						<td class="px-3 py-2"><code class="text-xs">{row.method}</code></td>
						<td class="px-3 py-2"><code class="text-xs">{row.path}</code></td>
						<td class="px-3 py-2 text-[var(--color-muted-foreground)]">{row.ip ?? '—'}</td>
						<td class="px-3 py-2 text-[var(--color-muted-foreground)]">{shortUa(row.userAgent)}</td>
					</tr>
				{/each}
				{#if data.rows.length === 0}
					<tr>
						<td colspan="6" class="px-3 py-8 text-center text-[var(--color-muted-foreground)]">
							No audit rows yet.
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
		basePath="/admin/audit"
		sort={data.sort}
		dir={data.dir}
	/>
</div>
