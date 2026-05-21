<script lang="ts">
	type Props = {
		points: { day: string; count: number }[];
		label: string;
		width?: number;
		height?: number;
	};
	let { points, label, width = 320, height = 64 }: Props = $props();

	const max = $derived(Math.max(1, ...points.map((p) => p.count)));
	const total = $derived(points.reduce((acc, p) => acc + p.count, 0));
	const bars = $derived.by(() => {
		if (points.length === 0) return [];
		// Bar chart with 2px gaps. Min bar height of 1px for non-zero so tiny counts are visible.
		const gap = 2;
		const barWidth = Math.max(1, (width - gap * (points.length - 1)) / points.length);
		return points.map((p, i) => {
			const h = p.count === 0 ? 0 : Math.max(1, (p.count / max) * (height - 4));
			return {
				x: i * (barWidth + gap),
				y: height - h,
				w: barWidth,
				h,
				day: p.day,
				count: p.count
			};
		});
	});
</script>

<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
	<div class="mb-2 flex items-baseline justify-between">
		<div class="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
			{label} <span class="opacity-60">· 30d</span>
		</div>
		<div class="text-sm font-semibold tabular-nums">{total.toLocaleString()}</div>
	</div>
	<svg
		viewBox="0 0 {width} {height}"
		width="100%"
		height={height}
		preserveAspectRatio="none"
		role="img"
		aria-label="{label} over the last 30 days, {total} total"
	>
		{#each bars as bar}
			<rect
				x={bar.x}
				y={bar.y}
				width={bar.w}
				height={bar.h}
				fill="var(--color-primary)"
				opacity={bar.count === 0 ? 0.15 : 0.85}
			>
				<title>{bar.day}: {bar.count}</title>
			</rect>
		{/each}
	</svg>
	<div class="mt-1 flex justify-between text-[10px] text-[var(--color-muted-foreground)]">
		<span>{points[0]?.day ?? ''}</span>
		<span>{points[points.length - 1]?.day ?? ''}</span>
	</div>
</div>
