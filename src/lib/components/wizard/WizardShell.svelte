<script lang="ts">
	import { page } from '$app/state';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import { announce } from '$lib/stores/announcer';
	import { ledgerPage } from '$lib/transitions/eerie';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let currentPath = $derived(page.url.pathname);
	let currentStepIndex = $derived(
		WIZARD_STEPS.findIndex((s) => currentPath.includes(s.id))
	);

	let lastAnnouncedStep = -1;
	$effect(() => {
		if (currentStepIndex !== -1 && currentStepIndex !== lastAnnouncedStep) {
			lastAnnouncedStep = currentStepIndex;
			const step = WIZARD_STEPS[currentStepIndex];
			announce(`Step ${currentStepIndex + 1} of ${WIZARD_STEPS.length}: ${step.label}.`);
		}
	});
</script>

<div class="mx-auto max-w-5xl px-4 py-6">
	<!-- Step indicator -->
	<nav class="mb-8" aria-label="Character creation progress">
		<ol class="flex flex-wrap items-center gap-1 sm:gap-2">
			{#each WIZARD_STEPS as step, i}
				{@const isActive = i === currentStepIndex}
				{@const isComplete = $wizard.completedSteps.some((s) => s === i)}
				{@const isAccessible = i <= $wizard.currentStep || isComplete}
				<li class="flex items-center">
					{#if i > 0}
						<span class="mx-1 text-[var(--color-muted-foreground)] sm:mx-2">/</span>
					{/if}
					{#if isAccessible}
						<a
							href={step.path}
							class="text-sm transition-colors {isActive
								? 'font-semibold text-[var(--color-primary)]'
								: isComplete
									? 'text-[var(--color-foreground)]'
									: 'text-[var(--color-muted-foreground)]'}"
							aria-current={isActive ? 'step' : undefined}
						>
							<span class="hidden sm:inline">{step.label}</span>
							<span class="sm:hidden">{i + 1}</span>
						</a>
					{:else}
						<span class="text-sm text-[var(--color-muted-foreground)] opacity-50">
							<span class="hidden sm:inline">{step.label}</span>
							<span class="sm:hidden">{i + 1}</span>
						</span>
					{/if}
				</li>
			{/each}
		</ol>

		<!-- Progress bar -->
		<div class="mt-3 h-1 w-full rounded-full bg-[var(--color-muted)]">
			<div
				class="h-1 rounded-full bg-[var(--color-primary)] transition-all duration-300"
				style="width: {((currentStepIndex + 1) / WIZARD_STEPS.length) * 100}%"
			></div>
		</div>
	</nav>

	<!-- Step content -->
	{#key currentPath}
		<div in:ledgerPage|global>
			{@render children()}
		</div>
	{/key}
</div>
