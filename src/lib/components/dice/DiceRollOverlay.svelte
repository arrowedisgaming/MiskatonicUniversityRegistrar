<script lang="ts">
	import { tick } from 'svelte';
	import { completeDiceRoll, diceRollState } from '$lib/stores/dice-rolls';
	import { toRendererNotation, type DiceScheme } from '$lib/dice/protocol';

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
		theme_customColorset?: DiceColorset;
		theme_texture?: string;
		theme_material?: string;
		gravity_multiplier?: number;
		light_intensity?: number;
		baseScale?: number;
		strength?: number;
		iterationLimit?: number;
	};

	type DiceColorset = {
		name: string;
		foreground: string;
		background: string | string[];
		outline: string;
		edge: string;
		texture: string;
		material: string;
	};

	const OVERLAY_ID = 'dice-roll-overlay-scene';
	const REDUCED_MOTION_DURATION = 650;
	const SETTLE_HOLD_DURATION = 250;

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
		if (!active || active.id === runningRollId) return;
		runningRollId = active.id;
		void runRoll(active.id);
	});

	async function runRoll(id: number): Promise<void> {
		const active = $diceRollState;
		if (!active || active.id !== id) return;

		visible = true;
		const notation = toRendererNotation(active.request);
		const scheme = active.request.scheme ?? resolveCurrentScheme();

		if (prefersReducedMotion() || notation.results.length === 0) {
			await runReducedMotionRoll(id, notation.results);
			return;
		}

		try {
			const box = await getDiceBox(scheme);
			await box.updateConfig({ theme_customColorset: colorsetForScheme(scheme) });
			await box.roll(notation.notation);
			await delay(SETTLE_HOLD_DURATION);
		} catch (error) {
			console.warn('3D dice roll failed; using reduced-motion fallback.', error);
			await runReducedMotionRoll(id, notation.results);
			return;
		}

		visible = false;
		completeDiceRoll(id);
	}

	async function getDiceBox(scheme: DiceScheme): Promise<DiceBoxInstance> {
		if (diceBox) return diceBox;
		if (initializing) return initializing;

		initializing = (async () => {
			await tick();
			if (!container) throw new Error('Dice roll overlay container is not mounted.');

			const module = await import('@3d-dice/dice-box-threejs');
			const DiceBox = module.default as DiceBoxConstructor;
			const box = new DiceBox(`#${OVERLAY_ID}`, {
				assetPath: '/assets/dice-three/',
				sounds: false,
				shadows: true,
				theme_surface: 'green-felt',
				theme_customColorset: colorsetForScheme(scheme),
				theme_texture: 'none',
				theme_material: 'glass',
				gravity_multiplier: 360,
				light_intensity: 0.8,
				baseScale: 85,
				strength: 1.15,
				iterationLimit: 900
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
		fallbackVisible = false;
		visible = false;
		completeDiceRoll(id);
	}

	function resolveCurrentScheme(): DiceScheme {
		return document.documentElement.classList.contains('modern') ? 'modern' : 'classic';
	}

	function colorsetForScheme(scheme: DiceScheme): DiceColorset {
		if (scheme === 'modern') {
			return {
				name: 'miskatonic-modern',
				foreground: '#fff7d7',
				background: ['#2f2410', '#5a390c', '#8d560b', '#b66f0c'],
				outline: '#1b1308',
				edge: '#f4b84a',
				texture: 'none',
				material: 'glass'
			};
		}

		return {
			name: 'miskatonic-classic',
			foreground: '#f4e3ae',
			background: ['#123528', '#174a35', '#235f42', '#6b5524'],
			outline: '#071712',
			edge: '#c89b3c',
			texture: 'none',
			material: 'glass'
		};
	}

	function prefersReducedMotion(): boolean {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
</script>

<div
	class="dice-roll-overlay"
	class:dice-roll-overlay--visible={visible}
	aria-hidden="true"
>
	<div id={OVERLAY_ID} bind:this={container} class="dice-roll-overlay__scene"></div>
	{#if fallbackVisible}
		<div class="dice-roll-overlay__fallback">{fallbackText}</div>
	{/if}
</div>
