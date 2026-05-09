<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { wizard, WIZARD_STEPS, type WizardDraftSummary } from '$lib/stores/wizard';
	import { announce } from '$lib/stores/announcer';

	let resumeChoice = $state(false);
	let summary = $state<WizardDraftSummary | null>(null);

	onMount(() => {
		if (wizard.hasInProgressDraft()) {
			summary = wizard.draftSummary();
			resumeChoice = true;
		} else {
			wizard.start();
			void goto(WIZARD_STEPS[0].path, { replaceState: true });
		}
	});

	function stepLabelFor(idx: number): string {
		return WIZARD_STEPS[idx]?.label ?? WIZARD_STEPS[0].label;
	}

	async function resume() {
		const targetIdx = summary?.currentStep ?? 0;
		const path = WIZARD_STEPS[targetIdx]?.path ?? WIZARD_STEPS[0].path;
		await goto(path, { replaceState: true });
	}

	async function startOver() {
		const ok = confirm('Discard the in-progress investigator and start fresh? This cannot be undone.');
		if (!ok) return;
		wizard.reset();
		wizard.start();
		announce('Wizard reset. Starting fresh.');
		await goto(WIZARD_STEPS[0].path, { replaceState: true });
	}
</script>

{#if resumeChoice && summary}
	<div class="mx-auto max-w-xl rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-6">
		<h1 class="text-2xl font-bold" data-heading>Resume your investigator?</h1>
		<p class="mt-2 text-sm text-[var(--color-muted-foreground)]">
			You have an in-progress investigator saved on this device.
		</p>

		<dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-[var(--color-muted-foreground)]">Name</dt>
			<dd class="font-medium">{summary.name}</dd>
			<dt class="text-[var(--color-muted-foreground)]">Current step</dt>
			<dd class="font-medium">{stepLabelFor(summary.currentStep)}</dd>
		</dl>

		<div class="mt-6 flex flex-wrap gap-3">
			<button
				type="button"
				onclick={resume}
				class="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90"
			>
				Resume
			</button>
			<button
				type="button"
				onclick={startOver}
				class="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-accent)]"
			>
				Start Over
			</button>
		</div>

		<p class="mt-4 text-xs text-[var(--color-muted-foreground)]">
			"Start Over" clears the saved draft and begins a new investigator from the first step.
		</p>
	</div>
{:else}
	<p class="mx-auto max-w-xl text-sm text-[var(--color-muted-foreground)]">Loading…</p>
{/if}
