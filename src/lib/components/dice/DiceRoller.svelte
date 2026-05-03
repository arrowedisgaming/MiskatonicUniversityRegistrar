<script lang="ts">
	/**
	 * 2D animated dice roller.
	 * CSS keyframe animation on dice faces — visually satisfying, simple implementation.
	 */

	import { announce } from '$lib/stores/announcer';

	let {
		count = 3,
		sides = 6,
		rolling = $bindable(false),
		results = $bindable<number[]>([]),
		onroll
	}: {
		count?: number;
		sides?: number;
		rolling?: boolean;
		results?: number[];
		onroll?: (results: number[]) => void;
	} = $props();

	let animating = $state(false);
	let displayValues = $state<number[]>([]);
	$effect(() => {
		displayValues = Array(count).fill(1);
	});

	function roll() {
		animating = true;
		rolling = true;

		// Animate for 600ms with random intermediate values
		const interval = setInterval(() => {
			displayValues = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
		}, 60);

		setTimeout(() => {
			clearInterval(interval);
			// Final crypto-secure results
			const finalResults: number[] = [];
			if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
				const array = new Uint32Array(count);
				globalThis.crypto.getRandomValues(array);
				for (let i = 0; i < count; i++) {
					finalResults.push((array[i] % sides) + 1);
				}
			} else {
				for (let i = 0; i < count; i++) {
					finalResults.push(Math.floor(Math.random() * sides) + 1);
				}
			}

			displayValues = finalResults;
			results = finalResults;
			animating = false;
			rolling = false;
			const total = finalResults.reduce((a, b) => a + b, 0);
			announce(`Rolled ${finalResults.join(', ')}. Total ${total}.`);
			onroll?.(finalResults);
		}, 600);
	}
</script>

<div class="flex flex-col items-center gap-3">
	<div class="flex gap-2" role="img" aria-label="Dice showing {displayValues.join(', ')}">
		{#each displayValues as value, i}
			<div
				class="flex h-12 w-12 items-center justify-center rounded-md border-2
					border-[var(--color-border)] bg-[var(--color-card)] text-lg font-bold
					text-[var(--color-foreground)] shadow-md transition-transform
					{animating ? 'animate-bounce' : ''}"
				style="animation-delay: {i * 50}ms"
			>
				{value}
			</div>
		{/each}
	</div>

	<button
		type="button"
		onclick={roll}
		disabled={animating}
		class="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium
			text-[var(--color-primary-foreground)] transition-colors
			hover:opacity-90 disabled:opacity-50"
	>
		{animating ? 'Rolling...' : 'Roll'}
	</button>
</div>
