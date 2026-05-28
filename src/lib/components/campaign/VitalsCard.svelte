<script lang="ts">
	import type { DashboardMemberVitals } from '$lib/server/campaign/rolls';
	import type { PlayRollHistoryEntry } from '$lib/types/character';
	import InvestigatorPortrait from '$lib/components/investigator/InvestigatorPortrait.svelte';

	type Props = {
		vitals: DashboardMemberVitals;
	};
	let { vitals }: Props = $props();

	function relativeTime(ms: number | null): string {
		if (ms === null) return '—';
		const diffMs = Date.now() - ms;
		const sec = Math.max(0, Math.floor(diffMs / 1000));
		if (sec < 60) return `${sec}s ago`;
		const min = Math.floor(sec / 60);
		if (min < 60) return `${min}m ago`;
		const hr = Math.floor(min / 60);
		if (hr < 24) return `${hr}h ago`;
		return new Date(ms).toLocaleString();
	}

	function summarizeRoll(entry: PlayRollHistoryEntry | null): string {
		if (!entry) return 'No rolls yet';
		switch (entry.targetKind) {
			case 'characteristic':
			case 'skill':
				return `${entry.skillDisplayLabel ?? entry.characteristicId ?? 'roll'} — ${entry.outcome} (${entry.effectiveRoll}/${entry.target})`;
			case 'weaponDamage':
				return `${entry.weaponName}: ${entry.total} damage`;
			case 'skillDevelopment':
				return `${entry.skillDisplayLabel} dev (+${entry.improvement})`;
			case 'sanCheck':
				return `SAN check — ${entry.outcome} (${entry.effectiveRoll}/${entry.target})`;
			case 'sanLoss': {
				const src = entry.source?.trim();
				const tail = src && src.toLowerCase() !== 'san loss' ? ` (${src})` : '';
				return `SAN loss: ${entry.applied}${tail}`;
			}
			case 'genericDice':
				return entry.label?.trim() || `Dice: ${entry.total}`;
			case 'keeperInventory':
				return `Keeper added: ${entry.itemNames.join(', ')}`;
		}
	}

	function bar(stat: { max: number; current: number }, color: string): string {
		const max = Math.max(1, stat.max);
		const pct = Math.max(0, Math.min(100, (stat.current / max) * 100));
		return `linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%)`;
	}
</script>

<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
	<div class="flex items-start gap-3">
		<InvestigatorPortrait
			name={vitals.investigatorName}
			portraitUrl={vitals.portraitUrl}
			size="md"
		/>
		<div class="min-w-0 flex-1">
			<!-- Only render as a link for the caller's own row — see DashboardMemberVitals.belongsToCaller. -->
			{#if vitals.belongsToCaller}
				<a href="/sheet/{vitals.investigatorId}" class="block font-semibold no-underline hover:underline" data-heading>
					{vitals.investigatorName}
				</a>
			{:else}
				<p class="block font-semibold" data-heading>{vitals.investigatorName}</p>
			{/if}
			{#if vitals.occupation}
				<p class="truncate text-xs text-[var(--color-muted-foreground)]">{vitals.occupation}</p>
			{/if}
		</div>
	</div>

	<dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
		<div>
			<dt class="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">HP</dt>
			<dd>
				<div class="h-1.5 rounded-full bg-[var(--color-muted)]/30" style="background-image: {bar(vitals.hp, 'var(--color-destructive)')}"></div>
				<span>{vitals.hp.current}/{vitals.hp.max}</span>
			</dd>
		</div>
		<div>
			<dt class="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">Sanity</dt>
			<dd>
				<div class="h-1.5 rounded-full bg-[var(--color-muted)]/30" style="background-image: {bar(vitals.sanity, 'var(--color-primary)')}"></div>
				<span>{vitals.sanity.current}/{vitals.sanity.max}</span>
			</dd>
		</div>
		<div>
			<dt class="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">MP</dt>
			<dd>{vitals.mp.current}/{vitals.mp.max}</dd>
		</div>
		<div>
			<dt class="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">Luck</dt>
			<!-- Luck has no meaningful max in play — CoC 7e starts at a rolled value
			     but spends down without refresh. Show only the current pool. -->
			<dd>{vitals.luck.current}</dd>
		</div>
	</dl>

	<p class="mt-3 truncate text-xs text-[var(--color-muted-foreground)]" title={summarizeRoll(vitals.lastRoll)}>
		<span class="text-[10px] uppercase tracking-wide">Last roll · {relativeTime(vitals.lastRollAt)}</span><br />
		{summarizeRoll(vitals.lastRoll)}
	</p>
</div>
