<script lang="ts">
	import type { PlayRollHistoryEntry } from '$lib/types/character';

	type Props = {
		investigatorName: string;
		entry: PlayRollHistoryEntry;
		/** ms since epoch — wire contract is uniform across initial load and poll. */
		createdAt: number;
	};
	let { investigatorName, entry, createdAt }: Props = $props();

	function formatTime(ms: number): string {
		return new Date(ms).toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	const heading = $derived.by(() => {
		switch (entry.targetKind) {
			case 'characteristic':
				return entry.characteristicId?.toUpperCase() ?? 'Characteristic';
			case 'skill':
				return entry.skillDisplayLabel ?? entry.skillId ?? 'Skill';
			case 'weaponDamage':
				return entry.segmentLabel ? `${entry.weaponName} (${entry.segmentLabel})` : entry.weaponName;
			case 'skillDevelopment':
				return `${entry.skillDisplayLabel} development`;
			case 'sanCheck':
				return 'SAN check';
			case 'sanLoss': {
				// `entry.source` is the user-described trigger ("Witnessed the
				// corpse", "Mythos tome reading", etc.). The SAN tools panel
				// falls back to the literal string "SAN loss" when no source
				// was given — skip the suffix in that case so we don't render
				// "SAN loss · SAN loss".
				const src = entry.source?.trim();
				return src && src.toLowerCase() !== 'san loss' ? `SAN loss · ${src}` : 'SAN loss';
			}
			case 'genericDice':
				return entry.label?.trim() || 'Dice';
			case 'keeperInventory':
				return `Keeper inventory · ${entry.addedBy}`;
		}
	});

	const body = $derived.by(() => {
		switch (entry.targetKind) {
			case 'characteristic':
			case 'skill':
				return `${entry.outcome} — rolled ${entry.effectiveRoll} vs target ${entry.target}${entry.isFumble ? ' (fumble)' : ''}`;
			case 'weaponDamage':
				return `${entry.formula} = ${entry.total}`;
			case 'skillDevelopment':
				return `Eligibility ${entry.eligibilityRoll} ${entry.eligibilityPassed ? '✓' : '✗'}, +${entry.improvement} → ${entry.afterTotal}`;
			case 'sanCheck':
				return `${entry.outcome} — ${entry.effectiveRoll}/${entry.target}${entry.isFumble ? ' (fumble)' : ''}`;
			case 'sanLoss':
				return `Lost ${entry.applied} (${entry.sanBefore} → ${entry.sanAfter})${entry.triggeredIndefinite ? ' · indefinite madness' : entry.triggeredTemporary ? ' · temporary madness' : ''}`;
			case 'genericDice':
				return `${entry.count}d${entry.sides}${entry.modifier ? (entry.modifier > 0 ? `+${entry.modifier}` : entry.modifier) : ''} = ${entry.total}`;
			case 'keeperInventory':
				return entry.itemNames.join(', ');
		}
	});
</script>

<li class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
	<div class="flex items-baseline justify-between gap-3">
		<div>
			<span class="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
				{investigatorName}
			</span>
			<span class="ml-2 font-medium" data-heading>{heading}</span>
		</div>
		<time class="flex-none text-xs text-[var(--color-muted-foreground)]" datetime={new Date(createdAt).toISOString()}>
			{formatTime(createdAt)}
		</time>
	</div>
	<p class="mt-1 text-sm text-[var(--color-muted-foreground)]">{body}</p>
</li>
