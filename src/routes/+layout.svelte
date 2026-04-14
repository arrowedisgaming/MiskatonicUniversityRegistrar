<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';

	let { children } = $props();
</script>

<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2">
	Skip to content
</a>

<div class="flex min-h-screen flex-col">
	<Header />
	<main id="main-content" class="flex-1">
		{@render children()}
	</main>
	<Footer />
</div>
