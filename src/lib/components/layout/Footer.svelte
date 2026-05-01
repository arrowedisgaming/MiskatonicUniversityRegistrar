<script lang="ts">
	const repositoryUrl = 'https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar';
</script>

<footer class="border-t border-[var(--color-border)] bg-[var(--color-card)] px-4 py-6">
	<div class="mx-auto max-w-6xl space-y-4">
		<!-- Chaosium Fan Material Policy disclaimer (required on every page) -->
		<p class="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
			This is unofficial Fan Content and is not approved/endorsed by Chaosium. Call of Cthulhu is a
			registered trademark of Chaosium Inc. For more information about Chaosium Inc.'s products,
			please visit
			<a
				href="https://www.chaosium.com"
				target="_blank"
				rel="noopener noreferrer"
				class="underline hover:text-[var(--color-foreground)]"
			>
				www.chaosium.com</a
			>. The creator of this content is expressly prohibited from charging you to use or access this
			content. This content is not published, endorsed, or specifically approved by Chaosium Inc.
		</p>

		<div class="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-muted-foreground)]">
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
	</div>
</footer>
