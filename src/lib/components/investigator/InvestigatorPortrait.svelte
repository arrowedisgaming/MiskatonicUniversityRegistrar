<script lang="ts">
	type Size = 'sm' | 'md' | 'lg';

	type Props = {
		name: string;
		portraitUrl: string;
		size?: Size;
		class?: string;
	};

	let { name, portraitUrl, size = 'md', class: className = '' }: Props = $props();

	const sizeClasses: Record<Size, string> = {
		sm: 'h-10 w-10 text-sm',
		md: 'h-12 w-12 text-sm',
		lg: 'h-24 w-24 text-2xl'
	};

	let imageFailed = $state(false);

	const displayUrl = $derived(portraitUrl.trim());
	const showImage = $derived(displayUrl.length > 0 && !imageFailed);
	const initial = $derived((name.trim().charAt(0) || '?').toUpperCase());
	const altText = $derived(name.trim() ? `Portrait of ${name.trim()}` : 'Investigator portrait');

	$effect(() => {
		displayUrl;
		imageFailed = false;
	});
</script>

{#if showImage}
	<img
		src={displayUrl}
		alt={altText}
		class="flex-none rounded-full border border-[var(--color-border)] object-cover {sizeClasses[size]} {className}"
		onerror={() => {
			imageFailed = true;
		}}
	/>
{:else}
	<div
		class="flex flex-none items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] font-semibold {sizeClasses[size]} {className}"
		aria-hidden="true"
	>
		{initial}
	</div>
{/if}
