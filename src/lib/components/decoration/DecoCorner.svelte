<script lang="ts">
	type Position = 'tl' | 'tr' | 'bl' | 'br';
	let { position = 'tl', size = 16 }: { position?: Position; size?: number } = $props();
	const rotations: Record<Position, number> = { tl: 0, tr: 90, br: 180, bl: 270 };
</script>

<svg
	class="deco-corner"
	width={size}
	height={size}
	viewBox="0 0 16 16"
	aria-hidden="true"
	style:transform={`rotate(${rotations[position]}deg)`}
>
	<path
		d="M0 8 L0 2 L2 2 L2 0 L8 0"
		fill="none"
		stroke="currentColor"
		stroke-width="1.25"
		stroke-linecap="square"
	/>
	<path d="M3 3 L5 3 L5 5" fill="none" stroke="currentColor" stroke-width="1" opacity="0.7" />
</svg>

<style>
	.deco-corner {
		display: inline-block;
		color: var(--color-gold);
		pointer-events: none;
	}
</style>
