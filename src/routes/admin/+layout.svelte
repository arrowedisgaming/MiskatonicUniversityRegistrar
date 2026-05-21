<script lang="ts">
	import { page } from '$app/state';
	import { ShieldAlert } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	let { data, children }: { data: { adminEmail: string | null }; children: Snippet } = $props();

	const tabs = [
		{ href: '/admin', label: 'Overview' },
		{ href: '/admin/users', label: 'Users' },
		{ href: '/admin/investigators', label: 'Investigators' },
		{ href: '/admin/audit', label: 'Audit log' }
	];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		if (href === '/admin') return path === '/admin';
		return path === href || path.startsWith(href + '/');
	}
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div
	class="border-b border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 px-4 py-2 text-xs text-[var(--color-destructive)]"
	role="status"
>
	<div class="mx-auto flex max-w-6xl items-center gap-2">
		<ShieldAlert size={14} aria-hidden="true" />
		<span class="font-semibold uppercase tracking-wider">Admin mode</span>
		<span class="opacity-70">Signed in as {data.adminEmail ?? 'unknown'}</span>
		<span class="ml-auto opacity-70">All access is audited</span>
	</div>
</div>

<div class="mx-auto max-w-6xl px-4 pt-6">
	<nav class="mb-6 flex flex-wrap gap-1 border-b border-[var(--color-border)]" aria-label="Admin sections">
		{#each tabs as tab}
			<a
				href={tab.href}
				class="rounded-t-md border border-b-0 px-3 py-1.5 text-sm transition-colors {isActive(tab.href)
					? 'border-[var(--color-border)] bg-[var(--color-card)] font-medium text-[var(--color-foreground)]'
					: 'border-transparent text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'}"
				aria-current={isActive(tab.href) ? 'page' : undefined}
			>
				{tab.label}
			</a>
		{/each}
	</nav>

	{@render children()}
</div>
