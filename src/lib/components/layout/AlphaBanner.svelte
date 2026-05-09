<script lang="ts">
	// Persistent top-of-page warning while the schema is unstable.
	// Lives inside .app-frame so atmospheric filters (CRT/sepia/glitch) apply.
</script>

<div
	role="status"
	aria-live="polite"
	class="alpha-banner sticky top-0 z-40 border-b border-[var(--color-border)] px-4 py-2"
>
	<div class="mx-auto max-w-5xl space-y-1 text-center text-sm text-[var(--color-muted-foreground)]">
		<p class="italic">
			The Registrar's ledgers are still being inscribed &mdash; what is recorded here may be unmade
			by deeper waters. Export your investigators, lest they be devoured.
		</p>

		<p class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-medium text-[var(--color-foreground)]">
			<svg
				aria-hidden="true"
				class="tentacle hidden shrink-0 sm:inline-block"
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.25"
				stroke-linecap="round"
			>
				<path d="M2 13 C 2 10, 4 9, 6 10 S 9 12, 10 9 S 9 5, 6 5 S 3 7, 4 9" />
				<circle cx="6" cy="10" r="0.55" fill="currentColor" stroke="none" />
				<circle cx="8" cy="7" r="0.55" fill="currentColor" stroke="none" />
				<circle cx="5" cy="6" r="0.55" fill="currentColor" stroke="none" />
			</svg>

			<span>Alpha software &middot; data loss may occur.</span>

			<svg
				aria-hidden="true"
				class="tentacle tentacle--mirror hidden shrink-0 sm:inline-block"
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.25"
				stroke-linecap="round"
			>
				<path d="M2 13 C 2 10, 4 9, 6 10 S 9 12, 10 9 S 9 5, 6 5 S 3 7, 4 9" />
				<circle cx="6" cy="10" r="0.55" fill="currentColor" stroke="none" />
				<circle cx="8" cy="7" r="0.55" fill="currentColor" stroke="none" />
				<circle cx="5" cy="6" r="0.55" fill="currentColor" stroke="none" />
			</svg>
		</p>
	</div>
</div>

<style>
	.alpha-banner {
		background: color-mix(in oklch, var(--color-primary) 14%, var(--color-background));
	}

	.tentacle {
		opacity: 0.65;
	}

	.tentacle--mirror {
		transform: scaleX(-1);
	}
</style>
