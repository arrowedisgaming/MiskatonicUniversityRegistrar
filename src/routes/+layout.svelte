<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import DiceRollOverlay from '$lib/components/dice/DiceRollOverlay.svelte';

	let { children } = $props();
</script>

<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2">
	Skip to content
</a>

<!--
	The .app-frame wrapper is the target of atmospheric filter effects (CRT
	degauss, sepia fade, eldritch glitch). DiceRollOverlay is intentionally
	rendered as a sibling, not a child, so its position: fixed stays anchored
	to the viewport when filters are active on the frame (filtered ancestors
	create a containing block for fixed-position descendants).
-->
<div class="app-frame flex min-h-screen flex-col">
	<Header />
	<main id="main-content" class="flex-1">
		{@render children()}
	</main>
	<Footer />
</div>

<DiceRollOverlay />
