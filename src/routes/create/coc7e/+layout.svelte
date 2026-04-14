<script lang="ts">
	import WizardShell from '$lib/components/wizard/WizardShell.svelte';
	import { wizard } from '$lib/stores/wizard';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		// Auto-start wizard if not active
		if (!$wizard.active) {
			wizard.start();
		}
	});
</script>

<svelte:head>
	<title>Create Investigator — Miskatonic University Registrar</title>
</svelte:head>

<WizardShell>
	{@render children()}
</WizardShell>
