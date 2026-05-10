<script lang="ts">
	import { get } from 'svelte/store';
	import { tick } from 'svelte';
	import { buildDiceColorset } from '$lib/dice/dice-appearance';
	import { completeDiceRoll, diceRollState, skipActiveDiceRoll } from '$lib/stores/dice-rolls';
	import { diceAppearance } from '$lib/stores/dice-appearance';
	import { toRendererNotation, userFacingResults } from '$lib/dice/protocol';
	import type { DiceThemeCustomColorset } from '@3d-dice/dice-box-threejs';

	type DiceBoxInstance = {
		initialize(): Promise<void>;
		updateConfig(config?: DiceBoxConfig): Promise<void>;
		roll(notation: string): Promise<unknown>;
		clearDice(): void;
	};

	type DiceBoxConstructor = new (selector: string, config?: DiceBoxConfig) => DiceBoxInstance;

	type DiceBoxConfig = {
		assetPath?: string;
		sounds?: boolean;
		shadows?: boolean;
		theme_surface?: string;
		theme_customColorset?: DiceThemeCustomColorset;
		theme_texture?: string;
		theme_material?: string;
		gravity_multiplier?: number;
		light_intensity?: number;
		baseScale?: number;
		strength?: number;
		iterationLimit?: number;
	};

	const OVERLAY_ID = 'dice-roll-overlay-scene';
	const REDUCED_MOTION_DURATION = 350;
	const SETTLE_HOLD_DURATION = 120;

	let container = $state<HTMLElement | null>(null);
	let diceBox = $state<DiceBoxInstance | null>(null);
	let initializing: Promise<DiceBoxInstance> | null = null;
	let visible = $state(false);
	let fallbackVisible = $state(false);
	let fallbackText = $state('');
	let runningRollId: number | null = null;

	$effect(() => {
		const active = $diceRollState;
		if (!active) {
			visible = false;
			fallbackVisible = false;
			fallbackText = '';
			runningRollId = null;
			diceBox?.clearDice();
			return;
		}
		if (active.id === runningRollId) return;
		runningRollId = active.id;
		void runRoll(active.id);
	});

	async function runRoll(id: number): Promise<void> {
		const active = $diceRollState;
		if (!active || active.id !== id) return;

		visible = true;
		const notation = toRendererNotation(active.request);
		const displayResults = userFacingResults(active.request);
		const appearanceSnapshot = get(diceAppearance);
		const colorset = buildDiceColorset(appearanceSnapshot);

		if (prefersReducedMotion() || notation.results.length === 0) {
			await runReducedMotionRoll(id, displayResults);
			return;
		}

		try {
			const box = await getDiceBox(colorset);
			// Each await is a place a skip / next-queued-roll could supersede us.
			// If that's happened, bail BEFORE touching the shared DiceBox so we
			// don't animate stale dice over the next roll.
			if (runningRollId !== id) return;
			await box.updateConfig({ theme_customColorset: colorset });
			if (runningRollId !== id) return;
			await box.roll(notation.notation);
			if (runningRollId !== id) return;
			await delay(SETTLE_HOLD_DURATION);
		} catch (error) {
			if (runningRollId !== id) return;
			console.warn('3D dice roll failed; using reduced-motion fallback.', error);
			await runReducedMotionRoll(id, displayResults);
			return;
		}

		if (runningRollId !== id) return;
		visible = false;
		completeDiceRoll(id);
	}

	async function getDiceBox(colorset: DiceThemeCustomColorset): Promise<DiceBoxInstance> {
		if (diceBox) return diceBox;
		if (initializing) return initializing;

		initializing = (async () => {
			await tick();
			if (!container) throw new Error('Dice roll overlay container is not mounted.');

			const module = await import('@3d-dice/dice-box-threejs');
			const DiceBox = module.default as DiceBoxConstructor;
			// Tuned for ~1.0–1.3s settle on a 1080p viewport with up to 8d6 in flight.
			const box = new DiceBox(`#${OVERLAY_ID}`, {
				assetPath: '/assets/dice-three/',
				sounds: false,
				shadows: true,
				theme_surface: 'mahogany',
				// `texture` and `material` come from theme_customColorset; setting
				// them at the top level here would be redundant — the colorset wins.
				theme_customColorset: colorset,
				gravity_multiplier: 500,
				light_intensity: 0.8,
				baseScale: 85,
				strength: 1.35,
				iterationLimit: 620
			});
			await box.initialize();
			diceBox = box;
			return box;
		})();

		try {
			return await initializing;
		} finally {
			initializing = null;
		}
	}

	async function runReducedMotionRoll(id: number, results: number[]): Promise<void> {
		fallbackText = results.length > 0 ? results.join(' / ') : 'Rolled';
		fallbackVisible = true;
		await delay(REDUCED_MOTION_DURATION);
		if (runningRollId !== id) return;
		fallbackVisible = false;
		visible = false;
		completeDiceRoll(id);
	}

	function prefersReducedMotion(): boolean {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function skipRoll() {
		if (!visible && !fallbackVisible) return;
		skipActiveDiceRoll();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!visible && !fallbackVisible) return;
		if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Escape') return;
		event.preventDefault();
		skipRoll();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="dice-roll-overlay"
	class:dice-roll-overlay--visible={visible}
	role="presentation"
>
	<div id={OVERLAY_ID} bind:this={container} class="dice-roll-overlay__scene"></div>
	{#if visible || fallbackVisible}
		<button
			type="button"
			class="dice-roll-overlay__skip"
			onclick={skipRoll}
			aria-label="Skip dice roll"
		></button>
	{/if}
	{#if fallbackVisible}
		<div class="dice-roll-overlay__fallback">{fallbackText}</div>
	{/if}
</div>
