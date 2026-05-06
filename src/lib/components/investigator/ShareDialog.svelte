<script lang="ts">
	import { tick } from 'svelte';

	type Props = {
		investigatorId: string;
		isDraft: boolean;
		initialShareId: string | null;
	};

	let { investigatorId, isDraft, initialShareId }: Props = $props();

	let open = $state(false);
	// `initialShareId` seeds local state at mount; subsequent enable/disable calls
	// mutate `shareId` directly. The initial-value capture is intentional.
	// svelte-ignore state_referenced_locally
	let shareId = $state<string | null>(initialShareId);
	let busy = $state(false);
	let error = $state<string | null>(null);
	// Transient feedback for the Copy button — reset on dialog open.
	let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
	let urlInput: HTMLInputElement | null = $state(null);

	const enabled = $derived(shareId !== null);
	const shareUrl = $derived(
		shareId !== null && typeof window !== 'undefined' ? `${window.location.origin}/s/${shareId}` : ''
	);

	function readableApiError(body: string, status: number): string {
		const s = body.trim();
		if (!s) return `Request failed (HTTP ${status})`;
		try {
			const parsed = JSON.parse(s) as unknown;
			if (
				parsed !== null &&
				typeof parsed === 'object' &&
				'message' in parsed &&
				typeof (parsed as { message: unknown }).message === 'string'
			) {
				return (parsed as { message: string }).message;
			}
		} catch {
			/* fall through */
		}
		return s;
	}

	async function copyToClipboard(text: string): Promise<boolean> {
		// Prefer the async Clipboard API. Some browsers (or insecure contexts)
		// reject the call; fall back to selecting the input so the user can copy
		// manually instead of leaving them with no recourse.
		try {
			if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				return true;
			}
		} catch {
			/* fall back to selection */
		}
		try {
			urlInput?.focus();
			urlInput?.select();
		} catch {
			/* ignore — caller will surface "failed" state */
		}
		return false;
	}

	async function enableShare() {
		if (busy) return;
		busy = true;
		error = null;
		copyState = 'idle';
		try {
			const res = await fetch(`/api/investigators/${investigatorId}/share`, { method: 'POST' });
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				error = readableApiError(text, res.status);
				return;
			}
			const body = (await res.json()) as { shareId: string; shareUrl: string };
			shareId = body.shareId;
			// Wait for the readonly URL input to mount so the select-text fallback
			// has a real element to focus when the Clipboard API is unavailable.
			await tick();
			const ok = await copyToClipboard(body.shareUrl);
			copyState = ok ? 'copied' : 'failed';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to enable sharing';
		} finally {
			busy = false;
		}
	}

	async function disableShare() {
		if (busy) return;
		busy = true;
		error = null;
		copyState = 'idle';
		try {
			const res = await fetch(`/api/investigators/${investigatorId}/share`, { method: 'DELETE' });
			if (!res.ok && res.status !== 204) {
				const text = await res.text().catch(() => '');
				error = readableApiError(text, res.status);
				return;
			}
			shareId = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to disable sharing';
		} finally {
			busy = false;
		}
	}

	async function copyExisting() {
		if (!shareUrl) return;
		const ok = await copyToClipboard(shareUrl);
		copyState = ok ? 'copied' : 'failed';
	}

	function toggleOpen() {
		open = !open;
		if (open) {
			error = null;
			copyState = 'idle';
		}
	}

	function handleToggleChange(event: Event) {
		const checked = (event.currentTarget as HTMLInputElement).checked;
		if (checked) {
			void enableShare();
		} else {
			void disableShare();
		}
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={toggleOpen}
		aria-haspopup="dialog"
		aria-expanded={open}
		class="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors
			{enabled
				? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
				: 'border-[var(--color-border)] hover:bg-[var(--color-accent)]'}"
	>
		{enabled ? 'Sharing on' : 'Share'}
	</button>

	{#if open}
		<div
			role="dialog"
			aria-label="Share investigator"
			class="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-lg"
		>
			<div class="flex items-start justify-between gap-2">
				<div>
					<h3 class="text-sm font-semibold">Share this investigator</h3>
					<p class="mt-1 text-xs text-[var(--color-muted-foreground)]">
						Anyone with the link can view this sheet. They cannot edit, roll, or change anything.
					</p>
				</div>
				<button
					type="button"
					onclick={() => (open = false)}
					aria-label="Close share dialog"
					class="cursor-pointer rounded p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
				>
					&times;
				</button>
			</div>

			{#if isDraft}
				<p
					class="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-2 text-xs text-[var(--color-muted-foreground)]"
				>
					Drafts cannot be shared. Finish the investigator first.
				</p>
			{:else}
				<label class="mt-3 flex items-center justify-between gap-3 text-sm">
					<span class="font-medium">Public link</span>
					<input
						type="checkbox"
						role="switch"
						checked={enabled}
						disabled={busy}
						aria-label="Enable public share link"
						onchange={handleToggleChange}
						class="h-5 w-9 cursor-pointer appearance-none rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] transition-colors checked:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
					/>
				</label>

				{#if enabled && shareUrl}
					<div class="mt-3 space-y-2">
						<div class="flex items-stretch gap-2">
							<input
								bind:this={urlInput}
								type="text"
								readonly
								value={shareUrl}
								aria-label="Share URL"
								onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
								class="min-w-0 grow rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs"
							/>
							<button
								type="button"
								onclick={copyExisting}
								disabled={busy}
								class="shrink-0 cursor-pointer rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
							>
								{copyState === 'copied' ? 'Copied!' : 'Copy'}
							</button>
						</div>
						{#if copyState === 'failed'}
							<p class="text-xs text-[var(--color-muted-foreground)]">
								Could not copy automatically — the URL is selected; press <kbd>⌘/Ctrl</kbd>+<kbd>C</kbd>.
							</p>
						{/if}
						<p class="text-xs text-[var(--color-muted-foreground)]">
							Turning sharing off revokes this link permanently. Turning it back on generates a new URL.
						</p>
					</div>
				{/if}
			{/if}

			{#if error}
				<p
					class="mt-3 rounded-md border border-[var(--color-destructive)] bg-[var(--color-destructive)]/10 p-2 text-xs text-[var(--color-destructive)]"
					role="alert"
				>
					{error}
				</p>
			{/if}
		</div>
	{/if}
</div>
