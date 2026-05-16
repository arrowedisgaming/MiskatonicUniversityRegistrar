<script lang="ts">
	import { rollDice } from '$lib/engine/dice';
	import { makeDiceRollRequest, type DiceGroup } from '$lib/dice/protocol';
	import { showDiceRoll } from '$lib/stores/dice-rolls';
	import type { DiceSides, PlayRollHistoryGenericDiceEntry } from '$lib/types/character';

	type Props = {
		disabled?: boolean;
		onRoll?: (entry: PlayRollHistoryGenericDiceEntry) => void | Promise<void>;
	};

	let { disabled = false, onRoll }: Props = $props();

	const DIE_OPTIONS: ReadonlyArray<DiceSides> = [3, 4, 6, 8, 10, 12, 20, 100];
	const TRAY_MAX = 20;

	// Polygon-vertex count per die for the silhouette. d100 is rendered as a circle.
	const POLY_SIDES: Record<DiceSides, number> = {
		3: 3, 4: 3, 6: 4, 8: 4, 10: 5, 12: 5, 20: 6, 100: 0
	};
	const POLY_ROTATION: Record<DiceSides, number> = {
		3: -90, 4: 90, 6: -45, 8: 0, 10: -90, 12: 90, 20: -90, 100: 0
	};

	let tray = $state<DiceSides[]>([]);
	let modifier = $state(0);
	let rolling = $state(false);
	let lastTotal = $state<number | null>(null);
	let lastDetail = $state('');

	function polygonPoints(sides: number, rotation: number, radius = 13, cx = 16, cy = 16): string {
		if (sides < 3) return '';
		const pts: string[] = [];
		for (let i = 0; i < sides; i++) {
			const angle = ((rotation + (360 / sides) * i) * Math.PI) / 180;
			const x = cx + radius * Math.cos(angle);
			const y = cy + radius * Math.sin(angle);
			pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
		}
		return pts.join(' ');
	}

	function addDie(sides: DiceSides) {
		if (tray.length >= TRAY_MAX) return;
		tray = [...tray, sides];
	}

	function removeAt(index: number) {
		tray = tray.filter((_, i) => i !== index);
	}

	function clearTray() {
		tray = [];
	}

	function groupTray(): Array<{ count: number; sides: DiceSides }> {
		const counts = new Map<DiceSides, number>();
		for (const s of tray) counts.set(s, (counts.get(s) ?? 0) + 1);
		return Array.from(counts.entries())
			.sort((a, b) => a[0] - b[0])
			.map(([sides, count]) => ({ sides, count }));
	}

	function clampInt(value: number, min: number, max: number): number {
		if (!Number.isFinite(value)) return min;
		return Math.max(min, Math.min(max, Math.trunc(value)));
	}

	function adjustModifier(delta: number) {
		modifier = clampInt(modifier + delta, -999, 999);
	}

	async function rollTray() {
		if (rolling || disabled || tray.length === 0) return;
		const grouped = groupTray();
		const safeModifier = clampInt(modifier, -999, 999);

		rolling = true;
		try {
			const groupsWithRolls = grouped.map((g) => ({ ...g, rolls: rollDice(g.count, g.sides) }));
			const dieTotal = groupsWithRolls.reduce(
				(sum, g) => sum + g.rolls.reduce((s, n) => s + n, 0),
				0
			);
			const total = dieTotal + safeModifier;

			const diceForPopover: DiceGroup[] = groupsWithRolls.map((g) => ({
				count: g.count,
				sides: g.sides,
				results: g.rolls
			}));
			const trayLabel =
				groupsWithRolls.map((g) => `${g.count}d${g.sides}`).join(' + ') +
				(safeModifier ? `${safeModifier > 0 ? '+' : ''}${safeModifier}` : '');

			await showDiceRoll(
				makeDiceRollRequest(diceForPopover, { label: trayLabel, reveal: 'after-settle' })
			);

			const firstGroup = groupsWithRolls[0];
			const totalCount = groupsWithRolls.reduce((s, g) => s + g.count, 0);
			const flatRolls = groupsWithRolls.flatMap((g) => g.rolls);
			const entry: PlayRollHistoryGenericDiceEntry = {
				id: crypto.randomUUID(),
				at: new Date().toISOString(),
				targetKind: 'genericDice',
				sides: firstGroup.sides,
				count: totalCount,
				modifier: safeModifier,
				rolls: flatRolls,
				total,
				label: null,
				groups: groupsWithRolls.map((g) => ({ count: g.count, sides: g.sides, rolls: g.rolls }))
			};

			lastTotal = total;
			lastDetail =
				groupsWithRolls.map((g) => `[${g.rolls.join(', ')}]`).join(' + ') +
				(safeModifier ? ` ${safeModifier > 0 ? '+' : '-'} ${Math.abs(safeModifier)}` : '');
			await onRoll?.(entry);
		} finally {
			rolling = false;
		}
	}
</script>

<section class="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-3">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h3 class="text-sm font-semibold" data-heading>Dice Roller</h3>
		{#if lastTotal !== null}
			<span class="text-sm font-bold tabular-nums">{lastTotal}</span>
		{/if}
	</div>

	<div class="grid grid-cols-4 gap-2 sm:grid-cols-8">
		{#each DIE_OPTIONS as sides}
			<button
				type="button"
				onclick={() => addDie(sides)}
				disabled={disabled || rolling || tray.length >= TRAY_MAX}
				aria-label="Add d{sides} to tray"
				class="flex flex-col items-center gap-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] p-2 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-accent)] disabled:opacity-40"
			>
				<svg viewBox="0 0 32 32" class="dice-icon h-7 w-7 text-[var(--color-foreground)]" aria-hidden="true">
					{#if sides === 100}
						<circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" />
					{:else}
						<polygon
							points={polygonPoints(POLY_SIDES[sides], POLY_ROTATION[sides])}
							fill="none"
							stroke="currentColor"
						/>
					{/if}
				</svg>
				<span class="text-xs font-semibold tabular-nums">d{sides}</span>
			</button>
		{/each}
	</div>

	<div class="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
		<div
			class="flex min-h-10 flex-wrap items-center gap-1.5 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-2"
			aria-label="Dice tray"
		>
			{#if tray.length === 0}
				<span class="text-xs text-[var(--color-muted-foreground)]">Tap dice above to add to the tray.</span>
			{:else}
				{#each tray as sides, index (`${sides}-${index}`)}
					<button
						type="button"
						onclick={() => removeAt(index)}
						disabled={disabled || rolling}
						aria-label="Remove d{sides} from tray"
						class="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-0.5 text-xs hover:border-[var(--color-destructive)] hover:text-[var(--color-destructive)] disabled:opacity-50"
					>
						d{sides}
						<span aria-hidden="true">×</span>
					</button>
				{/each}
			{/if}
		</div>

		<div class="flex items-center gap-1 text-xs">
			<span class="uppercase text-[var(--color-muted-foreground)]">Mod</span>
			<div class="inline-flex items-stretch overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)]">
				<button
					type="button"
					onclick={() => adjustModifier(-1)}
					disabled={disabled || rolling}
					aria-label="Decrease modifier"
					class="px-2 text-sm font-semibold hover:bg-[var(--color-accent)] disabled:opacity-50"
				>−</button>
				<input
					type="number"
					min="-999"
					max="999"
					bind:value={modifier}
					disabled={disabled || rolling}
					aria-label="Modifier"
					class="w-12 border-x border-[var(--color-border)] bg-transparent py-1 text-center tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				/>
				<button
					type="button"
					onclick={() => adjustModifier(1)}
					disabled={disabled || rolling}
					aria-label="Increase modifier"
					class="px-2 text-sm font-semibold hover:bg-[var(--color-accent)] disabled:opacity-50"
				>+</button>
			</div>
		</div>

		<div class="flex gap-2">
			<button
				type="button"
				onclick={clearTray}
				disabled={disabled || rolling || tray.length === 0}
				class="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-accent)] disabled:opacity-50"
			>
				Clear
			</button>
			<button
				type="button"
				onclick={rollTray}
				disabled={disabled || rolling || tray.length === 0}
				class="rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-foreground)] disabled:opacity-50"
			>
				{rolling ? 'Rolling...' : 'Roll'}
			</button>
		</div>
	</div>

	{#if lastDetail}
		<p class="mt-2 text-xs text-[var(--color-muted-foreground)]">{lastDetail}</p>
	{/if}
</section>

<style>
	/* Modern: crisp phosphor traces (DESIGN.md §1.3). */
	:global(.modern) .dice-icon {
		stroke-width: 1.5;
	}
	/* Classic: thicker ink stroke + subtle drop shadow for "ink on paper"
	   per DESIGN.md §1.2 (antique ink text-shadow on [data-heading]). */
	:global(.classic) .dice-icon {
		stroke-width: 1.75;
		filter: drop-shadow(0 0.5px 0 color-mix(in oklch, var(--color-foreground) 40%, transparent));
	}
	/* Reduced motion / effects toggle: keep stroke change, drop the shadow. */
	:global(.classic[data-reduce-effects]) .dice-icon,
	:global(html[data-reduce-effects].classic) .dice-icon {
		filter: none;
	}
</style>
