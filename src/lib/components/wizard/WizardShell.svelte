<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import { announce } from '$lib/stores/announcer';
	import { ledgerPage } from '$lib/transitions/eerie';
	import ScrollHint from './ScrollHint.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let currentPath = $derived(page.url.pathname);
	let currentStepIndex = $derived(
		WIZARD_STEPS.findIndex((s) => currentPath.includes(s.id))
	);
	let onStepRoute = $derived(currentStepIndex !== -1);

	// Deep-link guard: a direct visit to a wizard step URL with no active draft
	// (e.g. an incognito user pasting a /create/coc7e/skills link) lands on a
	// blank wizard. Starting it here ensures the step renders against an
	// initialized active state. We never overwrite an existing active draft.
	$effect(() => {
		if (onStepRoute && !$wizard.active) {
			wizard.start();
			void goto(WIZARD_STEPS[0].path, { replaceState: true });
		}
	});

	let lastAnnouncedStep = -1;
	$effect(() => {
		if (currentStepIndex !== -1 && currentStepIndex !== lastAnnouncedStep) {
			lastAnnouncedStep = currentStepIndex;
			const step = WIZARD_STEPS[currentStepIndex];
			announce(`Step ${currentStepIndex + 1} of ${WIZARD_STEPS.length}: ${step.label}.`);
		}
	});

	async function confirmStartOver() {
		const ok = confirm('Discard this investigator and start over? This will clear all entered data.');
		if (!ok) return;
		wizard.reset();
		wizard.start();
		announce('Wizard reset. Starting fresh.');
		await goto(WIZARD_STEPS[0].path, { replaceState: true });
	}
</script>

<div class="mx-auto max-w-4xl px-4 py-6">
	<!-- Step indicator -->
	{#if onStepRoute}
		<nav class="mb-8" aria-label="Character creation progress">
			<div class="flex items-center justify-between gap-3">
				<ol class="flex flex-wrap items-center gap-[clamp(0.25rem,1.5vw,0.75rem)]">
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

				<button
					type="button"
					onclick={confirmStartOver}
					class="shrink-0 text-xs text-[var(--color-muted-foreground)] underline-offset-2 transition-colors hover:text-[var(--color-destructive)] hover:underline"
				>
					Start over
				</button>
			</div>

			<!-- Progress bar -->
			<div class="mt-3 h-1 w-full rounded-full bg-[var(--color-muted)]">
				<div
					class="h-1 rounded-full bg-[var(--color-primary)] transition-all duration-300"
					style="width: {((currentStepIndex + 1) / WIZARD_STEPS.length) * 100}%"
				></div>
			</div>
		</nav>
	{/if}

	<!-- Step content. Keyed on `currentPath + $wizard.nonce` so the +page
	     remounts whenever the wizard is reset/restarted — this is the only
	     reliable way to re-initialise the step's local $state (allocations,
	     selected method, etc.) since navigating /characteristics → /characteristics
	     after a reset is otherwise a no-op for SvelteKit and component
	     instances persist across same-route gotos. -->
	{#key `${currentPath}-${$wizard.nonce}`}
		<div in:ledgerPage|global>
			{@render children()}
		</div>
	{/key}
</div>

<ScrollHint />
