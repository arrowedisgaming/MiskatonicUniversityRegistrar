<script lang="ts">
	const repositoryUrl = 'https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar';
	const koFiUrl = 'https://ko-fi.com/arrowedisgaming';
</script>

<footer class="border-t border-[var(--color-border)] bg-[var(--color-card)] px-4 py-6">
	<div class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-muted-foreground)]">
		<span>Miskatonic University Registrar &mdash; v{__APP_VERSION__} &mdash; Open Source (GPL-3.0)</span>
		<nav aria-label="Footer navigation" class="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
			<a
				href={repositoryUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="underline hover:text-[var(--color-foreground)]"
			>
				GitHub
			</a>
			<a
				href={koFiUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="underline hover:text-[var(--color-foreground)]"
			>
				Ko-fi
			</a>
			<a
				href="/privacy"
				class="underline hover:text-[var(--color-foreground)]"
			>
				Privacy
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
