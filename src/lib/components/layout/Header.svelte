<script lang="ts">
	import { page } from '$app/state';
	import { signOut } from '@auth/sveltekit/client';
	import { diceRollAnimationsEnabled, toggleDiceRollAnimations } from '$lib/stores/dice-rolls';
	import { era, mode, theme, reduceEffects } from '$lib/stores/theme';
	import { eras } from '$lib/themes/registry';
	import { Dices, LogIn, LogOut, Settings, Sparkles } from '@lucide/svelte';

	const session = $derived(page.data.session);

	function userInitials(name?: string | null): string {
		if (!name) return '?';
		return name
			.split(' ')
			.map((part) => part[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<header class="border-b border-[var(--color-border)] bg-[var(--color-card)]">
	<nav class="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3" aria-label="Main navigation">
		<a href="/" class="flex items-center gap-2 no-underline">
			<span class="text-base font-semibold tracking-wide sm:text-lg" data-heading>
				<span class="hidden sm:inline">Miskatonic University Registrar</span>
				<span class="sm:hidden">M.U.R.</span>
			</span>
		</a>

		<div class="ml-auto flex items-center gap-1 sm:gap-3">
			<a
				href="/create/coc7e/characteristics"
				class="rounded-md px-2 py-1.5 text-xs sm:text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)] transition-colors"
			>
				<span class="hidden sm:inline">New</span>
				<span class="sm:hidden">+</span>
			</a>
			<a
				href="/investigators"
				class="hidden rounded-md px-2 py-1.5 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] transition-colors sm:inline sm:text-sm"
			>
				Investigators
			</a>

			{#if session?.user}
				<a
					href="/investigators"
					class="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] text-xs font-semibold text-[var(--color-foreground)]"
					title={session.user.name ?? 'Signed in'}
					aria-label={session.user.name ?? 'Signed in'}
				>
					{#if session.user.image}
						<img
							src={session.user.image}
							alt=""
							class="h-full w-full rounded-full object-cover"
							referrerpolicy="no-referrer"
						/>
					{:else}
						{userInitials(session.user.name)}
					{/if}
				</a>
				<button
					type="button"
					onclick={() => signOut({ redirectTo: '/' })}
					class="rounded-md p-2 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
					aria-label="Sign out"
					title="Sign out"
				>
					<LogOut size={18} aria-hidden="true" />
				</button>
			{:else}
				<a
					href="/login"
					class="rounded-md p-2 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
					aria-label="Sign in"
					title="Sign in"
				>
					<LogIn size={18} aria-hidden="true" />
				</a>
			{/if}

			<!-- Secondary controls — inline at sm:+, tucked into the mobile popover below at <sm.
			     `hidden sm:contents` makes the wrapper visually disappear from the flex layout
			     so the four buttons become direct children of the parent flex on desktop. -->
			<div class="hidden sm:contents">
				<button
					type="button"
					onclick={toggleDiceRollAnimations}
					class="relative rounded-md p-2 transition-colors {$diceRollAnimationsEnabled
						? 'bg-[var(--color-accent)] text-[var(--color-foreground)]'
						: 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'}"
					aria-pressed={$diceRollAnimationsEnabled}
					aria-label={$diceRollAnimationsEnabled ? 'Disable 3D dice rolls' : 'Enable 3D dice rolls'}
					title={$diceRollAnimationsEnabled ? 'Disable 3D dice rolls' : 'Enable 3D dice rolls'}
				>
					<Dices size={18} aria-hidden="true" />
					{#if !$diceRollAnimationsEnabled}
						<span class="absolute left-1/2 top-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current"></span>
					{/if}
					<span
						class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full {$diceRollAnimationsEnabled
							? 'bg-[var(--color-primary)]'
							: 'bg-[var(--color-muted-foreground)]'}"
					></span>
				</button>

				<!-- Era Toggle -->
				<div
					class="flex rounded-md border border-[var(--color-border)] p-0.5"
					role="radiogroup"
					aria-label="Select era"
				>
					{#each eras as eraDef}
						{@const isActive = $era === eraDef.id}
						<button
							type="button"
							onclick={() => era.set(eraDef.id)}
							class="rounded-sm p-2 transition-colors {isActive
								? 'bg-[var(--color-accent)] text-[var(--color-foreground)]'
								: 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}"
							role="radio"
							aria-checked={isActive}
							aria-label="{eraDef.label} ({eraDef.description})"
							title="{eraDef.label} — {eraDef.description}"
						>
							<eraDef.icon size={16} aria-hidden="true" />
						</button>
					{/each}
				</div>

				<!-- Reduce theme effects toggle -->
				<button
					type="button"
					onclick={() => reduceEffects.toggle()}
					class="relative rounded-md p-2 transition-colors {$reduceEffects
						? 'bg-[var(--color-accent)] text-[var(--color-foreground)]'
						: 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'}"
					aria-pressed={$reduceEffects}
					aria-label={$reduceEffects ? 'Enable theme effects (grain, scanlines, glow)' : 'Disable theme effects (grain, scanlines, glow)'}
					title={$reduceEffects ? 'Theme effects off — click to enable' : 'Disable theme effects'}
				>
					<Sparkles size={18} aria-hidden="true" />
					{#if $reduceEffects}
						<span class="absolute left-1/2 top-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current"></span>
					{/if}
				</button>

				<!-- Mode Toggle -->
				<button
					type="button"
					onclick={() => mode.toggle()}
					class="rounded-md p-2 text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] transition-colors"
					aria-label="Switch to {$theme.resolvesDark ? 'light' : 'dark'} mode"
					title="Switch to {$theme.resolvesDark ? 'light' : 'dark'} mode"
				>
					{#if $theme.resolvesDark}
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
					{/if}
				</button>
			</div>

			<!-- Mobile-only "settings" popover. Tap gear → toggles the disclosure;
			     contains the same four controls in a vertical stack with text labels.
			     Both this popover's inputs and the desktop inline ones bind to the
			     same stores, so toggling either updates state. Native <details> for
			     accessibility — keyboard works without extra wiring. -->
			<details class="relative sm:hidden">
				<summary class="flex min-h-[38px] min-w-[38px] cursor-pointer list-none items-center justify-center rounded-md p-2 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] [&::-webkit-details-marker]:hidden">
					<Settings size={18} aria-hidden="true" />
					<span class="sr-only">Settings</span>
				</summary>
				<div class="absolute right-0 top-full z-50 mt-1 w-60 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-2 shadow-lg">
					<!-- Dice toggle -->
					<button
						type="button"
						onclick={toggleDiceRollAnimations}
						class="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-[var(--color-accent)]"
						aria-pressed={$diceRollAnimationsEnabled}
					>
						<span class="flex items-center gap-2">
							<Dices size={16} aria-hidden="true" />
							3D dice rolls
						</span>
						<span class="text-xs text-[var(--color-muted-foreground)]">{$diceRollAnimationsEnabled ? 'On' : 'Off'}</span>
					</button>

					<!-- Era selector -->
					<div class="mt-1 px-2 py-2">
						<span class="block text-xs uppercase text-[var(--color-muted-foreground)]">Era</span>
						<div
							class="mt-1 flex rounded-md border border-[var(--color-border)] p-0.5"
							role="radiogroup"
							aria-label="Select era"
						>
							{#each eras as eraDef}
								{@const isActive = $era === eraDef.id}
								<button
									type="button"
									onclick={() => era.set(eraDef.id)}
									class="flex flex-1 items-center justify-center gap-2 rounded-sm p-2 text-xs transition-colors {isActive
										? 'bg-[var(--color-accent)] text-[var(--color-foreground)]'
										: 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}"
									role="radio"
									aria-checked={isActive}
									aria-label={eraDef.label}
								>
									<eraDef.icon size={14} aria-hidden="true" />
									<span>{eraDef.label}</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Reduce theme effects -->
					<button
						type="button"
						onclick={() => reduceEffects.toggle()}
						class="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-[var(--color-accent)]"
						aria-pressed={$reduceEffects}
					>
						<span class="flex items-center gap-2">
							<Sparkles size={16} aria-hidden="true" />
							Theme effects
						</span>
						<span class="text-xs text-[var(--color-muted-foreground)]">{$reduceEffects ? 'Off' : 'On'}</span>
					</button>

					<!-- Mode toggle -->
					<button
						type="button"
						onclick={() => mode.toggle()}
						class="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-[var(--color-accent)]"
						aria-label="Switch to {$theme.resolvesDark ? 'light' : 'dark'} mode"
					>
						<span class="flex items-center gap-2">
							{#if $theme.resolvesDark}
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
							{/if}
							Theme
						</span>
						<span class="text-xs text-[var(--color-muted-foreground)]">{$theme.resolvesDark ? 'Dark' : 'Light'}</span>
					</button>
				</div>
			</details>
		</div>
	</nav>
</header>
