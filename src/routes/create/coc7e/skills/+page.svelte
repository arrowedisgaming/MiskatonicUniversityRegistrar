<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import {
		calculateOccupationSkillPoints,
		calculatePersonalInterestPoints,
		resolveSkillBaseValue,
		computeSkillValues,
		createSkillAllocation,
		validateSkillAllocation
	} from '$lib/engine/skills';
	import { halfValue, fifthValue } from '$lib/engine/characteristics';
	import { getSkillsByGroup, INTERPERSONAL_SKILLS, isCustomOccupation } from '$lib/engine/occupation-filter';
	import type { CoCContentPack, CoCOccupationDefinition, CoCSkillDefinition } from '$lib/types/content-pack';
	import type { CoCSkillAllocation, CustomSkillDef, SkillPointAllocation } from '$lib/types/character';
	import type { CharacteristicId } from '$lib/types/common';

	const data = page.data as {
		contentPack: CoCContentPack;
		skills: CoCSkillDefinition[];
		occupations: CoCOccupationDefinition[];
	};

	const char = $wizard.character;
	const occupation = data.occupations.find((o) => o.id === char.occupation?.occupationId);
	const isCustomOcc = isCustomOccupation(char.occupation?.occupationId ?? '');

	// Redirect if no occupation selected (e.g. direct URL access)
	if (!occupation && !isCustomOcc && typeof window !== 'undefined') {
		goto(WIZARD_STEPS[1].path);
	}

	const occupationDisplayName = isCustomOcc
		? (char.occupation?.customName ?? 'Custom Occupation')
		: occupation?.name ?? 'Occupation';

	const totalOccPoints = isCustomOcc
		? (char.occupation?.customSkillPoints ?? 0)
		: occupation
			? calculateOccupationSkillPoints(
					occupation.skillPointFormula,
					char.characteristics.values,
					char.occupation?.formulaChoices
				)
			: 0;
	const totalPersonalPoints = calculatePersonalInterestPoints(char.characteristics.values.int);

	const requiredOccSkillIds = isCustomOcc
		? new Set<string>(char.occupation?.customOccupationSkills ?? [])
		: new Set(occupation?.occupationSkills.map((s) => s.skillId) ?? []);

	// All allocatable skills (exclude Cthulhu Mythos)
	const allSkills = data.skills.filter((s) => !s.noPointAllocation && s.eras.some((era) => era === 'all' || era === char.era));
	const combatSkills = [
		...getSkillsByGroup('fighting', allSkills),
		...getSkillsByGroup('firearms', allSkills)
	];
	const scienceSkills = getSkillsByGroup('science', allSkills);

	// Track point allocations per skill: { skillId: { occupation: number, personal: number } }
	type PointMap = Record<string, { occupation: number; personal: number }>;

	// Custom skill definitions (homebrew / supplement skills not in content pack)
	let customSkillDefs = $state<CustomSkillDef[]>(char.customSkillDefs ?? []);
	// New custom skill form
	let newCustomSkillName = $state('');
	let newCustomSkillBase = $state(0);
	let newCustomSkillIsOccupation = $state(false);
	let showAddCustomSkill = $state(false);

	// Initialize from existing character data or empty
	let pointAllocations = $state<PointMap>(initializeFromCharacter());
	let selectedInterpersonal = $state<string[]>(initialChoiceIds('interpersonal'));
	let selectedCombat = $state<string[]>(initialChoiceIds('combat'));
	let selectedScience = $state<string[]>(initialChoiceIds('science'));
	let selectedAny = $state<string[]>(initialChoiceIds('any'));

	let eligibleOccupationSkillIds = $derived.by(() => {
		if (isCustomOcc) {
			const tagged = char.occupation?.customOccupationSkills ?? [];
			if (tagged.length > 0) {
				// Player tagged specific occupation skills — those + occupation-flagged custom defs + credit-rating
				const ids = new Set(tagged);
				ids.add('credit-rating');
				for (const def of customSkillDefs) if (def.isOccupation) ids.add(def.id);
				return ids;
			}
			// No skills tagged → any content-pack skill eligible; custom defs by their own flag
			const ids = new Set(allSkills.map((s) => s.id));
			for (const def of customSkillDefs) if (def.isOccupation) ids.add(def.id);
			return ids;
		}
		const ids = new Set(requiredOccSkillIds);
		ids.add('credit-rating');
		for (const id of selectedInterpersonal) ids.add(id);
		for (const id of selectedCombat) ids.add(id);
		for (const id of selectedScience) ids.add(id);
		for (const id of selectedAny) ids.add(id);
		// Custom skill defs: eligible only if the player marked them as occupation skills
		for (const def of customSkillDefs) if (def.isOccupation) ids.add(def.id);
		return ids;
	});

	function initializeFromCharacter(): PointMap {
		const map: PointMap = {};
		for (const skill of char.skills) {
			const occ = skill.allocations.find((a) => a.source === 'occupation');
			const pi = skill.allocations.find((a) => a.source === 'personal-interest');
			map[skill.skillId] = {
				occupation: occ?.points ?? 0,
				personal: pi?.points ?? 0
			};
		}
		return map;
	}

	function initialChoiceIds(kind: 'interpersonal' | 'combat' | 'science' | 'any'): string[] {
		const existing = char.skills
			.filter((skill) => skill.isOccupation && !requiredOccSkillIds.has(skill.skillId) && skill.skillId !== 'credit-rating')
			.map((skill) => skill.skillId);
		if (kind === 'interpersonal') return existing.filter((id) => INTERPERSONAL_SKILLS.includes(id)).slice(0, occupation?.interpersonalChoiceCount ?? 0);
		if (kind === 'combat') return existing.filter((id) => combatSkills.some((skill) => skill.id === id)).slice(0, occupation?.combatChoiceCount ?? 0);
		if (kind === 'science') return existing.filter((id) => scienceSkills.some((skill) => skill.id === id)).slice(0, occupation?.scienceChoiceCount ?? 0);
		const reserved = new Set([
			...initialChoiceIds('interpersonal'),
			...initialChoiceIds('combat'),
			...initialChoiceIds('science')
		]);
		return existing.filter((id) => !reserved.has(id)).slice(0, occupation?.personalChoiceCount ?? 0);
	}

	function getAlloc(skillId: string) {
		return pointAllocations[skillId] ?? { occupation: 0, personal: 0 };
	}

	function getBase(skill: CoCSkillDefinition): number {
		return resolveSkillBaseValue(skill, char.characteristics.values);
	}

	function getTotal(skill: CoCSkillDefinition): number {
		const alloc = getAlloc(skill.id);
		return getBase(skill) + alloc.occupation + alloc.personal;
	}

	// Point tracking
	let usedOccPoints = $derived(
		Object.values(pointAllocations).reduce((sum, a) => sum + a.occupation, 0)
	);
	let usedPersonalPoints = $derived(
		Object.values(pointAllocations).reduce((sum, a) => sum + a.personal, 0)
	);
	let remainingOcc = $derived(totalOccPoints - usedOccPoints);
	let remainingPersonal = $derived(totalPersonalPoints - usedPersonalPoints);

	// Skill filter/search
	let searchQuery = $state('');
	let showCategory = $state<string>('all');

	const categories = [
		{ id: 'all', label: 'All' },
		{ id: 'occupation', label: 'Occupation' },
		{ id: 'combat', label: 'Combat' },
		{ id: 'investigation', label: 'Investigation' },
		{ id: 'social', label: 'Social' },
		{ id: 'academic', label: 'Academic' },
		{ id: 'practical', label: 'Practical' },
		{ id: 'other', label: 'Other' }
	];

	let filteredSkills = $derived.by(() => {
		let skills = allSkills;
		if (showCategory === 'occupation') {
			skills = skills.filter((s) => eligibleOccupationSkillIds.has(s.id));
		} else if (showCategory !== 'all') {
			skills = skills.filter((s) => s.category === showCategory);
		}
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			skills = skills.filter((s) => s.name.toLowerCase().includes(q));
		}
		return skills;
	});

	function setOccPoints(skillId: string, value: number) {
		if (!eligibleOccupationSkillIds.has(skillId)) return;
		const next = Math.max(0, value);
		const current = pointAllocations[skillId] ?? { occupation: 0, personal: 0 };
		if (next - current.occupation > remainingOcc) return; // can't overspend
		pointAllocations = {
			...pointAllocations,
			[skillId]: { ...current, occupation: next }
		};
	}

	function setPersonalPoints(skillId: string, value: number) {
		const next = Math.max(0, value);
		const current = pointAllocations[skillId] ?? { occupation: 0, personal: 0 };
		if (next - current.personal > remainingPersonal) return;
		pointAllocations = {
			...pointAllocations,
			[skillId]: { ...current, personal: next }
		};
	}

	function addCustomSkill() {
		const name = newCustomSkillName.trim();
		if (!name) return;
		const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
		customSkillDefs = [...customSkillDefs, { id, name, baseValue: newCustomSkillBase, isOccupation: newCustomSkillIsOccupation }];
		pointAllocations = { ...pointAllocations, [id]: { occupation: 0, personal: 0 } };
		newCustomSkillName = '';
		newCustomSkillBase = 0;
		newCustomSkillIsOccupation = false;
		showAddCustomSkill = false;
	}

	function removeCustomSkill(id: string) {
		customSkillDefs = customSkillDefs.filter((d) => d.id !== id);
		const next = { ...pointAllocations };
		delete next[id];
		pointAllocations = next;
	}

	function buildSkillAllocations(): CoCSkillAllocation[] {
		const result: CoCSkillAllocation[] = [];

		// Content-pack skills
		for (const skill of allSkills) {
			const alloc = getAlloc(skill.id);
			if (alloc.occupation === 0 && alloc.personal === 0 && !eligibleOccupationSkillIds.has(skill.id)) continue;

			const allocations: SkillPointAllocation[] = [];
			if (alloc.occupation > 0) {
				allocations.push({ points: alloc.occupation, source: 'occupation', sourceLabel: occupationDisplayName });
			}
			if (alloc.personal > 0) {
				allocations.push({ points: alloc.personal, source: 'personal-interest', sourceLabel: 'Personal Interest' });
			}

			const base = getBase(skill);
			result.push(createSkillAllocation(skill.id, base, allocations, eligibleOccupationSkillIds.has(skill.id)));
		}

		// Custom skills — always include once defined, even with zero allocation,
		// so the definition survives round-trips through the character JSON.
		for (const def of customSkillDefs) {
			const alloc = getAlloc(def.id);

			const allocations: SkillPointAllocation[] = [];
			if (alloc.occupation > 0) {
				allocations.push({ points: alloc.occupation, source: 'occupation', sourceLabel: occupationDisplayName });
			}
			if (alloc.personal > 0) {
				allocations.push({ points: alloc.personal, source: 'personal-interest', sourceLabel: 'Personal Interest' });
			}

			// Occupation flag: respect the player's explicit choice on the skill def,
			// or promote if occupation points were actually spent on it.
			result.push(createSkillAllocation(def.id, def.baseValue, allocations, (def.isOccupation ?? false) || alloc.occupation > 0));
		}

		return result;
	}

	function toggleChoice(list: string[], id: string, limit: number): string[] {
		if (list.includes(id)) return list.filter((existing) => existing !== id);
		if (list.length >= limit) return list;
		return [...list, id];
	}

	function setOccChoice(kind: 'interpersonal' | 'combat' | 'science' | 'any', id: string, limit: number) {
		if (kind === 'interpersonal') selectedInterpersonal = toggleChoice(selectedInterpersonal, id, limit);
		if (kind === 'combat') selectedCombat = toggleChoice(selectedCombat, id, limit);
		if (kind === 'science') selectedScience = toggleChoice(selectedScience, id, limit);
		if (kind === 'any') selectedAny = toggleChoice(selectedAny, id, limit);
	}

	let validation = $derived(
		(occupation || isCustomOcc)
			? validateSkillAllocation(
					buildSkillAllocations(),
					totalOccPoints,
					totalPersonalPoints,
					// Custom occupations have no credit rating constraint — accept any 0–99.
					occupation?.creditRating ?? { min: 0, max: 99 },
					eligibleOccupationSkillIds
				)
			: null
	);

	let choiceErrors = $derived.by(() => {
		if (isCustomOcc) return []; // Custom occupation has no choice constraints
		const errors: string[] = [];
		if ((occupation?.interpersonalChoiceCount ?? 0) !== selectedInterpersonal.length) {
			errors.push(`Choose ${occupation?.interpersonalChoiceCount} interpersonal skill${occupation?.interpersonalChoiceCount === 1 ? '' : 's'}.`);
		}
		if ((occupation?.combatChoiceCount ?? 0) !== selectedCombat.length) {
			errors.push(`Choose ${occupation?.combatChoiceCount} combat skill${occupation?.combatChoiceCount === 1 ? '' : 's'}.`);
		}
		if ((occupation?.scienceChoiceCount ?? 0) !== selectedScience.length) {
			errors.push(`Choose ${occupation?.scienceChoiceCount} science skill${occupation?.scienceChoiceCount === 1 ? '' : 's'}.`);
		}
		if ((occupation?.personalChoiceCount ?? 0) !== selectedAny.length) {
			errors.push(`Choose ${occupation?.personalChoiceCount} additional occupation skill${occupation?.personalChoiceCount === 1 ? '' : 's'}.`);
		}
		return errors;
	});

	// Split validation errors into hard blockers (data-invalid) and soft warnings
	// (incomplete but proceedable — e.g. Credit Rating outside occupation range,
	// or unspent points). Hard blockers keep the button disabled; soft warnings
	// turn the button amber and let the player advance after acknowledging them.
	const HARD_ERROR_PATTERNS = /overspent|exceeds maximum of 99|not eligible|cannot receive personal/i;
	let validationErrors = $derived(validation?.errors ?? []);
	let hardValidationErrors = $derived(validationErrors.filter((e) => HARD_ERROR_PATTERNS.test(e)));
	let softValidationErrors = $derived(validationErrors.filter((e) => !HARD_ERROR_PATTERNS.test(e)));
	let hasUnspentOcc = $derived(remainingOcc > 0);
	let hasUnspentPersonal = $derived(remainingPersonal > 0);
	let hasUnspent = $derived(hasUnspentOcc || hasUnspentPersonal);

	let canProceed = $derived(hardValidationErrors.length === 0 && choiceErrors.length === 0);
	let proceedWithWarning = $derived(canProceed && (hasUnspent || softValidationErrors.length > 0));

	// Sticky offset chain: alpha banner (top:0) → totals+filters block → table thead.
	// Both downstream offsets are measured, not hardcoded — the alpha banner can wrap
	// taller than its desktop default on narrow viewports / large text settings, and
	// the budget+filters block has variable height depending on how the filter pills
	// reflow. ResizeObserver keeps both values current.
	let stickyHeaderEl = $state<HTMLElement | null>(null);
	let stickyHeaderHeight = $state(155); // initial estimate; replaced once measured
	let alphaBannerHeight = $state(61); // initial estimate; replaced once measured

	let stickyHeaderTopPx = $derived(alphaBannerHeight);
	let theadTopPx = $derived(alphaBannerHeight + stickyHeaderHeight);

	$effect(() => {
		const el = stickyHeaderEl;
		if (!el || typeof ResizeObserver === 'undefined') return;
		const update = () => {
			stickyHeaderHeight = el.offsetHeight;
		};
		update();
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => ro.disconnect();
	});

	$effect(() => {
		if (typeof document === 'undefined' || typeof ResizeObserver === 'undefined') return;
		const banner = document.querySelector<HTMLElement>('.alpha-banner');
		if (!banner) return;
		const update = () => {
			alphaBannerHeight = banner.offsetHeight;
		};
		update();
		const ro = new ResizeObserver(update);
		ro.observe(banner);
		return () => ro.disconnect();
	});

	function proceed() {
		if (!canProceed) return;
		wizard.updateCharacter((c) => ({
			...c,
			skills: buildSkillAllocations(),
			customSkillDefs: [...customSkillDefs]
		}));
		wizard.completeStep(2);
		goto(WIZARD_STEPS[3].path);
	}
</script>

{#if occupation || isCustomOcc}
<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold" data-heading>Skills</h1>
		<p class="mt-1 text-sm text-[var(--color-muted-foreground)]">
			Allocate skill points from your occupation and personal interests.
		</p>
	</div>

	<!-- Sticky budget + filters block. Stays pinned just below the alpha banner
	     (whose height is measured at runtime) while the skill list scrolls. The
	     bind:this lets us measure this block's height so the table thead can
	     stick directly below it. aria-live on the totals so SR users hear
	     updates as they spend points. -->
	<div
		bind:this={stickyHeaderEl}
		style="top: {stickyHeaderTopPx}px"
		class="sticky z-20 -mx-4 space-y-3 border-b border-[var(--color-border)]/60 bg-[var(--color-background)]/92 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/80"
	>
		<div class="grid grid-cols-2 gap-4" role="status" aria-live="polite" aria-atomic="true">
			<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
				<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Occupation Points</span>
				<p class="text-lg font-bold">
					<span class={remainingOcc < 0 ? 'text-[var(--color-destructive)]' : remainingOcc === 0 ? 'text-[var(--color-primary)]' : ''}>
						{remainingOcc}
					</span>
					<span class="text-sm font-normal text-[var(--color-muted-foreground)]">/ {totalOccPoints} occupation points remaining</span>
				</p>
			</div>
			<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
				<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Personal Interest Points</span>
				<p class="text-lg font-bold">
					<span class={remainingPersonal < 0 ? 'text-[var(--color-destructive)]' : remainingPersonal === 0 ? 'text-[var(--color-primary)]' : ''}>
						{remainingPersonal}
					</span>
					<span class="text-sm font-normal text-[var(--color-muted-foreground)]">/ {totalPersonalPoints} personal interest points remaining</span>
				</p>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#each categories as cat}
				<button
					type="button"
					onclick={() => (showCategory = cat.id)}
					class="rounded-full px-3 py-1 text-xs font-medium transition-colors
						{showCategory === cat.id
							? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
							: 'border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]'}"
				>
					{cat.label}
				</button>
			{/each}
			<input
				type="text"
				placeholder="Search..."
				bind:value={searchQuery}
				class="ml-auto rounded-md border border-[var(--color-border)] bg-[var(--color-card)]
					px-3 py-1 text-sm placeholder:text-[var(--color-muted-foreground)]
					focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
			/>
		</div>
	</div>

	<!-- Occupation choice slots (only for standard occupations with defined choices) -->
	{#if !isCustomOcc && occupation && ((occupation.interpersonalChoiceCount ?? 0) > 0 || (occupation.combatChoiceCount ?? 0) > 0 || (occupation.scienceChoiceCount ?? 0) > 0 || (occupation.personalChoiceCount ?? 0) > 0)}
		<div class="space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
			<h2 class="text-sm font-semibold" data-heading>Occupation Skill Choices</h2>
			{#if (occupation.interpersonalChoiceCount ?? 0) > 0}
				<div>
					<p class="mb-1 text-xs uppercase text-[var(--color-muted-foreground)]">Interpersonal ({selectedInterpersonal.length}/{occupation.interpersonalChoiceCount})</p>
					<div class="flex flex-wrap gap-1">
						{#each allSkills.filter((s) => INTERPERSONAL_SKILLS.includes(s.id)) as skill}
							<button type="button" onclick={() => setOccChoice('interpersonal', skill.id, occupation.interpersonalChoiceCount ?? 0)}
								class="rounded border px-2 py-1 text-xs {selectedInterpersonal.includes(skill.id) ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border)]'}">
								{skill.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{#if (occupation.combatChoiceCount ?? 0) > 0}
				<div>
					<p class="mb-1 text-xs uppercase text-[var(--color-muted-foreground)]">Combat ({selectedCombat.length}/{occupation.combatChoiceCount})</p>
					<div class="flex flex-wrap gap-1">
						{#each combatSkills as skill}
							<button type="button" onclick={() => setOccChoice('combat', skill.id, occupation.combatChoiceCount ?? 0)}
								class="rounded border px-2 py-1 text-xs {selectedCombat.includes(skill.id) ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border)]'}">
								{skill.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{#if (occupation.scienceChoiceCount ?? 0) > 0}
				<div>
					<p class="mb-1 text-xs uppercase text-[var(--color-muted-foreground)]">Science ({selectedScience.length}/{occupation.scienceChoiceCount})</p>
					<div class="flex flex-wrap gap-1">
						{#each scienceSkills as skill}
							<button type="button" onclick={() => setOccChoice('science', skill.id, occupation.scienceChoiceCount ?? 0)}
								class="rounded border px-2 py-1 text-xs {selectedScience.includes(skill.id) ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border)]'}">
								{skill.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			{#if (occupation.personalChoiceCount ?? 0) > 0}
				<div>
					<p class="mb-1 text-xs uppercase text-[var(--color-muted-foreground)]">Additional ({selectedAny.length}/{occupation.personalChoiceCount})</p>
					<div class="flex flex-wrap gap-1">
						{#each allSkills.filter((s) => !requiredOccSkillIds.has(s.id) && s.id !== 'credit-rating') as skill}
							<button type="button" onclick={() => setOccChoice('any', skill.id, occupation.personalChoiceCount ?? 0)}
								class="rounded border px-2 py-1 text-xs {selectedAny.includes(skill.id) ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border)]'}">
								{skill.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if choiceErrors.length > 0 || hardValidationErrors.length > 0}
		<div class="rounded-md border border-[var(--color-destructive)] bg-[var(--color-destructive)]/10 p-3 text-sm text-[var(--color-destructive)]">
			<p class="mb-1 font-semibold">Resolve before continuing</p>
			<ul class="space-y-1">
				{#each choiceErrors as error}
					<li>{error}</li>
				{/each}
				{#each hardValidationErrors as error}
					<li>{error}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if softValidationErrors.length > 0 || hasUnspent}
		<div class="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-3 text-sm text-[var(--color-warning)]">
			<p class="mb-1 font-semibold">You can continue, but&hellip;</p>
			<ul class="space-y-1">
				{#if hasUnspentOcc}
					<li>{remainingOcc} occupation point{remainingOcc === 1 ? '' : 's'} unspent.</li>
				{/if}
				{#if hasUnspentPersonal}
					<li>{remainingPersonal} personal interest point{remainingPersonal === 1 ? '' : 's'} unspent.</li>
				{/if}
				{#each softValidationErrors as error}
					<li>{error}</li>
				{/each}
			</ul>
			<p class="mt-2 text-xs opacity-80">Skill points cannot be added later — only earned through play.</p>
		</div>
	{/if}

	<!-- Skills table. The thead sticks just below the budget+filters block so the
	     column labels stay visible while scrolling. `theadTopPx` is the measured
	     bottom-edge of that block (alpha banner + budget + filters), recomputed on
	     resize via ResizeObserver in the script.

	     NOTE: do NOT wrap this in `overflow-x-auto`. Any ancestor with
	     `overflow: auto/scroll/hidden` becomes the containing block for
	     `position: sticky`, which breaks the thead pinning. If horizontal
	     overflow handling is needed on narrow viewports, do it on a wrapper
	     that doesn't contain a sticky descendant. -->
	<div>
		<table class="w-full text-sm">
			<thead class="sticky z-10 bg-[var(--color-background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/85" style="top: {theadTopPx}px">
				<tr class="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted-foreground)]">
					<th class="py-2 pr-2">Skill</th>
					<th class="py-2 pr-2 text-center w-14">Base</th>
					<th class="py-2 pr-2 text-center w-20">Occ. Pts</th>
					<th class="py-2 pr-2 text-center w-20">Pers. Pts</th>
					<th class="py-2 pr-2 text-center w-14">Total</th>
					<th class="py-2 pr-2 text-center w-14">Half</th>
					<th class="py-2 text-center w-14">Fifth</th>
				</tr>
			</thead>
			<tbody>
				{#each filteredSkills as skill (skill.id)}
					{@const base = getBase(skill)}
					{@const alloc = getAlloc(skill.id)}
					{@const total = base + alloc.occupation + alloc.personal}
					{@const isOcc = eligibleOccupationSkillIds.has(skill.id)}
					{@const occColumnLocked = !isOcc || (alloc.occupation === 0 && remainingOcc <= 0)}
					{@const personalColumnLocked = alloc.personal === 0 && remainingPersonal <= 0}
					<tr class="border-b border-[var(--color-border)]/30 {isOcc ? 'bg-[var(--color-accent)]/30' : ''}">
						<td class="py-1.5 pr-2">
							<span class="font-medium">{skill.name}</span>
							{#if isOcc}
								<span class="ml-1 rounded bg-[var(--color-primary)]/20 px-1 text-[10px] text-[var(--color-primary)]">OCC</span>
							{/if}
						</td>
						<td class="py-1.5 pr-2 text-center text-[var(--color-muted-foreground)]">{base}</td>
						<td class="py-1.5 pr-2 text-center">
							<input
								type="number"
								min="0"
								max={isOcc ? Math.min(99, alloc.occupation + Math.max(0, remainingOcc)) : 0}
								value={alloc.occupation}
								disabled={occColumnLocked}
								title={occColumnLocked && isOcc ? 'No occupation points remaining — reduce another skill to free points' : undefined}
								oninput={(e) => {
									const input = e.currentTarget as HTMLInputElement;
									setOccPoints(skill.id, parseInt(input.value) || 0);
									// Snap-back: if the requested value was rejected (over budget),
									// the state didn't change, so we force the input to reflect the
									// authoritative state. Without this, the typed value would linger
									// visually until something else triggers a re-render.
									input.value = String((pointAllocations[skill.id] ?? { occupation: 0, personal: 0 }).occupation);
								}}
								class="w-16 rounded border border-[var(--color-border)] bg-[var(--color-card)]
									px-1.5 py-0.5 text-center text-sm
									focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)] disabled:opacity-30 disabled:cursor-not-allowed"
							/>
						</td>
						<td class="py-1.5 pr-2 text-center">
							<input
								type="number"
								min="0"
								max={Math.min(99, alloc.personal + Math.max(0, remainingPersonal))}
								value={alloc.personal}
								disabled={personalColumnLocked}
								title={personalColumnLocked ? 'No personal interest points remaining — reduce another skill to free points' : undefined}
								oninput={(e) => {
									const input = e.currentTarget as HTMLInputElement;
									setPersonalPoints(skill.id, parseInt(input.value) || 0);
									input.value = String((pointAllocations[skill.id] ?? { occupation: 0, personal: 0 }).personal);
								}}
								class="w-16 rounded border border-[var(--color-border)] bg-[var(--color-card)]
									px-1.5 py-0.5 text-center text-sm
									focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)] disabled:opacity-30 disabled:cursor-not-allowed"
							/>
						</td>
						<td class="py-1.5 pr-2 text-center font-bold {total > 89 ? 'text-[var(--color-warning)]' : ''}">{total}</td>
						<td class="py-1.5 pr-2 text-center text-[var(--color-muted-foreground)]">{halfValue(total)}</td>
						<td class="py-1.5 text-center text-[var(--color-muted-foreground)]">{fifthValue(total)}</td>
					</tr>
				{/each}
			<!-- Custom skill rows -->
				{#each customSkillDefs as def (def.id)}
					{@const alloc = getAlloc(def.id)}
					{@const total = def.baseValue + alloc.occupation + alloc.personal}
					{@const isOcc = eligibleOccupationSkillIds.has(def.id)}
					{@const occColumnLocked = !isOcc || (alloc.occupation === 0 && remainingOcc <= 0)}
					{@const personalColumnLocked = alloc.personal === 0 && remainingPersonal <= 0}
					<tr class="border-b border-[var(--color-border)]/30 bg-[var(--color-accent)]/20">
						<td class="py-1.5 pr-2">
							<span class="font-medium">{def.name}</span>
							<span class="ml-1 rounded bg-[var(--color-muted-foreground)]/20 px-1 text-[10px] text-[var(--color-muted-foreground)]">custom</span>
							{#if isOcc}
								<span class="ml-1 rounded bg-[var(--color-primary)]/20 px-1 text-[10px] text-[var(--color-primary)]">OCC</span>
							{/if}
						</td>
						<td class="py-1.5 pr-2 text-center text-[var(--color-muted-foreground)]">{def.baseValue}</td>
						<td class="py-1.5 pr-2 text-center">
							<input
								type="number" min="0" value={alloc.occupation}
								disabled={occColumnLocked}
								oninput={(e) => {
									const input = e.currentTarget as HTMLInputElement;
									setOccPoints(def.id, parseInt(input.value) || 0);
									input.value = String((pointAllocations[def.id] ?? { occupation: 0, personal: 0 }).occupation);
								}}
								class="w-16 rounded border border-[var(--color-border)] bg-[var(--color-card)]
									px-1.5 py-0.5 text-center text-sm
									focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)] disabled:opacity-30 disabled:cursor-not-allowed"
							/>
						</td>
						<td class="py-1.5 pr-2 text-center">
							<input
								type="number" min="0" value={alloc.personal}
								disabled={personalColumnLocked}
								oninput={(e) => {
									const input = e.currentTarget as HTMLInputElement;
									setPersonalPoints(def.id, parseInt(input.value) || 0);
									input.value = String((pointAllocations[def.id] ?? { occupation: 0, personal: 0 }).personal);
								}}
								class="w-16 rounded border border-[var(--color-border)] bg-[var(--color-card)]
									px-1.5 py-0.5 text-center text-sm
									focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)] disabled:opacity-30 disabled:cursor-not-allowed"
							/>
						</td>
						<td class="py-1.5 pr-2 text-center font-bold {total > 89 ? 'text-[var(--color-warning)]' : ''}">{total}</td>
						<td class="py-1.5 pr-2 text-center text-[var(--color-muted-foreground)]">{halfValue(total)}</td>
						<td class="py-1.5 text-center">
							<button
								type="button"
								onclick={() => removeCustomSkill(def.id)}
								class="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)] text-xs"
								title="Remove custom skill"
							>✕</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Add custom skill -->
	<div>
		{#if showAddCustomSkill}
			<div class="flex items-end gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
				<div class="flex-1">
					<label for="new-skill-name" class="block text-xs uppercase text-[var(--color-muted-foreground)] mb-1">Skill Name</label>
					<input
						id="new-skill-name"
						type="text"
						bind:value={newCustomSkillName}
						placeholder="e.g. Occult Lore"
						class="w-full rounded border border-[var(--color-border)] bg-[var(--color-background)]
							px-2 py-1.5 text-sm placeholder:text-[var(--color-muted-foreground)]
							focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
					/>
				</div>
				<div class="w-24">
					<label for="new-skill-base" class="block text-xs uppercase text-[var(--color-muted-foreground)] mb-1">Base %</label>
					<input
						id="new-skill-base"
						type="number" min="0" max="99"
						bind:value={newCustomSkillBase}
						class="w-full rounded border border-[var(--color-border)] bg-[var(--color-background)]
							px-2 py-1.5 text-sm text-center
							focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
					/>
				</div>
				<button
					type="button"
					aria-pressed={newCustomSkillIsOccupation}
					onclick={() => (newCustomSkillIsOccupation = !newCustomSkillIsOccupation)}
					class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors
						{newCustomSkillIsOccupation
							? 'bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] ring-1 ring-[var(--color-ring)]'
							: 'border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]'}"
				>Occupation Skill</button>
				<button
					type="button"
					onclick={addCustomSkill}
					disabled={!newCustomSkillName.trim()}
					class="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium
						text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
				>Add</button>
				<button
					type="button"
					onclick={() => { showAddCustomSkill = false; newCustomSkillName = ''; newCustomSkillBase = 0; newCustomSkillIsOccupation = false; }}
					class="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-accent)]"
				>Cancel</button>
			</div>
		{:else}
			<button
				type="button"
				onclick={() => (showAddCustomSkill = true)}
				class="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] underline-offset-2 hover:underline"
			>
				+ Add Custom Skill
			</button>
		{/if}
	</div>

	<!-- Navigation -->
	<div class="flex justify-between pt-4">
		<a
			href={WIZARD_STEPS[1].path}
			class="rounded-md border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium
				text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-accent)]"
		>
			&larr; Occupation
		</a>
		<div class="flex items-center gap-3">
			{#if !canProceed}
				<p id="skills-proceed-hint" class="text-sm text-[var(--color-muted-foreground)]">
					{#if remainingOcc < 0}Refund {Math.abs(remainingOcc)} occupation point{Math.abs(remainingOcc) === 1 ? '' : 's'}.
					{:else if remainingPersonal < 0}Refund {Math.abs(remainingPersonal)} personal interest point{Math.abs(remainingPersonal) === 1 ? '' : 's'}.
					{:else if choiceErrors.length > 0}Resolve the highlighted skill choice errors.
					{:else}Resolve the highlighted skill allocation errors.{/if}
				</p>
			{/if}
			<button
				type="button"
				onclick={proceed}
				disabled={!canProceed}
				aria-describedby={!canProceed ? 'skills-proceed-hint' : undefined}
				class="rounded-md px-6 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50
					{proceedWithWarning
						? 'border border-[var(--color-warning)] bg-[var(--color-warning)]/15 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/25'
						: 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90'}"
			>
				{proceedWithWarning ? 'Continue anyway' : 'Next: Backstory'} &rarr;
			</button>
		</div>
	</div>
</div>
{:else}
<p class="py-8 text-center text-[var(--color-muted-foreground)]">Please select an occupation first.</p>
{/if}
