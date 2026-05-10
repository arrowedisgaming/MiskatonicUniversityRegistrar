<script lang="ts">
	import { tick } from 'svelte';
	import { get } from 'svelte/store';
	import {
		DICE_COLOR_LABELS,
		DICE_COLOR_PRESETS,
		DICE_TEXTURE_LABELS,
		DICE_TEXTURE_PRESETS,
		type DiceAppearancePrefs,
		type DiceColorPreset,
		type DiceTexturePreset,
		diceColorPreviewBackground
	} from '$lib/dice/dice-appearance';
	import { diceRollAnimationsEnabled } from '$lib/stores/dice-rolls';
	import { diceAppearance } from '$lib/stores/dice-appearance';

	let { open = $bindable(false) } = $props();

	let draftRoll3d = $state(true);
	let draftPrefs = $state<DiceAppearancePrefs>({ ...get(diceAppearance) });
	let dialogEl = $state<HTMLElement | null>(null);
	let previouslyFocused: HTMLElement | null = null;

	$effect(() => {
		if (!open) return;
		draftRoll3d = get(diceRollAnimationsEnabled);
		draftPrefs = { ...get(diceAppearance) };
		previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		void tick().then(() => {
			if (!open || !dialogEl) return;
			const first = focusableElements()[0] ?? dialogEl;
			first.focus();
		});
	});

	function focusableElements(): HTMLElement[] {
		if (!dialogEl) return [];
		return Array.from(
			dialogEl.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
			)
		).filter((el) => el.offsetParent !== null || el === document.activeElement);
	}

	function closeAndRestoreFocus() {
		open = false;
		const target = previouslyFocused;
		previouslyFocused = null;
		if (target && document.contains(target)) {
			void tick().then(() => target.focus());
		}
	}

	function save() {
		diceRollAnimationsEnabled.set(draftRoll3d);
		diceAppearance.set(draftPrefs);
		closeAndRestoreFocus();
	}

	function cancel() {
		closeAndRestoreFocus();
	}

	function handleBackdropPointerDown(event: PointerEvent) {
		if (event.target === event.currentTarget) cancel();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			cancel();
			return;
		}
		if (event.key !== 'Tab') return;
		const focusables = focusableElements();
		if (focusables.length === 0) {
			event.preventDefault();
			dialogEl?.focus();
			return;
		}
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		const active = document.activeElement;
		if (event.shiftKey) {
			if (active === first || !dialogEl?.contains(active)) {
				event.preventDefault();
				last.focus();
			}
		} else {
			if (active === last || !dialogEl?.contains(active)) {
				event.preventDefault();
				first.focus();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-black/25"
		role="presentation"
		aria-hidden="true"
		onpointerdown={handleBackdropPointerDown}
	></div>

	<div
		bind:this={dialogEl}
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		aria-labelledby="dice-settings-title"
		class="fixed z-50 max-h-[min(85vh,calc(100vh-5rem))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-lg sm:right-4 sm:top-16 sm:left-auto sm:translate-x-0 left-1/2 top-16 -translate-x-1/2 focus:outline-none"
	>
		<h2 id="dice-settings-title" class="text-base font-semibold text-[var(--color-foreground)]">
			Dice rolls
		</h2>
		<p class="mt-1 text-xs text-[var(--color-muted-foreground)]">
			Choose whether rolls animate in 3D, then save. Cancel returns without changing anything.
		</p>

		<div class="mt-4">
			<span class="text-xs font-medium uppercase text-[var(--color-muted-foreground)]">Roll style</span>
			<div
				class="mt-2 grid grid-cols-2 gap-2 rounded-md border border-[var(--color-border)] p-1"
				role="radiogroup"
				aria-label="Roll style"
			>
				<button
					type="button"
					class="rounded-sm px-2 py-2 text-sm transition-colors {draftRoll3d
						? 'bg-[var(--color-accent)] text-[var(--color-foreground)]'
						: 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]/50'}"
					role="radio"
					aria-checked={draftRoll3d}
					onclick={() => (draftRoll3d = true)}
				>
					3D dice
				</button>
				<button
					type="button"
					class="rounded-sm px-2 py-2 text-sm transition-colors {!draftRoll3d
						? 'bg-[var(--color-accent)] text-[var(--color-foreground)]'
						: 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]/50'}"
					role="radio"
					aria-checked={!draftRoll3d}
					onclick={() => (draftRoll3d = false)}
				>
					No dice
				</button>
			</div>
			<p class="mt-1 text-xs text-[var(--color-muted-foreground)]">
				“No dice” skips the 3D overlay; results still resolve immediately.
			</p>
		</div>

		<div
			class="mt-6 space-y-4 {draftRoll3d ? '' : 'pointer-events-none opacity-45'}"
			aria-hidden={!draftRoll3d}
		>
			<div>
				<span class="text-xs font-medium uppercase text-[var(--color-muted-foreground)]">Surface pattern</span>
				<div class="mt-2 grid grid-cols-1 gap-2" role="radiogroup" aria-label="Dice surface pattern">
					{#each DICE_TEXTURE_PRESETS as preset (preset)}
						<button
							type="button"
							class="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] p-2.5 text-left text-sm transition-colors hover:bg-[var(--color-accent)] {draftPrefs.texture === preset
								? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-card)]'
								: ''}"
							role="radio"
							aria-checked={draftPrefs.texture === preset}
							disabled={!draftRoll3d}
							onclick={() => (draftPrefs = { ...draftPrefs, texture: preset as DiceTexturePreset })}
						>
							<span class="font-medium">{DICE_TEXTURE_LABELS[preset]}</span>
							<span class="text-xs text-[var(--color-muted-foreground)]">
								{preset === 'marble' && 'Cool, marbled veins.'}
								{preset === 'wood' && 'Wood rings; warm and matte.'}
								{preset === 'stars' && 'Pinprick lights.'}
							</span>
						</button>
					{/each}
				</div>
			</div>

			<div>
				<span class="text-xs font-medium uppercase text-[var(--color-muted-foreground)]">Face tint</span>
				<div class="mt-2 grid grid-cols-1 gap-2" role="radiogroup" aria-label="Dice face tint">
					{#each DICE_COLOR_PRESETS as preset (preset)}
						<button
							type="button"
							class="flex items-center gap-3 rounded-lg border border-[var(--color-border)] p-2.5 text-left text-sm transition-colors hover:bg-[var(--color-accent)] {draftPrefs.color === preset
								? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-card)]'
								: ''}"
							role="radio"
							aria-checked={draftPrefs.color === preset}
							disabled={!draftRoll3d}
							onclick={() => (draftPrefs = { ...draftPrefs, color: preset as DiceColorPreset })}
						>
							<span
								class="h-10 w-14 shrink-0 rounded-md border border-[var(--color-border)] shadow-inner"
								style:background={diceColorPreviewBackground(preset)}
								aria-hidden="true"
							></span>
							<span class="font-medium">{DICE_COLOR_LABELS[preset]}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<div class="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] pt-4">
			<button
				type="button"
				class="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm transition-colors hover:bg-[var(--color-accent)]"
				onclick={cancel}
			>
				Cancel
			</button>
			<button
				type="button"
				class="rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
				onclick={save}
			>
				Save
			</button>
		</div>
	</div>
{/if}
