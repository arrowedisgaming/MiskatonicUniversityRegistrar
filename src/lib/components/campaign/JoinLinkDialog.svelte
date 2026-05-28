<script lang="ts">
	import { Check, Copy as CopyIcon } from '@lucide/svelte';

	type Props = {
		campaignId: string;
		initialShareId: string | null;
	};
	let { campaignId, initialShareId }: Props = $props();

	let open = $state(false);
	// svelte-ignore state_referenced_locally
	let shareId = $state<string | null>(initialShareId);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
	let codeEl: HTMLElement | null = $state(null);

	const enabled = $derived(shareId !== null);
	const shareUrl = $derived(
		shareId !== null && typeof window !== 'undefined'
			? `${window.location.origin}/campaigns/join/${shareId}`
			: ''
	);

	async function enable() {
		if (busy) return;
		busy = true;
		error = null;
		try {
			const res = await fetch(`/api/campaigns/${campaignId}/share`, { method: 'POST' });
			if (!res.ok) {
				error = (await res.text()) || `Failed (${res.status})`;
				return;
			}
			const body = (await res.json()) as { shareId: string };
			shareId = body.shareId;
		} finally {
			busy = false;
		}
	}

	async function disable() {
		if (busy) return;
		busy = true;
		error = null;
		try {
			const res = await fetch(`/api/campaigns/${campaignId}/share`, { method: 'DELETE' });
			if (!res.ok) {
				error = (await res.text()) || `Failed (${res.status})`;
				return;
			}
			shareId = null;
		} finally {
			busy = false;
		}
	}

	/**
	 * Copy the share URL to the clipboard with three layered fallbacks. Why
	 * three: Firefox sometimes rejects `navigator.clipboard.writeText` even on
	 * localhost (the user may have disabled the async clipboard API via
	 * `dom.events.asyncClipboard.*` prefs, or be on a build that requires a
	 * stricter user-activation chain than our async await preserves). When the
	 * async API fails we fall back to `document.execCommand('copy')` on a
	 * hidden textarea — deprecated, but still widely supported and synchronous,
	 * which sidesteps the activation issue. If even that fails, we select the
	 * URL text in place and tell the user to press Ctrl+C.
	 */
	function selectCodeText() {
		if (!codeEl) return;
		const range = document.createRange();
		range.selectNodeContents(codeEl);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
	}

	function copyViaExecCommand(text: string): boolean {
		try {
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.position = 'fixed';
			ta.style.top = '0';
			ta.style.left = '0';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.focus();
			ta.select();
			const ok = document.execCommand('copy');
			document.body.removeChild(ta);
			return ok;
		} catch {
			return false;
		}
	}

	async function copy() {
		if (!shareUrl) return;
		copyState = 'idle';

		// 1. Async Clipboard API — the modern path, works in Chrome / Safari /
		// recent Firefox in secure contexts.
		try {
			if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(shareUrl);
				copyState = 'copied';
				setTimeout(() => (copyState = 'idle'), 2000);
				return;
			}
		} catch {
			/* fall through */
		}

		// 2. document.execCommand('copy') on a hidden textarea — synchronous,
		// no permission prompt, works in Firefox configurations that block the
		// async API.
		if (copyViaExecCommand(shareUrl)) {
			copyState = 'copied';
			setTimeout(() => (copyState = 'idle'), 2000);
			return;
		}

		// 3. Last resort: select the visible URL so the user can press Ctrl+C
		// manually. Surface a 'failed' state so the button explains the action.
		selectCodeText();
		copyState = 'failed';
	}
</script>

<button
	type="button"
	onclick={() => (open = !open)}
	class="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-accent)]"
>
	{enabled ? 'Manage join link' : 'Open join link'}
</button>

{#if open}
	<div
		class="absolute right-0 z-20 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-lg"
		role="dialog"
		aria-label="Campaign join link"
	>
		<h3 class="text-sm font-semibold" data-heading>Join link</h3>
		<p class="mt-1 text-xs text-[var(--color-muted-foreground)]">
			Anyone with this link can join the campaign with one of their finished investigators.
			Rotating replaces the link — old URL stops working immediately.
		</p>

		{#if enabled}
			<!-- Full-width URL with break-all so the whole link is legible even at
			     narrow dialog widths. The Copy button sits below so the URL doesn't
			     have to compete for horizontal space. -->
			<div class="mt-3 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs">
				<code bind:this={codeEl} class="block break-all leading-snug">{shareUrl}</code>
			</div>
			<div class="mt-3 flex items-center justify-between gap-2">
				<!-- Three visible states: idle (default outline), copied (filled
				     primary + check), failed (warning outline + "press Ctrl+C"
				     hint, with the URL already selected behind us so the user can
				     just press the chord). The aria-live region announces state
				     changes to assistive tech. -->
				<button
					type="button"
					onclick={copy}
					aria-live="polite"
					class="inline-flex items-center gap-1.5 rounded border px-3 py-1 text-xs font-medium transition-colors {copyState === 'copied'
						? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
						: copyState === 'failed'
							? 'border-[var(--color-warning)] text-[var(--color-warning)]'
							: 'border-[var(--color-border)] hover:bg-[var(--color-accent)]'}"
				>
					{#if copyState === 'copied'}
						<Check size={14} aria-hidden="true" />
						<span>Copied to clipboard</span>
					{:else if copyState === 'failed'}
						<CopyIcon size={14} aria-hidden="true" />
						<span>Selected — press Ctrl/⌘+C</span>
					{:else}
						<CopyIcon size={14} aria-hidden="true" />
						<span>Copy link</span>
					{/if}
				</button>
				<div class="flex gap-3">
					<button
						type="button"
						onclick={enable}
						disabled={busy}
						class="text-xs text-[var(--color-muted-foreground)] underline-offset-4 hover:underline disabled:opacity-50"
					>
						Rotate
					</button>
					<button
						type="button"
						onclick={disable}
						disabled={busy}
						class="text-xs text-[var(--color-destructive)] underline-offset-4 hover:underline disabled:opacity-50"
					>
						Disable
					</button>
				</div>
			</div>
		{:else}
			<button
				type="button"
				onclick={enable}
				disabled={busy}
				class="mt-3 w-full rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
			>
				{busy ? 'Generating…' : 'Generate join link'}
			</button>
		{/if}

		{#if error}
			<p class="mt-3 rounded border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 p-2 text-xs text-[var(--color-destructive)]">
				{error}
			</p>
		{/if}
	</div>
{/if}
