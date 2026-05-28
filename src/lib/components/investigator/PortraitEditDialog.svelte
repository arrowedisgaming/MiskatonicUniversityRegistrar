<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import PortraitUrlField from '$lib/components/investigator/PortraitUrlField.svelte';
	import { validatePortraitUrl } from '$lib/engine/portrait-url';
	import type { CoCCharacterData } from '$lib/types/character';

	type Props = {
		investigatorName: string;
		initialPortraitUrl: string;
		buildPayload: (portraitUrl: string) => CoCCharacterData;
		persist: (character: CoCCharacterData) => Promise<{ ok: true } | { ok: false; message: string }>;
		disabled?: boolean;
	};

	let {
		investigatorName,
		initialPortraitUrl,
		buildPayload,
		persist,
		disabled = false
	}: Props = $props();

	let open = $state(false);
	let draftUrl = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);

	const validation = $derived(validatePortraitUrl(draftUrl));
	const canSave = $derived(validation.ok && !busy && !disabled);

	function toggleOpen() {
		if (disabled) return;
		open = !open;
		if (open) {
			draftUrl = initialPortraitUrl;
			error = null;
			busy = false;
		}
	}

	function handleDraftChange(value: string) {
		draftUrl = value;
		error = null;
	}

	async function save() {
		if (!canSave || !validation.ok) return;
		busy = true;
		error = null;
		try {
			const next = buildPayload(validation.value);
			const result = await persist(next);
			if (!result.ok) {
				error = result.message;
				return;
			}
			open = false;
			await invalidateAll();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Save failed';
		} finally {
			busy = false;
		}
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={toggleOpen}
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-label="Edit portrait"
		disabled={disabled}
		class="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-xs shadow-sm transition-colors hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
	>
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
			<path d="m2.695 14.763-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885l6.364-6.364a2.5 2.5 0 0 0-3.536-3.536l-6.364 6.364a4 4 0 0 0-.885 1.343Z" />
		</svg>
	</button>

	{#if open}
		<div
			role="dialog"
			aria-label="Edit portrait"
			class="fixed inset-x-4 top-20 z-50 w-auto rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-lg sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:z-40 sm:mt-2 sm:w-[min(24rem,calc(100vw-2rem))]"
		>
			<div class="flex items-start justify-between gap-2">
				<div>
					<h3 class="text-sm font-semibold">Edit portrait</h3>
					<p class="mt-1 text-xs text-[var(--color-muted-foreground)]">
						Set a portrait URL for this investigator.
					</p>
				</div>
				<button
					type="button"
					onclick={() => (open = false)}
					aria-label="Close portrait editor"
					class="cursor-pointer rounded p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
				>
					&times;
				</button>
			</div>

			<div class="mt-4">
				<PortraitUrlField
					id="portrait-edit-url"
					name={investigatorName}
					value={draftUrl}
					onchange={handleDraftChange}
				/>
			</div>

			{#if error}
				<p class="mt-3 text-xs text-[var(--color-destructive)]">{error}</p>
			{/if}

			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					onclick={() => (open = false)}
					disabled={busy}
					class="cursor-pointer rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-accent)] disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={save}
					disabled={!canSave}
					class="cursor-pointer rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] disabled:opacity-50"
				>
					{busy ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	{/if}
</div>
