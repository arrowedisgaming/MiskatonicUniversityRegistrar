<script lang="ts">
	// Floating "scroll down" affordance for wizard pages whose content extends
	// past the viewport. Self-managing: appears when there's >80px of content
	// below the fold, hides as the user nears the bottom (so the hint
	// disappears once the Next button is visible). Uses a ResizeObserver on
	// the document so step swaps and dynamic content (validation messages,
	// expanded details) re-trigger the visibility check.

	let visible = $state(false);
	let keyboardOpen = $state(false);

	function check() {
		if (typeof window === 'undefined') return;
		const scrollY = window.scrollY;
		const docHeight = document.documentElement.scrollHeight;
		const viewportHeight = window.innerHeight;
		visible = docHeight - (scrollY + viewportHeight) > 80;
	}

	// On iOS Safari and Android Chrome, when the on-screen keyboard appears the
	// `visualViewport.height` shrinks while `window.innerHeight` stays roughly
	// the same. We hide the hint while the keyboard is open so it doesn't sit
	// directly over a text/number input the user just focused.
	function checkKeyboard() {
		if (typeof window === 'undefined' || !window.visualViewport) return;
		const ratio = window.visualViewport.height / window.innerHeight;
		keyboardOpen = ratio < 0.75;
	}

	function scrollDown() {
		const target = Math.min(
			window.scrollY + window.innerHeight * 0.85,
			document.documentElement.scrollHeight
		);
		window.scrollTo({ top: target, behavior: 'smooth' });
	}

	$effect(() => {
		check();
		checkKeyboard();
		window.addEventListener('scroll', check, { passive: true });
		window.addEventListener('resize', check);
		const ro = new ResizeObserver(check);
		ro.observe(document.documentElement);
		const vv = window.visualViewport;
		vv?.addEventListener('resize', checkKeyboard);
		return () => {
			window.removeEventListener('scroll', check);
			window.removeEventListener('resize', check);
			ro.disconnect();
			vv?.removeEventListener('resize', checkKeyboard);
		};
	});
</script>

{#if visible && !keyboardOpen}
	<button
		type="button"
		class="scroll-hint"
		onclick={scrollDown}
		aria-label="Scroll down to see more"
		title="Scroll down"
	>
		<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true">
			<path
				d="M3 4 L8 9 L13 4 M3 9 L8 14 L13 9"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="square"
				stroke-linejoin="miter"
			/>
		</svg>
	</button>
{/if}

<style>
	.scroll-hint {
		position: fixed;
		/* Respect iOS safe area; max() falls back to 1.25rem on devices where
		   the env() value is 0 or unsupported. */
		bottom: max(1.25rem, env(safe-area-inset-bottom));
		left: 50%;
		transform: translateX(-50%);
		z-index: 30;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		background: var(--color-card);
		border: 1px solid var(--color-gold);
		color: var(--color-gold);
		box-shadow: 0 4px 14px oklch(0 0 0 / 0.18);
		cursor: pointer;
		animation: scroll-hint-bob 2.4s ease-in-out infinite;
		transition: background-color 200ms ease;
	}

	.scroll-hint:hover {
		background: color-mix(in oklch, var(--color-gold) 14%, var(--color-card));
	}

	.scroll-hint:focus-visible {
		outline: 2px solid var(--color-gold);
		outline-offset: 2px;
	}

	@keyframes scroll-hint-bob {
		0%,
		100% {
			transform: translateX(-50%) translateY(0);
		}
		50% {
			transform: translateX(-50%) translateY(4px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.scroll-hint {
			animation: none;
		}
	}

	:global(html[data-reduce-effects]) .scroll-hint {
		animation: none;
	}
</style>
