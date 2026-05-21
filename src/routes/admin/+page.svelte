<script lang="ts">
	import StatCard from '$lib/components/admin/StatCard.svelte';
	import Sparkline from '$lib/components/admin/Sparkline.svelte';
	import ProviderBreakdown from '$lib/components/admin/ProviderBreakdown.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Admin · Overview</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold" data-heading>Overview</h1>
		<p class="text-sm text-[var(--color-muted-foreground)]">
			System-wide stats. Activity windows are rolling 30 days, UTC.
		</p>
	</div>

	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard label="Total users" value={data.overview.totalUsers} />
		<StatCard
			label="Total investigators"
			value={data.overview.totalInvestigators}
			sublabel="{data.overview.publishedInvestigators} published · {data.overview.draftInvestigators} draft · {data.overview.archivedInvestigators} archived"
		/>
		<StatCard label="PDFs (30d)" value={data.overview.pdfsGenerated30d} />
		<StatCard label="Logins (30d)" value={data.overview.logins30d} />
	</div>

	<div class="grid gap-4 lg:grid-cols-3">
		<Sparkline points={data.logins} label="Logins" />
		<Sparkline points={data.creations} label="Investigators created" />
		<Sparkline points={data.pdfs} label="PDFs generated" />
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		<ProviderBreakdown providers={data.providers} />
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm">
			<div class="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
				At a glance
			</div>
			<dl class="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
				<dt class="text-[var(--color-muted-foreground)]">Investigators created (30d)</dt>
				<dd class="tabular-nums font-medium">
					{data.overview.investigatorsCreated30d.toLocaleString()}
				</dd>
				<dt class="text-[var(--color-muted-foreground)]">Draft share</dt>
				<dd class="tabular-nums font-medium">
					{data.overview.totalInvestigators === 0
						? '—'
						: `${Math.round((data.overview.draftInvestigators / data.overview.totalInvestigators) * 100)}%`}
				</dd>
				<dt class="text-[var(--color-muted-foreground)]">Investigators per user</dt>
				<dd class="tabular-nums font-medium">
					{data.overview.totalUsers === 0
						? '—'
						: (data.overview.totalInvestigators / data.overview.totalUsers).toFixed(1)}
				</dd>
				<dt class="text-[var(--color-muted-foreground)]">PDFs per investigator (30d)</dt>
				<dd class="tabular-nums font-medium">
					{data.overview.investigatorsCreated30d === 0
						? '—'
						: (data.overview.pdfsGenerated30d / data.overview.investigatorsCreated30d).toFixed(2)}
				</dd>
			</dl>
		</div>
	</div>
</div>
