<script lang="ts">
	import type { SkillSortDirection, SkillSortMode } from '$lib/engine/skill-sort';

	type Props = {
		mode: SkillSortMode;
		direction: SkillSortDirection;
		idPrefix?: string;
		onChange: (next: { mode: SkillSortMode; direction: SkillSortDirection }) => void;
	};

	let { mode, direction, idPrefix = 'skill-sort', onChange }: Props = $props();
</script>

<div class="flex flex-wrap items-end gap-2 text-xs">
	<label class="grid gap-1">
		<span class="font-semibold uppercase text-[var(--color-muted-foreground)]">Sort type</span>
		<select
			id={`${idPrefix}-mode`}
			value={mode}
			onchange={(e) => onChange({ mode: (e.currentTarget as HTMLSelectElement).value as SkillSortMode, direction })}
			class="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1"
		>
			<option value="alphabetical">Alphabetical</option>
			<option value="rating">Rating</option>
		</select>
	</label>
	<label class="grid gap-1">
		<span class="font-semibold uppercase text-[var(--color-muted-foreground)]">Direction</span>
		<select
			id={`${idPrefix}-direction`}
			value={direction}
			onchange={(e) => onChange({ mode, direction: (e.currentTarget as HTMLSelectElement).value as SkillSortDirection })}
			class="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1"
		>
			<option value="asc">Ascending</option>
			<option value="desc">Descending</option>
		</select>
	</label>
</div>
