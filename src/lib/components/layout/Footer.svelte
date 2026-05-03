<script lang="ts">
	const repositoryUrl = 'https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar';
</script>

<footer class="border-t border-[var(--color-border)] bg-[var(--color-card)] px-4 py-6">
	<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-muted-foreground)]">
		<span>Miskatonic University Registrar &mdash; v{__APP_VERSION__} &mdash; Open Source (GPL-3.0)</span>
		<nav aria-label="Footer navigation" class="flex flex-wrap items-center gap-x-4 gap-y-2">
			<a
				href={repositoryUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="underline hover:text-[var(--color-foreground)]"
			>
				GitHub
			</a>
			<a
				href="/licensing"
				class="underline hover:text-[var(--color-foreground)]"
			>
				Licensing &amp; Legal
			</a>
		</nav>
	</div>
</footer>
