<script lang="ts">
	import { theme } from '$lib/stores/theme';
	import { themes } from '$lib/themes/registry';

	function toggleTheme() {
		const current = $theme;
		const idx = themes.findIndex((t) => t.id === current.id);
		const next = themes[(idx + 1) % themes.length];
		theme.set(next);
	}
</script>

<header class="border-b border-[var(--color-border)] bg-[var(--color-card)]">
	<nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3" aria-label="Main navigation">
		<a href="/" class="flex items-center gap-2 no-underline">
			<span class="text-base font-semibold tracking-wide sm:text-lg" data-heading>
				<span class="hidden sm:inline">Miskatonic University Registrar</span>
				<span class="sm:hidden">M.U.R.</span>
			</span>
		</a>

		<div class="flex items-center gap-1 sm:gap-3">
			<a
				href="/create/coc7e/characteristics"
				class="rounded-md px-2 py-1.5 text-xs sm:text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)] transition-colors"
			>
				<span class="hidden sm:inline">New</span>
				<span class="sm:hidden">+</span>
			</a>
			<a
				href="/investigators"
				class="rounded-md px-2 py-1.5 text-xs sm:text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)] transition-colors"
			>
				Investigators
			</a>
			<button
				onclick={toggleTheme}
				class="rounded-md p-2 text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] transition-colors"
				aria-label="Switch to {$theme.resolvesDark ? 'light' : 'dark'} theme"
				title="Switch to {$theme.resolvesDark ? 'Aged Parchment' : 'Eldritch Dark'} theme"
			>
				{#if $theme.resolvesDark}
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
				{/if}
			</button>
		</div>
	</nav>
</header>
