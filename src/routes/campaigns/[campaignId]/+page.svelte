<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import VitalsCard from '$lib/components/campaign/VitalsCard.svelte';
	import RollLogEntry from '$lib/components/campaign/RollLogEntry.svelte';
	import JoinLinkDialog from '$lib/components/campaign/JoinLinkDialog.svelte';
	import InventoryPushForm from '$lib/components/campaign/InventoryPushForm.svelte';
	import type { DashboardMemberVitals, CampaignRollRow } from '$lib/server/campaign/rolls';
	import type { CoCEquipmentPack } from '$lib/types/content-pack';

	type Data = {
		campaign: { id: string; name: string; description: string; isOpen: boolean; shareId: string | null };
		role: 'keeper' | 'player';
		dashboard: DashboardMemberVitals[];
		rolls: CampaignRollRow[];
		equipment: CoCEquipmentPack | null;
	};
	const data = page.data as Data;

	let dashboard = $state<DashboardMemberVitals[]>(data.dashboard);
	let rolls = $state<CampaignRollRow[]>(data.rolls);
	let lastSeenRollId = $state<number>(data.rolls[0]?.id ?? 0);
	let activeTab: 'log' | 'sheets' | 'inventory' = $state('log');
	let leaving = $state(false);

	// Pause the poll loop while the tab is hidden — keeps D1 read costs
	// near-zero when the Keeper alt-tabs.
	let polling = $state(true);

	$effect(() => {
		if (typeof document === 'undefined') return;
		const onVis = () => {
			polling = document.visibilityState === 'visible';
		};
		document.addEventListener('visibilitychange', onVis);
		const interval = window.setInterval(async () => {
			if (!polling) return;
			try {
				const [newRolls, fresh] = await Promise.all([
					fetch(`/api/campaigns/${data.campaign.id}/rolls?since=${lastSeenRollId}&limit=50`).then((r) =>
						r.ok ? (r.json() as Promise<CampaignRollRow[]>) : Promise.resolve([])
					),
					fetch(`/api/campaigns/${data.campaign.id}/dashboard`).then((r) =>
						r.ok ? (r.json() as Promise<DashboardMemberVitals[]>) : Promise.resolve(dashboard)
					)
				]);
				if (newRolls.length > 0) {
					rolls = [...newRolls, ...rolls];
					lastSeenRollId = newRolls[0].id;
				}
				dashboard = fresh;
			} catch {
				// network blip — try again on next tick
			}
		}, 5000);
		return () => {
			clearInterval(interval);
			document.removeEventListener('visibilitychange', onVis);
		};
	});

	async function refresh() {
		const [newRolls, fresh] = await Promise.all([
			fetch(`/api/campaigns/${data.campaign.id}/rolls?limit=50`).then((r) => r.json() as Promise<CampaignRollRow[]>),
			fetch(`/api/campaigns/${data.campaign.id}/dashboard`).then((r) => r.json() as Promise<DashboardMemberVitals[]>)
		]);
		rolls = newRolls;
		lastSeenRollId = newRolls[0]?.id ?? 0;
		dashboard = fresh;
	}

	async function leave() {
		if (leaving) return;
		if (!confirm('Leave this campaign? Your investigator stays yours; you can rejoin later.')) return;
		leaving = true;
		await fetch(`/api/campaigns/${data.campaign.id}/leave`, { method: 'POST' });
		await goto('/campaigns');
	}

	async function deleteCampaign() {
		if (!confirm('Delete this campaign? Players lose access and the roll log is gone.')) return;
		await fetch(`/api/campaigns/${data.campaign.id}`, { method: 'DELETE' });
		await goto('/campaigns');
	}

	async function removeMember(memberId: string) {
		if (!confirm("Remove this player from the campaign?")) return;
		await fetch(`/api/campaigns/${data.campaign.id}/members/${memberId}`, { method: 'DELETE' });
		await refresh();
	}
</script>

<svelte:head>
	<title>{data.campaign.name} — Miskatonic University Registrar</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-6">
	<header class="mb-6 flex flex-wrap items-start gap-3">
		<div class="flex-1">
			<h1 class="text-2xl font-bold" data-heading>{data.campaign.name || 'Untitled Campaign'}</h1>
			{#if data.campaign.description}
				<p class="mt-1 whitespace-pre-line text-sm text-[var(--color-muted-foreground)]">
					{data.campaign.description}
				</p>
			{/if}
			<p class="mt-2 text-xs text-[var(--color-muted-foreground)]">
				{dashboard.length} active player{dashboard.length === 1 ? '' : 's'}
				&middot; You are the {data.role === 'keeper' ? 'Keeper' : 'a player'}
			</p>
		</div>
		<div class="relative flex items-center gap-2">
			{#if data.role === 'keeper'}
				<JoinLinkDialog campaignId={data.campaign.id} initialShareId={data.campaign.shareId} />
				<button
					type="button"
					onclick={deleteCampaign}
					class="rounded-md border border-[var(--color-destructive)]/40 px-3 py-1.5 text-xs text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10"
				>
					Delete
				</button>
			{:else}
				<button
					type="button"
					onclick={leave}
					disabled={leaving}
					class="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-accent)] disabled:opacity-50"
				>
					Leave campaign
				</button>
			{/if}
		</div>
	</header>

	{#if dashboard.length === 0}
		<div class="rounded-md border border-dashed border-[var(--color-border)] p-8 text-center">
			<p class="text-sm text-[var(--color-muted-foreground)]">
				No players have joined yet.
				{#if data.role === 'keeper'}
					Open the join link to invite some investigators.
				{/if}
			</p>
		</div>
	{:else}
		<section aria-label="Player vitals" class="mb-6">
			<h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
				Play dashboard
			</h2>
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each dashboard as v}
					<div class="relative">
						<VitalsCard vitals={v} />
						{#if data.role === 'keeper'}
							<button
								type="button"
								onclick={() => removeMember(v.memberId)}
								title="Remove player"
								class="absolute right-2 top-2 rounded-md p-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
							>
								✕
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<nav class="mb-3 flex gap-1 border-b border-[var(--color-border)]" aria-label="Campaign tabs">
		<button
			type="button"
			onclick={() => (activeTab = 'log')}
			class="border-b-2 px-3 py-2 text-sm transition-colors {activeTab === 'log'
				? 'border-[var(--color-primary)] text-[var(--color-foreground)]'
				: 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}"
		>
			Roll log
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'sheets')}
			class="border-b-2 px-3 py-2 text-sm transition-colors {activeTab === 'sheets'
				? 'border-[var(--color-primary)] text-[var(--color-foreground)]'
				: 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}"
		>
			Sheets
		</button>
		{#if data.role === 'keeper'}
			<button
				type="button"
				onclick={() => (activeTab = 'inventory')}
				class="border-b-2 px-3 py-2 text-sm transition-colors {activeTab === 'inventory'
					? 'border-[var(--color-primary)] text-[var(--color-foreground)]'
					: 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}"
			>
				Push inventory
			</button>
		{/if}
	</nav>

	{#if activeTab === 'log'}
		{#if rolls.length === 0}
			<p class="rounded-md border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
				No rolls yet — they'll appear here as players roll.
			</p>
		{:else}
			<ul class="space-y-2">
				{#each rolls as r (r.id)}
					<RollLogEntry investigatorName={r.investigatorName} entry={r.entry} createdAt={r.createdAt} />
				{/each}
			</ul>
		{/if}
	{:else if activeTab === 'sheets'}
		<div class="space-y-3">
			{#each dashboard as v}
				<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
					<div class="mb-2 flex items-center justify-between">
						<h3 class="font-semibold" data-heading>{v.investigatorName}</h3>
						<!-- /sheet/{id} loads only investigators owned by the caller, so
						     linking another member's id from here would 404 for everyone
						     except the owner. Only surface the link when the row belongs
						     to the caller; everyone else just sees the inline vitals dl. -->
						{#if v.belongsToCaller}
							<a
								href="/sheet/{v.investigatorId}"
								class="text-xs text-[var(--color-primary)] underline-offset-4 hover:underline"
							>
								Open full sheet →
							</a>
						{/if}
					</div>
					<dl class="grid grid-cols-4 gap-3 text-xs">
						<div><dt class="text-[10px] uppercase text-[var(--color-muted-foreground)]">HP</dt><dd>{v.hp.current}/{v.hp.max}</dd></div>
						<div><dt class="text-[10px] uppercase text-[var(--color-muted-foreground)]">MP</dt><dd>{v.mp.current}/{v.mp.max}</dd></div>
						<div><dt class="text-[10px] uppercase text-[var(--color-muted-foreground)]">SAN</dt><dd>{v.sanity.current}/{v.sanity.max}</dd></div>
						<div><dt class="text-[10px] uppercase text-[var(--color-muted-foreground)]">Luck</dt><dd>{v.luck.current}</dd></div>
					</dl>
				</div>
			{/each}
		</div>
	{:else if activeTab === 'inventory' && data.role === 'keeper' && data.equipment}
		<InventoryPushForm
			campaignId={data.campaign.id}
			members={dashboard}
			equipment={data.equipment}
			onsuccess={refresh}
		/>
	{/if}
</div>
