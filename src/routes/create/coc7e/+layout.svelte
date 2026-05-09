<script lang="ts">
	import WizardShell from '$lib/components/wizard/WizardShell.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<title>Create Investigator — Miskatonic University Registrar</title>
</svelte:head>

<WizardShell>
	{@render children()}
</WizardShell>
