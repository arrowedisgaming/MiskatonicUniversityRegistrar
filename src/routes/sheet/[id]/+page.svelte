<script lang="ts">
	import { page } from '$app/state';
	import { ALL_CHARACTERISTICS, CHARACTERISTIC_LABELS } from '$lib/types/common';
	import { halfValue, fifthValue } from '$lib/engine/characteristics';
	import type { CoCCharacterData } from '$lib/types/character';
	import type { CoCOccupationDefinition } from '$lib/types/content-pack';
	import { generatePDF } from '$lib/export/pdf-export';

	const data = page.data as {
		investigator: { id: string; character: CoCCharacterData };
		occupations: CoCOccupationDefinition[];
	};

	const char = data.investigator.character;
	const occupation = data.occupations.find((o) => o.id === char.occupation?.occupationId);

	// In-play tracking state
	let currentHP = $state(char.derivedStats.hp.current);
	let currentMP = $state(char.derivedStats.mp.current);
	let currentSanity = $state(char.derivedStats.sanity.current);
	let currentLuck = $state(char.derivedStats.luck.current);
	let playMode = $state(false);

	let isDirty = $state(false);
	let pdfError = $state<string | null>(null);
	let pdfExporting = $state(false);

	function adjust(stat: 'hp' | 'mp' | 'sanity' | 'luck', delta: number) {
		if (stat === 'hp') currentHP = Math.max(0, Math.min(char.derivedStats.hp.max, currentHP + delta));
		if (stat === 'mp') currentMP = Math.max(0, Math.min(char.derivedStats.mp.max, currentMP + delta));
		if (stat === 'sanity') currentSanity = Math.max(0, Math.min(char.derivedStats.sanity.max, currentSanity + delta));
		if (stat === 'luck') currentLuck = Math.max(0, Math.min(99, currentLuck + delta));
		isDirty = true;
	}

	async function savePlayState() {
		const updated = {
			...char,
			derivedStats: {
				...char.derivedStats,
				hp: { ...char.derivedStats.hp, current: currentHP },
				mp: { ...char.derivedStats.mp, current: currentMP },
				sanity: { ...char.derivedStats.sanity, current: currentSanity },
				luck: { ...char.derivedStats.luck, current: currentLuck }
			}
		};

		await fetch(`/api/investigators/${data.investigator.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ character: updated })
		});
		isDirty = false;
	}

	async function exportPDF() {
		pdfError = null;
		pdfExporting = true;
		try {
			const occName = occupation?.name ?? 'Unknown';
			const pdfBytes = await generatePDF(char, occName);
			const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${(char.name || 'investigator').replace(/\s+/g, '-')}.pdf`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			pdfError = e instanceof Error ? e.message : 'PDF generation failed';
			console.error('PDF export error:', e);
		} finally {
			pdfExporting = false;
		}
	}

	// Skills sorted by total descending
	let sortedSkills = char.skills
		.filter((s) => s.total > s.baseValue || s.isOccupation)
		.sort((a, b) => b.total - a.total);
</script>

<svelte:head>
	<title>{char.name || 'Investigator'} — Miskatonic University Registrar</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-6 space-y-6">
	<!-- Header -->
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold" data-heading>{char.name || 'Unnamed Investigator'}</h1>
			<p class="text-sm text-[var(--color-muted-foreground)]">
				{occupation?.name ?? 'No occupation'} &middot; Age {char.age} &middot; {char.era}
			</p>
			{#if char.residence}
				<p class="text-xs text-[var(--color-muted-foreground)]">Residence: {char.residence}</p>
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			<!-- Export buttons -->
			<div class="flex gap-1">
				<a href="/api/export/{data.investigator.id}?format=json" download
					class="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs hover:bg-[var(--color-accent)]">
					JSON
				</a>
				<a href="/api/export/{data.investigator.id}?format=md" download
					class="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs hover:bg-[var(--color-accent)]">
					Markdown
				</a>
				<button onclick={exportPDF} disabled={pdfExporting}
					class="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs hover:bg-[var(--color-accent)] disabled:opacity-50">
					{pdfExporting ? 'Exporting...' : 'PDF'}
				</button>
			</div>
			<button
				onclick={() => (playMode = !playMode)}
				class="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors
					{playMode
						? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
						: 'border-[var(--color-border)] hover:bg-[var(--color-accent)]'}"
			>
				{playMode ? 'Exit Play Mode' : 'Play Mode'}
			</button>
			<a href="/investigators" class="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-accent)]">
				Back
			</a>
		</div>
	</div>

	{#if pdfError}
		<div class="rounded-md border border-[var(--color-destructive)] bg-[var(--color-destructive)]/10 p-3 text-sm text-[var(--color-destructive)]">
			PDF export failed: {pdfError}
		</div>
	{/if}

	<!-- In-Play Tracking -->
	{#if playMode}
		<div class="rounded-md border-2 border-[var(--color-primary)] bg-[var(--color-card)] p-4">
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-sm font-semibold uppercase text-[var(--color-primary)]">In-Play Tracking</h2>
				{#if isDirty}
					<button
						onclick={savePlayState}
						class="rounded bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary-foreground)]"
					>
						Save
					</button>
				{/if}
			</div>
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{#each [
					{ label: 'HP', stat: 'hp' as const, current: currentHP, max: char.derivedStats.hp.max, color: 'var(--color-destructive)' },
					{ label: 'MP', stat: 'mp' as const, current: currentMP, max: char.derivedStats.mp.max, color: 'var(--color-primary)' },
					{ label: 'Sanity', stat: 'sanity' as const, current: currentSanity, max: char.derivedStats.sanity.max, color: 'var(--color-warning)' },
					{ label: 'Luck', stat: 'luck' as const, current: currentLuck, max: char.derivedStats.luck.max, color: 'var(--color-foreground)' }
				] as tracker}
					<div class="text-center">
						<span class="text-xs uppercase text-[var(--color-muted-foreground)]">{tracker.label}</span>
						<div class="flex items-center justify-center gap-2">
							<button
								onclick={() => adjust(tracker.stat, -1)}
								class="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-lg font-bold hover:bg-[var(--color-accent)]"
							>−</button>
							<span class="min-w-[3rem] text-center text-2xl font-bold">{tracker.current}</span>
							<button
								onclick={() => adjust(tracker.stat, 1)}
								class="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-lg font-bold hover:bg-[var(--color-accent)]"
							>+</button>
						</div>
						<span class="text-xs text-[var(--color-muted-foreground)]">/ {tracker.max}</span>
						<!-- Progress bar -->
						<div class="mx-auto mt-1 h-1.5 w-full max-w-[80px] rounded-full bg-[var(--color-muted)]">
							<div
								class="h-1.5 rounded-full transition-all"
								style="width: {(tracker.current / tracker.max) * 100}%; background-color: {tracker.color}"
							></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Characteristics & Derived -->
	<div class="grid gap-6 lg:grid-cols-2">
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Characteristics</h2>
			<div class="grid grid-cols-4 gap-2 text-center text-sm">
				{#each ALL_CHARACTERISTICS as charId}
					{@const v = char.characteristics.values[charId]}
					<div class="rounded-md border border-[var(--color-border)]/50 p-2">
						<span class="block text-xs uppercase text-[var(--color-muted-foreground)]">{charId}</span>
						<span class="block text-xl font-bold">{v}</span>
						<span class="block text-xs text-[var(--color-muted-foreground)]">{halfValue(v)} / {fifthValue(v)}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Derived Attributes</h2>
			<div class="grid grid-cols-2 gap-2 text-sm">
				{#each [
					['Hit Points', `${char.derivedStats.hp.current}/${char.derivedStats.hp.max}`],
					['Magic Points', `${char.derivedStats.mp.current}/${char.derivedStats.mp.max}`],
					['Sanity', `${char.derivedStats.sanity.current}/${char.derivedStats.sanity.max}`],
					['Luck', `${char.derivedStats.luck.current}`],
					['Damage Bonus', char.derivedStats.damageBonus],
					['Build', String(char.derivedStats.build)],
					['Move Rate', String(char.derivedStats.moveRate)]
				] as [label, value]}
					<div class="flex justify-between border-b border-[var(--color-border)]/30 pb-1">
						<span class="text-[var(--color-muted-foreground)]">{label}</span>
						<span class="font-bold">{value}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Skills -->
	{#if sortedSkills.length > 0}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Skills</h2>
			<div class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
				{#each sortedSkills as skill}
					<div class="flex justify-between text-sm">
						<span>
							{skill.skillId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
							{#if skill.isOccupation}
								<span class="text-[10px] text-[var(--color-primary)]">&#x2022;</span>
							{/if}
						</span>
						<span class="font-bold tabular-nums">{skill.total}%
							<span class="text-xs font-normal text-[var(--color-muted-foreground)]">({skill.half}/{skill.fifth})</span>
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Backstory -->
	{#if Object.values(char.backstory).some((v) => v.trim())}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Backstory</h2>
			<div class="space-y-3 text-sm">
				{#each Object.entries(char.backstory).filter(([, v]) => v.trim()) as [key, value]}
					<div>
						<span class="text-xs font-semibold uppercase text-[var(--color-muted-foreground)]">
							{key.replace(/([A-Z])/g, ' $1').trim()}
						</span>
						<p class="whitespace-pre-wrap">{value}</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Equipment -->
	{#if char.equipment.items.length > 0 || char.equipment.weapons.length > 0}
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Equipment</h2>
			<p class="mb-2 text-sm text-[var(--color-muted-foreground)]">
				{char.equipment.spendingLevel} &middot; Cash: ${char.equipment.cash.toLocaleString()} &middot; Assets: {char.equipment.assets}
			</p>
			{#if char.equipment.weapons.length > 0}
				<div class="mb-2 overflow-x-auto">
					<table class="w-full text-xs">
						<thead>
							<tr class="border-b border-[var(--color-border)] text-left uppercase text-[var(--color-muted-foreground)]">
								<th class="pb-1 pr-2">Weapon</th><th class="pb-1 pr-2">Damage</th><th class="pb-1 pr-2">Range</th><th class="pb-1">Attacks</th>
							</tr>
						</thead>
						<tbody>
							{#each char.equipment.weapons as w}
								<tr class="border-b border-[var(--color-border)]/20">
									<td class="py-1 pr-2 font-medium">{w.name}</td><td class="py-1 pr-2">{w.damage}</td><td class="py-1 pr-2">{w.range}</td><td class="py-1">{w.attacksPerRound}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
			{#if char.equipment.items.length > 0}
				<p class="text-sm">{char.equipment.items.map((i) => i.name).join(', ')}</p>
			{/if}
		</div>
	{/if}
</div>
