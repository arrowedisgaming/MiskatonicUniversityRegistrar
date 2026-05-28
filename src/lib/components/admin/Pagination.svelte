<script lang="ts">
	import type { SortDir } from '$lib/server/admin-queries';

	type Props = {
		page: number;
		pageSize: number;
		total: number;
		basePath: string;
		searchParams?: Record<string, string | undefined>;
		sort?: string;
		dir?: SortDir;
	};
	let { page, pageSize, total, basePath, searchParams = {}, sort, dir }: Props = $props();

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const start = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
	const end = $derived(Math.min(total, page * pageSize));

	function hrefFor(target: number): string {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(searchParams)) {
			if (v) params.set(k, v);
		}
		if (sort) params.set('sort', sort);
		if (dir) params.set('dir', dir);
		params.set('page', String(target));
		return `${basePath}?${params.toString()}`;
	}
</script>

<div class="mt-3 flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
	<span>
		{#if total === 0}
			No results
		{:else}
			Showing {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
		{/if}
	</span>
	<div class="flex items-center gap-1">
		{#if page > 1}
			<a
				href={hrefFor(page - 1)}
				class="rounded-md border border-[var(--color-border)] px-2 py-1 hover:bg-[var(--color-accent)]"
				>Prev</a
			>
		{:else}
			<span class="rounded-md border border-[var(--color-border)] px-2 py-1 opacity-50">Prev</span>
		{/if}
		<span class="px-2 py-1">Page {page} / {totalPages}</span>
		{#if page < totalPages}
			<a
				href={hrefFor(page + 1)}
				class="rounded-md border border-[var(--color-border)] px-2 py-1 hover:bg-[var(--color-accent)]"
				>Next</a
			>
		{:else}
			<span class="rounded-md border border-[var(--color-border)] px-2 py-1 opacity-50">Next</span>
		{/if}
	</div>
</div>
