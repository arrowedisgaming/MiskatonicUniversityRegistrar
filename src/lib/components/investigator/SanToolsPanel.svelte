<script lang="ts">
	import type { PlayTrackingData } from '$lib/types/character';

	type Props = {
		currentSanity: number;
		dailyLoss: number;
		dailyThreshold: number;
		playTracking: PlayTrackingData;
		disabled?: boolean;
		onRollSanCheck: () => void | Promise<void>;
		onRollLoss: (formula: string, outcome: 'success' | 'failure') => void | Promise<void>;
		onApplyManualLoss: (amount: number) => void | Promise<void>;
		onResetDay: () => void | Promise<void>;
		onToggleInsanity: (key: keyof PlayTrackingData['insanity'], value: boolean) => void | Promise<void>;
	};

	let {
		currentSanity,
		dailyLoss,
		dailyThreshold,
		playTracking,
		disabled = false,
		onRollSanCheck,
		onRollLoss,
		onApplyManualLoss,
		onResetDay,
		onToggleInsanity
	}: Props = $props();

	let formula = $state('0/1D6');
	let outcome = $state<'success' | 'failure'>('failure');
	let manualLoss = $state(1);

	function clampInt(value: number, min: number, max: number): number {
		if (!Number.isFinite(value)) return min;
		return Math.max(min, Math.min(max, Math.trunc(value)));
	}

	function adjustManualLoss(delta: number) {
		manualLoss = clampInt(manualLoss + delta, 0, 100);
	}
</script>

<section class="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-3">
	<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
		<div>
			<h3 class="text-sm font-semibold tracking-wide" data-heading>SAN Tools</h3>
			<p class="text-xs text-[var(--color-muted-foreground)]">
				Day loss: {dailyLoss}/{dailyThreshold || '—'}
			</p>
		</div>
		<button
			type="button"
			onclick={onRollSanCheck}
			disabled={disabled}
			class="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-accent)] disabled:opacity-50"
		>
			Roll SAN ({currentSanity})
		</button>
	</div>

	{#if dailyThreshold > 0 && dailyLoss >= dailyThreshold}
		<div
			class="mb-3 rounded-[var(--radius)] border border-[var(--color-border)] border-l-4 border-l-[var(--color-warning)] bg-[color-mix(in_oklch,var(--color-warning)_12%,var(--color-card))] px-3 py-2 text-xs"
			role="status"
		>
			<p class="font-semibold text-[var(--color-warning)]" data-heading>Daily SAN threshold reached</p>
			<p class="mt-0.5 text-[var(--color-muted-foreground)]">
				Cumulative loss today equals one-fifth of starting Sanity — indefinite-insanity check recommended.
			</p>
		</div>
	{/if}

	<div class="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
		<label class="grid gap-1 text-xs">
			<span class="uppercase text-[var(--color-muted-foreground)]">Loss formula</span>
			<input
				type="text"
				bind:value={formula}
				placeholder="0/1D6"
				class="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1"
			/>
		</label>
		<label class="grid gap-1 text-xs">
			<span class="uppercase text-[var(--color-muted-foreground)]">Result</span>
			<select bind:value={outcome} class="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1">
				<option value="success">Success</option>
				<option value="failure">Failure</option>
			</select>
		</label>
		<button
			type="button"
			onclick={() => onRollLoss(formula, outcome)}
			disabled={disabled || !formula.trim()}
			class="self-end rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-foreground)] disabled:opacity-50"
		>
			Roll loss
		</button>
	</div>

	<div class="mt-3 flex flex-wrap items-end gap-2">
		<div class="flex flex-col gap-1 text-xs">
			<span class="uppercase text-[var(--color-muted-foreground)]">Manual loss</span>
			<div class="inline-flex items-stretch overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)]">
				<button
					type="button"
					onclick={() => adjustManualLoss(-1)}
					{disabled}
					aria-label="Decrease manual loss"
					class="px-2 text-sm font-semibold hover:bg-[var(--color-accent)] disabled:opacity-50"
				>−</button>
				<input
					type="number"
					min="0"
					max="100"
					bind:value={manualLoss}
					{disabled}
					aria-label="Manual loss"
					class="w-12 border-x border-[var(--color-border)] bg-transparent py-1 text-center tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				/>
				<button
					type="button"
					onclick={() => adjustManualLoss(1)}
					{disabled}
					aria-label="Increase manual loss"
					class="px-2 text-sm font-semibold hover:bg-[var(--color-accent)] disabled:opacity-50"
				>+</button>
			</div>
		</div>
		<button
			type="button"
			onclick={() => onApplyManualLoss(manualLoss)}
			disabled={disabled}
			class="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-accent)] disabled:opacity-50"
		>
			Apply loss
		</button>
		<button
			type="button"
			onclick={onResetDay}
			disabled={disabled}
			class="rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-accent)] disabled:opacity-50"
		>
			Reset day
		</button>
	</div>

	<div class="mt-3 flex flex-wrap gap-2 text-xs">
		{#each [
			['temporary', 'Temporary Insanity'],
			['indefinite', 'Indefinite Insanity'],
			['boutOfMadness', 'Bout of Madness']
		] as [key, label]}
			{@const active = playTracking.insanity[key as keyof PlayTrackingData['insanity']]}
			<button
				type="button"
				{disabled}
				aria-pressed={active}
				onclick={() =>
					onToggleInsanity(key as keyof PlayTrackingData['insanity'], !active)}
				class="rounded-[var(--radius)] border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 {active
					? 'border-[var(--color-warning)] bg-[color-mix(in_oklch,var(--color-warning)_18%,var(--color-card))] text-[var(--color-warning)]'
					: 'border-[var(--color-border)] bg-transparent text-[var(--color-muted-foreground)] hover:border-[var(--color-foreground)] hover:text-[var(--color-foreground)]'}"
			>
				{label}
			</button>
		{/each}
	</div>
</section>
