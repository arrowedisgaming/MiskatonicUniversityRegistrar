<script lang="ts">
	import type { SortDir } from '$lib/server/admin-queries';

	type Props = {
		label: string;
		sortKey: string;
		currentSort: string;
		currentDir: SortDir;
		basePath: string;
		searchParams?: Record<string, string | undefined>;
		align?: 'left' | 'right';
	};

	let {
		label,
		sortKey,
		currentSort,
		currentDir,
		basePath,
		searchParams = {},
		align = 'left'
	}: Props = $props();

	const isActive = $derived(currentSort === sortKey);
	const nextDir = $derived(isActive && currentDir === 'asc' ? 'desc' : 'asc');
	const ariaSort = $derived(
		isActive ? (currentDir === 'asc' ? 'ascending' : 'descending') : 'none'
	);

	function href(): string {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(searchParams)) {
			if (v) params.set(k, v);
		}
		params.set('sort', sortKey);
		params.set('dir', nextDir);
		params.set('page', '1');
		return `${basePath}?${params.toString()}`;
	}
</script>

<th
	class="px-3 py-2 {align === 'right' ? 'text-right' : 'text-left'}"
	aria-sort={ariaSort}
>
	<a
		href={href()}
		class="inline-flex items-center gap-1 hover:text-[var(--color-foreground)] {isActive
			? 'text-[var(--color-foreground)]'
			: ''}"
	>
		{label}
		{#if isActive}
			<span class="text-[10px] leading-none" aria-hidden="true">{currentDir === 'asc' ? '↑' : '↓'}</span
			>
		{/if}
	</a>
</th>
