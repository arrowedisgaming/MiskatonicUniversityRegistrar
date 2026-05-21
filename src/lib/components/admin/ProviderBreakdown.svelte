<script lang="ts">
	type Props = {
		providers: { provider: string; userCount: number }[];
	};
	let { providers }: Props = $props();

	const palette: Record<string, string> = {
		google: '#4285f4',
		discord: '#5865f2',
		credentials: '#888888'
	};
	const fallback = '#a78bfa';

	const total = $derived(providers.reduce((acc, p) => acc + p.userCount, 0));
	// Build donut arcs.
	const arcs = $derived.by(() => {
		if (total === 0) return [];
		const radius = 50;
		const inner = 32;
		const cx = 60;
		const cy = 60;
		// Single provider holding 100% would produce a 2π arc whose start and end
		// points are identical — SVG renders an empty path in that case. Split
		// any slice that covers (effectively) the whole circle into two halves
		// so the donut still draws as a complete ring.
		const slices: Array<{
			provider: string;
			userCount: number;
			portion: number;
			displayCount: number;
		}> = [];
		for (const p of providers) {
			const portion = p.userCount / total;
			if (portion >= 0.999999) {
				slices.push({ provider: p.provider, userCount: p.userCount, portion: 0.5, displayCount: p.userCount });
				slices.push({ provider: p.provider, userCount: 0, portion: 0.5, displayCount: p.userCount });
			} else {
				slices.push({ provider: p.provider, userCount: p.userCount, portion, displayCount: p.userCount });
			}
		}

		let cursor = -Math.PI / 2; // start at top
		return slices.map((p, i) => {
			const angle = p.portion * Math.PI * 2;
			const start = cursor;
			const end = cursor + angle;
			cursor = end;

			const startOuter = polar(cx, cy, radius, start);
			const endOuter = polar(cx, cy, radius, end);
			const startInner = polar(cx, cy, inner, end);
			const endInner = polar(cx, cy, inner, start);
			const largeArc = angle > Math.PI ? 1 : 0;
			const d =
				`M ${startOuter.x} ${startOuter.y} ` +
				`A ${radius} ${radius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y} ` +
				`L ${startInner.x} ${startInner.y} ` +
				`A ${inner} ${inner} 0 ${largeArc} 0 ${endInner.x} ${endInner.y} Z`;
			return {
				d,
				provider: p.provider,
				count: p.displayCount,
				color: palette[p.provider] ?? fallback,
				// Hide the duplicated half from the legend so we don't show the
				// same provider twice when we split for the 100% case.
				hideFromLegend: i > 0 && slices[i - 1].provider === p.provider,
				pct: Math.round((p.displayCount / total) * 100)
			};
		});
	});

	function polar(cx: number, cy: number, r: number, theta: number) {
		return { x: cx + Math.cos(theta) * r, y: cy + Math.sin(theta) * r };
	}
</script>

<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
	<div class="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
		Sign-in providers
	</div>
	<div class="mt-3 flex items-center gap-4">
		<svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Provider breakdown">
			{#if total === 0}
				<circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-border)" stroke-width="18" />
			{:else}
				{#each arcs as arc}
					<path d={arc.d} fill={arc.color}>
						<title>{arc.provider}: {arc.count} ({arc.pct}%)</title>
					</path>
				{/each}
			{/if}
		</svg>
		<ul class="flex-1 space-y-1 text-sm">
			{#if total === 0}
				<li class="text-[var(--color-muted-foreground)]">No sign-ins yet.</li>
			{:else}
				{#each arcs as arc}
					{#if !arc.hideFromLegend}
						<li class="flex items-center justify-between gap-3">
							<span class="flex items-center gap-2">
								<span
									class="inline-block h-3 w-3 rounded-sm"
									style:background-color={arc.color}
								></span>
								<span class="capitalize">{arc.provider}</span>
							</span>
							<span class="tabular-nums">
								{arc.count} <span class="text-[var(--color-muted-foreground)]">({arc.pct}%)</span>
							</span>
						</li>
					{/if}
				{/each}
			{/if}
		</ul>
	</div>
</div>
