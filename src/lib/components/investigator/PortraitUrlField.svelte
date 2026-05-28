<script lang="ts">
	import InvestigatorPortrait from '$lib/components/investigator/InvestigatorPortrait.svelte';
	import { validatePortraitUrl } from '$lib/engine/portrait-url';

	type Props = {
		name: string;
		value: string;
		id?: string;
		onchange?: (value: string) => void;
	};

	let { name, value, id = 'portrait-url', onchange }: Props = $props();

	const validation = $derived(validatePortraitUrl(value));
	const validationMessage = $derived(validation.ok ? null : validation.message);

	function handleInput(event: Event) {
		const next = (event.currentTarget as HTMLInputElement).value;
		onchange?.(next);
	}

	function clear() {
		onchange?.('');
	}
</script>

<div class="space-y-3">
	<div class="flex items-start gap-4">
		<InvestigatorPortrait {name} portraitUrl={value} size="lg" />
		<div class="min-w-0 flex-1 space-y-2">
			<label for={id} class="block text-sm font-medium">Portrait URL</label>
			<input
				{id}
				type="url"
				{value}
				placeholder="https://example.com/portrait.jpg"
				oninput={handleInput}
				class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm
					placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
			/>
			<p class="text-xs text-[var(--color-muted-foreground)]">
				Paste a link to an image hosted elsewhere (e.g. Imgur, Discord, your own site). We don't store
				image files.
			</p>
			{#if validationMessage}
				<p class="text-xs text-[var(--color-destructive)]">{validationMessage}</p>
			{/if}
		</div>
	</div>
	{#if value.trim()}
		<button
			type="button"
			onclick={clear}
			class="cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-accent)]"
		>
			Clear portrait
		</button>
	{/if}
</div>
