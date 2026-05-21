<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function shortUa(ua: string | null): string {
		if (!ua) return '—';
		// Strip versions to a single tidy label.
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
			Last {data.rows.length.toLocaleString()} admin requests. Anything unexpected here means
			someone other than you has admin email access — rotate <code>ADMIN_EMAILS</code> immediately.
		</p>
	</div>

	<div class="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-card)]">
		<table class="w-full text-sm">
			<thead class="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
				<tr>
					<th class="px-3 py-2">When</th>
					<th class="px-3 py-2">Who</th>
					<th class="px-3 py-2">Method</th>
					<th class="px-3 py-2">Path</th>
					<th class="px-3 py-2">IP</th>
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
</div>
