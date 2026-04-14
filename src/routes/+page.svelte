<svelte:head>
	<title>Miskatonic University Registrar</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-16 text-center">
	<h1 class="mb-4 text-4xl font-bold tracking-wide sm:text-5xl" data-heading>
		Miskatonic University Registrar
	</h1>

	<p class="mb-2 text-lg text-[var(--color-muted-foreground)]" data-flavor>
		&ldquo;The oldest and most important thing in the world is registration.&rdquo;
	</p>

	<p class="mx-auto mb-8 max-w-2xl text-[var(--color-muted-foreground)]">
		A free, open-source character builder for Call of Cthulhu 7th Edition.
		Create investigators, track stats during play, and export to PDF, JSON, or Obsidian Markdown.
	</p>

	<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
		<a
			href="/create/coc7e/characteristics"
			class="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-3 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90"
		>
			Create an Investigator
		</a>
		<a
			href="/investigators"
			class="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-6 py-3 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-accent)]"
		>
			View Investigators
		</a>
	</div>
</div>
