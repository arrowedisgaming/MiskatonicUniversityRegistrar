<script lang="ts">
	import type { DashboardMemberVitals } from '$lib/server/campaign/rolls';
	import type { CoCEquipmentPack } from '$lib/types/content-pack';
	import { invalidateAll } from '$app/navigation';
	import {
		buildEquipmentCorpus,
		matchName,
		rankEquipmentMatches,
		type EquipmentMatch
	} from '$lib/play/equipment-search';

	type Props = {
		campaignId: string;
		members: DashboardMemberVitals[];
		equipment: CoCEquipmentPack;
		/** Called when a push succeeds so the parent can refetch dashboard + rolls. */
		onsuccess?: () => void;
	};
	let { campaignId, members, equipment, onsuccess }: Props = $props();

	// svelte-ignore state_referenced_locally
	let selectedMemberId = $state(members[0]?.memberId ?? '');

	// Search corpus is stable per equipment prop. Built once via $derived so
	// it auto-recomputes if the page ever swaps the pack (it won't today, but
	// the reactivity costs nothing and keeps us safe if it does).
	const corpus = $derived(buildEquipmentCorpus(equipment));

	let query = $state('');
	let pending = $state<EquipmentMatch | null>(null);
	let pendingQuantity = $state(1);

	const matches = $derived(rankEquipmentMatches(query, corpus).slice(0, 8));

	let cashDelta = $state(0);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	$effect(() => {
		if (!selectedMemberId && members.length > 0) selectedMemberId = members[0].memberId;
	});

	function selectMatch(m: EquipmentMatch) {
		pending = m;
		query = matchName(m);
		pendingQuantity = 1;
	}

	function clearPending() {
		pending = null;
		query = '';
		pendingQuantity = 1;
	}

	function deltaForPending(): { add: Record<string, unknown> } | null {
		if (!pending) return null;
		if (pending.kind === 'weapon') {
			return {
				add: {
					weapons: [
						{
							name: pending.def.name,
							damage: pending.def.damage,
							range: pending.def.range,
							attacksPerRound: pending.def.attacksPerRound,
							ammo: pending.def.ammo ?? null,
							malfunction: pending.def.malfunction ?? null
						}
					]
				}
			};
		}
		return {
			add: {
				items: [{ name: pending.name, quantity: pendingQuantity, notes: '' }]
			}
		};
	}

	function deltaForCash(): { add: Record<string, unknown> } | null {
		if (!cashDelta) return null;
		return { add: { cashDelta } };
	}

	async function push(buildDelta: () => { add: Record<string, unknown> } | null, label: string) {
		if (busy) return;
		const member = members.find((m) => m.memberId === selectedMemberId);
		if (!member) {
			error = 'Pick a player';
			return;
		}
		const delta = buildDelta();
		if (!delta) {
			error = `Nothing to ${label}`;
			return;
		}

		busy = true;
		error = null;
		success = null;

		// try/finally guarantees `busy` always resets — earlier versions could
		// leave it stuck if a thrown TypeError or rejected promise escaped the
		// happy path (notably when the dashboard JSON contract was ambiguous
		// about whether updatedAt was a Date or a string; switching to ms
		// numbers killed that class of bug at the source).
		try {
			// Optimistic-concurrency retry loop: the server returns 409 with the
			// current updatedAt when the player persisted between our dashboard
			// read and this write. Up to three attempts before we surface the
			// conflict.
			let attempt = 0;
			let expectedUpdatedAt = member.updatedAt;
			while (attempt < 3) {
				attempt++;
				const res = await fetch(
					`/api/campaigns/${campaignId}/members/${selectedMemberId}/inventory`,
					{
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ expectedUpdatedAt, ...delta })
					}
				);
				if (res.ok) {
					success = `${label} pushed.`;
					clearPending();
					cashDelta = 0;
					onsuccess?.();
					await invalidateAll();
					return;
				}
				if (res.status === 409) {
					const body = (await res.json().catch(() => null)) as
						| { currentUpdatedAt?: number; message?: string }
						| null;
					if (body?.currentUpdatedAt && attempt < 3) {
						expectedUpdatedAt = body.currentUpdatedAt;
						continue;
					}
					error = body?.message ?? 'Player just saved — try again';
					return;
				}
				error = (await res.text()) || `Failed (${res.status})`;
				return;
			}
			error = 'Gave up after 3 retries — refresh and try again';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Push failed unexpectedly';
		} finally {
			busy = false;
		}
	}

	function onSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && matches.length > 0 && !pending) {
			e.preventDefault();
			selectMatch(matches[0]);
		}
		if (e.key === 'Escape') {
			query = '';
			pending = null;
		}
	}
</script>

<section class="space-y-4 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
	<label class="block text-sm">
		<span class="font-medium">Player</span>
		<select
			bind:value={selectedMemberId}
			class="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-sm"
		>
			{#each members as m}
				<option value={m.memberId}>{m.investigatorName}</option>
			{/each}
		</select>
	</label>

	<div>
		<label class="block text-sm" for="equipment-search">
			<span class="font-medium">Find an item or weapon</span>
		</label>
		<div class="relative mt-1">
			<input
				id="equipment-search"
				type="text"
				bind:value={query}
				onkeydown={onSearchKeydown}
				placeholder="Type to search the content pack (e.g. lantern, revolver, .38)"
				autocomplete="off"
				class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
			/>

			{#if query && matches.length > 0 && !pending}
				<ul
					role="listbox"
					aria-label="Equipment matches"
					class="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg"
				>
					{#each matches as m, i (matchName(m) + i)}
						<li>
							<button
								type="button"
								onclick={() => selectMatch(m)}
								class="flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-[var(--color-accent)]"
							>
								<span class="flex-1">
									<span class="font-medium">{matchName(m)}</span>
									{#if m.kind === 'weapon'}
										<span class="ml-2 text-xs text-[var(--color-muted-foreground)]">
											{m.def.damage} · {m.def.range}
										</span>
									{/if}
								</span>
								<span class="rounded bg-[var(--color-accent)]/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
									{m.kind}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else if query && matches.length === 0 && !pending}
				<p class="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-3 text-xs text-[var(--color-muted-foreground)]">
					No matches in the content pack. Press <kbd class="rounded border border-[var(--color-border)] px-1 text-[10px]">Esc</kbd> to clear.
				</p>
			{/if}
		</div>
	</div>

	{#if pending}
		<div class="rounded-md border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-3">
			<div class="flex items-baseline justify-between gap-3">
				<div>
					<span class="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
						Pending {pending.kind}
					</span>
					<p class="font-medium" data-heading>{matchName(pending)}</p>
					{#if pending.kind === 'weapon'}
						<p class="text-xs text-[var(--color-muted-foreground)]">
							{pending.def.damage} damage · {pending.def.range} · {pending.def.attacksPerRound}/round
						</p>
					{/if}
				</div>
				<button
					type="button"
					onclick={clearPending}
					class="text-xs text-[var(--color-muted-foreground)] underline-offset-4 hover:underline"
				>
					Clear
				</button>
			</div>

			{#if pending.kind === 'item'}
				<label class="mt-2 flex items-center gap-2 text-sm">
					<span>Quantity</span>
					<input
						type="number"
						bind:value={pendingQuantity}
						min="1"
						max="9999"
						class="w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-sm"
					/>
				</label>
			{/if}

			<button
				type="button"
				onclick={() => push(deltaForPending, 'Item')}
				disabled={busy}
				class="mt-3 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{busy ? 'Pushing…' : `Push ${pending.kind} to player`}
			</button>
		</div>
	{/if}

	<div class="border-t border-[var(--color-border)] pt-3">
		<label for="cash-delta" class="block text-sm">
			<span class="font-medium">Adjust cash</span>
			<span class="ml-1 text-xs text-[var(--color-muted-foreground)]">(positive adds, negative subtracts)</span>
		</label>
		<div class="mt-1 flex items-center gap-2">
			<input
				id="cash-delta"
				type="number"
				bind:value={cashDelta}
				class="w-32 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-sm"
			/>
			<button
				type="button"
				onclick={() => push(deltaForCash, 'Cash')}
				disabled={busy || !cashDelta}
				class="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
			>
				Apply
			</button>
		</div>
	</div>

	{#if error}
		<p class="rounded-md border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 p-2 text-xs text-[var(--color-destructive)]">
			{error}
		</p>
	{/if}
	{#if success}
		<p class="rounded-md border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 p-2 text-xs text-[var(--color-primary)]">
			{success}
		</p>
	{/if}
</section>
