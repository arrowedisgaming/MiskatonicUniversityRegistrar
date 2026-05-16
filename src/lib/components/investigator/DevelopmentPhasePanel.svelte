<script lang="ts">
	import type { SkillDevelopmentMark } from '$lib/types/character';

	type Props = {
		marks: SkillDevelopmentMark[];
		disabled?: boolean;
		onRoll: (mark: SkillDevelopmentMark) => void | Promise<void>;
		onRollAll: () => void | Promise<void>;
		onClear: (mark: SkillDevelopmentMark) => void | Promise<void>;
	};

	let { marks, disabled = false, onRoll, onRollAll, onClear }: Props = $props();
</script>

{#if marks.length > 0}
	<section class="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-3">
		<details open>
			<summary class="cursor-pointer text-sm font-semibold" data-heading>
				Development Phase ({marks.length})
			</summary>
			<div class="mt-3 space-y-3">
				<div class="flex justify-end">
					<button
						type="button"
						onclick={onRollAll}
						disabled={disabled || marks.length === 0}
						class="rounded-[var(--radius)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-foreground)] disabled:opacity-50"
					>
						Roll all
					</button>
				</div>
				<ul class="space-y-2 text-sm">
					{#each marks as mark (mark.id)}
						<li class="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--color-border)]/60 px-3 py-2">
							<div>
								<p class="font-medium">{mark.skillDisplayLabel}</p>
								<p class="text-xs text-[var(--color-muted-foreground)]">
									{mark.source === 'automatic' ? 'Marked from a roll' : 'Marked manually'}
								</p>
							</div>
							<div class="flex gap-2">
								<button
									type="button"
									onclick={() => onRoll(mark)}
									disabled={disabled}
									class="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs font-medium hover:bg-[var(--color-accent)] disabled:opacity-50"
								>
									Roll
								</button>
								<button
									type="button"
									onclick={() => onClear(mark)}
									disabled={disabled}
									class="rounded-[var(--radius)] border border-[var(--color-border)] px-2 py-1 text-xs font-medium hover:bg-[var(--color-accent)] disabled:opacity-50"
								>
									Clear
								</button>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</details>
	</section>
{/if}
