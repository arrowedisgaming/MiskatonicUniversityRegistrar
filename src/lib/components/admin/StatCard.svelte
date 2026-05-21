<script lang="ts">
	type Props = {
		label: string;
		value: number | string;
		sublabel?: string;
	};
	let { label, value, sublabel }: Props = $props();
	const formatted = $derived(typeof value === 'number' ? value.toLocaleString() : value);
</script>

<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
	<div class="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
		{label}
	</div>
	<div class="mt-1 text-2xl font-bold tabular-nums" data-heading>{formatted}</div>
	{#if sublabel}
		<div class="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{sublabel}</div>
	{/if}
</div>
