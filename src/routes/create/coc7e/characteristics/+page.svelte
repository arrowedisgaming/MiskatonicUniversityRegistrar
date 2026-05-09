<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { preventNumberWheel } from '$lib/actions/number-input';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import { ALL_CHARACTERISTICS, CHARACTERISTIC_LABELS, ROLL_3D6 } from '$lib/types/common';
	import type { CharacteristicId, Era, Mode } from '$lib/types/common';
	import {
		halfValue,
		fifthValue,
		POINT_BUY_TOTAL,
		POINT_BUY_MIN,
		POINT_BUY_MAX,
		POINT_BUY_RECOMMENDED_MIN_INT_SIZ,
		QUICK_FIRE_VALUES,
		pointBuyStatus,
		isQuickFireAssignment,
		quickFireAvailableCounts,
		quickFireSwapAssignment,
		rollAllCharacteristics,
		rollResultsToValues,
		rollResultsToRolls,
		isReconcileTokenFresh
	} from '$lib/engine/characteristics';
	import { calculateHP, calculateMP, calculateStartingSanity, calculateDamageBonusAndBuild, calculateMoveRate, getAgeModifier } from '$lib/engine/derived-stats';
	import { rollLuck, rollDie, roll3d6x5, roll2d6plus6x5 } from '$lib/engine/dice';
	import { showDiceRoll } from '$lib/stores/dice-rolls';
	import type { DiceGroup } from '$lib/dice/protocol';
	import {
		applyAgeAdjustments,
		physicalDeductionTargets,
		requiredPhysicalDeduction,
		makeEduImprovementCheck,
		recomputeEduImprovementChecks,
		makeYouthLuckAdjustment,
		type PhysicalDeductions
	} from '$lib/engine/age-adjustments';
	import { editableCharacteristicMethod, type CharacteristicMethodId } from '$lib/types/content-pack';
	import type { EduImprovementCheck, LuckAdjustment } from '$lib/types/character';
	import { inkBleed, dossierFiling } from '$lib/transitions/eerie';

	const data = page.data as {
		contentPack: import('$lib/types/content-pack').CoCContentPack;
	};

	const POINT_BUY_DEFAULTS: Record<CharacteristicId, number> = {
		str: 50, con: 50, dex: 50, int: 50, pow: 50, app: 50, siz: 60, edu: 60
	};
	const QUICK_FIRE_DEFAULTS: Record<CharacteristicId, number> = {
		str: 40, con: 50, dex: 50, int: 50, pow: 60, app: 60, siz: 70, edu: 80
	};

	// Local state for this step
	let era = $state<Era>($wizard.character.era);
	let mode = $state<Mode>($wizard.character.mode);
	let age = $state($wizard.character.age);
	let method = $state<CharacteristicMethodId>(editableCharacteristicMethod($wizard.character.characteristics.method));
	let baseValues = $state<Record<CharacteristicId, number>>({ ...$wizard.character.characteristics.baseValues });
	let rolls = $state<Record<CharacteristicId, number[]> | null>($wizard.character.characteristics.rolls);
	let physicalDeductions = $state<PhysicalDeductions>({});
	let eduChecks = $state<EduImprovementCheck[]>([...($wizard.character.characteristics.eduImprovementChecks ?? [])]);
	let luckAdjustment = $state<LuckAdjustment | null>($wizard.character.characteristics.luckAdjustment ?? null);
	let luck = $state<{ max: number; current: number; rolls: number[] | null; rollSets?: number[][] | null; reason?: string | null }>({ ...$wizard.character.derivedStats.luck });
	let diceRolling = $state(false);
	let autoRolling = $state(false);
	// Point Buy & Quick Fire: defer Luck rolls / EDU improvement / age
	// adjustments until the player explicitly confirms their allocation.
	// Otherwise every stepper click or pool pick re-rolls Luck and EDU, which
	// is jarring while the player is still rearranging values. The Roll method
	// rolls explicitly so it doesn't need this gate.
	let allocationConfirmed = $state(false);
	// Monotonic generation counter incremented on every state change that
	// would invalidate an in-flight automatic-roll sequence (allocation,
	// method, age). reconcileAutomaticRolls() snapshots this at entry and
	// after each await; if it changes, in-flight writes are abandoned. This
	// closes a re-entrancy hole where a confirm → change-allocation → confirm
	// sequence could allow a stale Luck value to "win" because the second
	// confirm short-circuits on luck.max > 0.
	let reconcileGen = $state(0);
	function bumpReconcileGen() {
		reconcileGen = reconcileGen + 1;
	}
	// Allocation controls are locked while automatic rolls (Luck / EDU) are
	// settling. Without this the player can edit values mid-animation and
	// race the in-flight writes.
	let allocationLocked = $derived(autoRolling || diceRolling);

	let ageModifier = $derived(getAgeModifier(age, data.contentPack.ageModifiers));
	let ageResult = $derived(applyAgeAdjustments(baseValues, age, data.contentPack.ageModifiers, physicalDeductions, eduChecks, luckAdjustment));
	let eduBaseForChecks = $derived(applyAgeAdjustments(baseValues, age, data.contentPack.ageModifiers, physicalDeductions, [], luckAdjustment).values.edu);
	let values = $derived(ageResult.values);
	let hasValues = $derived(Object.values(baseValues).every((v) => v > 0));
	let deductionTargets = $derived(physicalDeductionTargets(ageModifier));
	let requiredDeduction = $derived(requiredPhysicalDeduction(ageModifier));
	let deductionTotal = $derived(Object.values(physicalDeductions).reduce((sum, value) => sum + Math.max(0, value ?? 0), 0));
	let requiredEduChecks = $derived(ageModifier?.eduImprovementChecks ?? 0);

	// Derived stats (auto-calculated)
	let hp = $derived(hasValues ? calculateHP(values.con, values.siz) : 0);
	let mp = $derived(hasValues ? calculateMP(values.pow) : 0);
	let sanity = $derived(hasValues ? calculateStartingSanity(values.pow) : 0);
	let dbBuild = $derived(hasValues
		? calculateDamageBonusAndBuild(values.str, values.siz, data.contentPack.damageBonusBuildTable)
		: { damageBonus: '-', build: 0 }
	);
	let moveRate = $derived(hasValues
		? calculateMoveRate(values.str, values.dex, values.siz, ageModifier)
		: 0
	);

	let pbStatus = $derived(pointBuyStatus(baseValues));
	let quickFireValid = $derived(isQuickFireAssignment(baseValues));
	// Roll-method validity: every stat is filled and each value sits in its dice range.
	// 3d6×5 → 15..90 for STR/CON/DEX/APP/POW, (2d6+6)×5 → 40..90 for SIZ/INT/EDU.
	let rollValid = $derived(
		Object.entries(baseValues).every(([id, v]) => {
			const min = ROLL_3D6.includes(id as CharacteristicId) ? 15 : 40;
			return v >= min && v <= 90;
		})
	);
	const rollOneByOneOrder: CharacteristicId[] = ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu'];
	let nextStatToRoll = $derived(rollOneByOneOrder.find((id) => baseValues[id] <= 0) ?? null);
	let methodValid = $derived(
		method === 'point-buy' ? pbStatus.valid : method === 'quick-fire' ? quickFireValid : rollValid
	);
	let methodNeedsConfirmation = $derived(method === 'point-buy' || method === 'quick-fire');
	let awaitingAllocationConfirm = $derived(methodNeedsConfirmation && methodValid && !allocationConfirmed);
	let canProceed = $derived(
		hasValues
		&& luck.max > 0
		&& ageResult.errors.length === 0
		&& methodValid
		&& mode === 'standard'
		&& !awaitingAllocationConfirm
	);

	// Soft warnings: INT and SIZ recommended ≥ 40 in Point Buy
	let intSizSoftWarn = $derived(method === 'point-buy' && (
		baseValues.int < POINT_BUY_RECOMMENDED_MIN_INT_SIZ || baseValues.siz < POINT_BUY_RECOMMENDED_MIN_INT_SIZ
	));

	/**
	 * Reset only the *derived-from-stats* age state. Luck is intentionally
	 * preserved: per design, Luck is rolled once and only changed by an
	 * explicit user click on the Reroll Luck button. EDU improvement checks
	 * depend on the post-age EDU base value so they recompute when stats or
	 * age change, but Luck is independent of stat allocation.
	 */
	function resetAgeStateForCharacteristicChange() {
		physicalDeductions = {};
		eduChecks = [];
	}

	async function handleAgeChanged() {
		// Age changes shift age modifiers and EDU improvement requirements.
		// Bumping the gen invalidates any in-flight reconcile sequence so
		// EDU rolls against the prior age get discarded. Luck is *not*
		// touched here — it's a one-shot value the user controls via the
		// explicit Reroll Luck button.
		bumpReconcileGen();
		const targets = new Set(deductionTargets);
		physicalDeductions = Object.fromEntries(
			Object.entries(physicalDeductions).filter(([key]) => targets.has(key as CharacteristicId))
		) as PhysicalDeductions;
		if (eduChecks.length > requiredEduChecks) {
			eduChecks = recomputeEduImprovementChecks(eduBaseForChecks, eduChecks.slice(0, requiredEduChecks));
		}
		await reconcileAutomaticRolls();
	}

	async function animateDice(groups: DiceGroup[], label: string): Promise<void> {
		diceRolling = true;
		try {
			await showDiceRoll({ groups, label, reveal: 'after-settle' });
		} finally {
			diceRolling = false;
		}
	}

	async function setMethod(next: CharacteristicMethodId) {
		if (next === method) return;
		method = next;
		rolls = null;
		allocationConfirmed = false;
		bumpReconcileGen();
		if (next === 'point-buy') {
			baseValues = { ...POINT_BUY_DEFAULTS };
		} else {
			// Quick Fire & Roll: start with zeroed values so the player explicitly
			// assigns or rolls. Auto-assign is one click away in Quick Fire.
			baseValues = { str: 0, con: 0, dex: 0, int: 0, pow: 0, app: 0, siz: 0, edu: 0 };
		}
		resetAgeStateForCharacteristicChange();
		await reconcileAutomaticRolls();
	}

	function characteristicDiceGroups(results: ReturnType<typeof rollAllCharacteristics>): DiceGroup[] {
		return [{
			count: results.reduce((sum, r) => sum + r.rolls.length, 0),
			sides: 6,
			results: results.flatMap((r) => r.rolls)
		}];
	}

	async function rollAllStats() {
		const results = rollAllCharacteristics();
		await animateDice(characteristicDiceGroups(results), 'Characteristics');
		baseValues = rollResultsToValues(results);
		rolls = rollResultsToRolls(results);
		resetAgeStateForCharacteristicChange();
		await reconcileAutomaticRolls();
	}

	async function rollNextStat() {
		if (!nextStatToRoll) return;
		const char = nextStatToRoll;
		const is3d6 = ROLL_3D6.includes(char);
		const result = is3d6 ? roll3d6x5() : roll2d6plus6x5();
		await animateDice([{ count: result.rolls.length, sides: 6, results: result.rolls }], CHARACTERISTIC_LABELS[char]);
		baseValues = { ...baseValues, [char]: result.total };
		rolls = { ...((rolls ?? {}) as Record<CharacteristicId, number[]>), [char]: result.rolls };
		resetAgeStateForCharacteristicChange();
		await reconcileAutomaticRolls();
	}

	async function rerollSingleStat(char: CharacteristicId) {
		const is3d6 = ROLL_3D6.includes(char);
		const result = is3d6 ? roll3d6x5() : roll2d6plus6x5();
		await animateDice([{ count: result.rolls.length, sides: 6, results: result.rolls }], `${char.toUpperCase()} reroll`);
		baseValues = { ...baseValues, [char]: result.total };
		rolls = { ...((rolls ?? {}) as Record<CharacteristicId, number[]>), [char]: result.rolls };
		resetAgeStateForCharacteristicChange();
		await reconcileAutomaticRolls();
	}

	function clearRolls() {
		baseValues = { str: 0, con: 0, dex: 0, int: 0, pow: 0, app: 0, siz: 0, edu: 0 };
		rolls = null;
		resetAgeStateForCharacteristicChange();
	}

	function applyPointBuyDelta(char: CharacteristicId, delta: number) {
		const next = baseValues[char] + delta;
		if (next < POINT_BUY_MIN || next > POINT_BUY_MAX) return;
		// Allow going over budget transiently — the proceed gate validates the
		// total. We do not block individual moves on the budget so the player
		// can rearrange points freely.
		baseValues = { ...baseValues, [char]: next };
		invalidateAllocationConfirmation();
	}

	/**
	 * Live update from the number input. Does NOT clamp — clamping on every
	 * keystroke breaks the standard text-field workflow (highlight + type a
	 * digit becomes "1" → clamped to 15 before the user finishes typing 18).
	 * We only validate the range; the UI keeps the raw value visible until
	 * the user blurs, at which point setPointBuyValueOnBlur() snaps it back
	 * into [MIN, MAX].
	 */
	function setPointBuyValue(char: CharacteristicId, raw: number) {
		baseValues = { ...baseValues, [char]: Math.round(raw || 0) };
		invalidateAllocationConfirmation();
	}

	function setPointBuyValueOnBlur(char: CharacteristicId, raw: number) {
		const clamped = Math.max(POINT_BUY_MIN, Math.min(POINT_BUY_MAX, Math.round(raw || POINT_BUY_MIN)));
		if (clamped !== baseValues[char]) {
			baseValues = { ...baseValues, [char]: clamped };
			invalidateAllocationConfirmation();
		}
	}

	function resetPointBuy() {
		baseValues = { ...POINT_BUY_DEFAULTS };
		invalidateAllocationConfirmation();
	}

	/**
	 * Any allocation change resets the downstream age/EDU/Luck state, the
	 * confirmation flag, and the reconcile generation. Bumping the generation
	 * causes any in-flight reconcileAutomaticRolls() sequence to abandon its
	 * writes when it next checks the snapshot, so a confirmed-then-changed
	 * sequence cannot let a stale Luck roll leak back into the new state.
	 */
	function invalidateAllocationConfirmation() {
		allocationConfirmed = false;
		bumpReconcileGen();
		resetAgeStateForCharacteristicChange();
	}

	async function confirmAllocation() {
		if (!methodValid || !methodNeedsConfirmation) return;
		allocationConfirmed = true;
		await reconcileAutomaticRolls();
	}

	function applyQuickFirePick(char: CharacteristicId, value: number) {
		baseValues = quickFireSwapAssignment(baseValues, char, value);
		invalidateAllocationConfirmation();
	}

	function autoAssignQuickFire() {
		baseValues = { ...QUICK_FIRE_DEFAULTS };
		invalidateAllocationConfirmation();
	}

	function clearQuickFire() {
		baseValues = { str: 0, con: 0, dex: 0, int: 0, pow: 0, app: 0, siz: 0, edu: 0 };
		invalidateAllocationConfirmation();
	}

	let qfCounts = $derived(quickFireAvailableCounts(baseValues));
	const QF_OPTIONS: readonly number[] = [40, 50, 60, 70, 80] as const;

	/**
	 * Roll Luck dice. When called from the reconciler, `token` is the
	 * generation snapshot at sequence start; if the live `reconcileGen` has
	 * advanced by the time the dice animation finishes, the result is
	 * discarded so a stale Luck value can never write back over a freshly
	 * invalidated allocation.
	 */
	async function rollLuckDice(token?: number) {
		if (age >= 15 && age <= 19) {
			const first = rollLuck();
			const second = rollLuck();
			await animateDice([{ count: 6, sides: 6, results: [...first.rolls, ...second.rolls] }], 'Luck twice');
			if (!isReconcileTokenFresh(token, reconcileGen)) return;
			luckAdjustment = makeYouthLuckAdjustment(first.rolls, second.rolls);
			luck = {
				max: luckAdjustment.chosenTotal,
				current: luckAdjustment.chosenTotal,
				rolls: first.total >= second.total ? first.rolls : second.rolls,
				rollSets: luckAdjustment.rollSets,
				reason: luckAdjustment.reason
			};
			return;
		}
		const result = rollLuck();
		await animateDice([{ count: result.rolls.length, sides: 6, results: result.rolls }], 'Luck');
		if (!isReconcileTokenFresh(token, reconcileGen)) return;
		luckAdjustment = null;
		luck = { max: result.total, current: result.total, rolls: result.rolls, rollSets: null, reason: null };
	}

	async function rollNextEduCheck(token?: number) {
		if (eduChecks.length >= requiredEduChecks) return;
		const currentEdu = eduChecks.length === 0
			? eduBaseForChecks
			: eduChecks[eduChecks.length - 1].resultingEdu;
		const roll = rollDie(100);
		await animateDice([{ count: 1, sides: 100, results: [roll] }], 'EDU check');
		if (!isReconcileTokenFresh(token, reconcileGen)) return;
		const improvementRoll = roll > currentEdu ? rollDie(10) : null;
		if (improvementRoll !== null) {
			await animateDice([{ count: 1, sides: 10, results: [improvementRoll] }], 'EDU improvement');
			if (!isReconcileTokenFresh(token, reconcileGen)) return;
		}
		const check = makeEduImprovementCheck(currentEdu, roll, improvementRoll);
		eduChecks = [...eduChecks, check];
	}

	async function reconcileAutomaticRolls() {
		if (autoRolling || !hasValues) return;
		// Point Buy & Quick Fire: defer Luck/EDU rolls until the player
		// confirms allocation. Roll method has no confirmation gate.
		if (methodNeedsConfirmation && !allocationConfirmed) return;
		// Snapshot the reconcile generation. Each subroutine checks this token
		// after its await(s) and bails before writing if the user has changed
		// the allocation, method, or age in the meantime.
		const token = reconcileGen;
		autoRolling = true;
		try {
			if (eduChecks.length > requiredEduChecks) {
				eduChecks = recomputeEduImprovementChecks(eduBaseForChecks, eduChecks.slice(0, requiredEduChecks));
			}
			while (eduChecks.length < requiredEduChecks) {
				if (!isReconcileTokenFresh(token, reconcileGen)) return;
				await rollNextEduCheck(token);
				if (!isReconcileTokenFresh(token, reconcileGen)) return;
			}
			// Luck rolls automatically only the first time we reach a settled
			// state (luck has never been rolled). After that, the player must
			// click Reroll Luck explicitly — allocation tweaks, EDU checks, or
			// age changes never silently change a value that was already set.
			if (luck.max <= 0) {
				await rollLuckDice(token);
			}
		} finally {
			autoRolling = false;
		}
	}

	function proceed() {
		wizard.updateCharacter((c) => ({
			...c,
			era,
			mode,
			age,
			characteristics: {
				method,
				values: { ...values },
				baseValues: { ...baseValues },
				rolls: method === 'roll' ? rolls : null,
				ageAdjustments: ageResult.ageAdjustments,
				eduImprovementChecks: ageResult.eduImprovementChecks,
				luckAdjustment: ageResult.luckAdjustment
			},
			derivedStats: {
				...c.derivedStats,
				hp: { max: hp, current: hp },
				mp: { max: mp, current: mp },
				sanity: { max: 99, current: sanity, startingValue: sanity },
				luck,
				damageBonus: dbBuild.damageBonus,
				build: dbBuild.build,
				moveRate
			},
			// Any characteristic method or age change can alter budgets/base skills.
			occupation: null,
			skills: []
		}));
		wizard.completeStep(0);
		void goto(WIZARD_STEPS[1].path);
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-2xl font-bold" data-heading>Characteristics</h1>
		<p class="mt-1 text-sm text-[var(--color-muted-foreground)]">
			Choose an era and generation method, then enter characteristics. Age adjustments
			are applied after the characteristic values are known.
		</p>
	</div>

	<div class="grid gap-4 md:grid-cols-2">
		<div>
			<label for="era" class="mb-1 block text-sm font-medium">Era</label>
			<select id="era" bind:value={era}
				class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm">
				{#each data.contentPack.eras.filter((e) => e.id !== 'modern') as eraOption}
					<option value={eraOption.id}>{eraOption.name}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="mode" class="mb-1 block text-sm font-medium">Mode</label>
			<select id="mode" bind:value={mode}
				class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm">
				<option value="standard">Standard</option>
				<option value="pulp">Pulp (not yet supported)</option>
			</select>
			{#if mode === 'pulp'}
				<p class="mt-1 text-xs text-[var(--color-warning)]">Pulp creation is gated until archetypes, talents, and Pulp-specific rules are implemented.</p>
			{/if}
		</div>
	</div>

	<!-- Method segmented control -->
	<div>
		<span class="mb-2 block text-sm font-medium">Generation Method</span>
		<div role="tablist" aria-label="Characteristic generation method" class="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-1">
			<button
				type="button"
				role="tab"
				aria-selected={method === 'roll'}
				onclick={() => setMethod('roll')}
				disabled={allocationLocked}
				class="rounded px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {method === 'roll'
					? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
					: 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}"
			>
				Roll
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={method === 'point-buy'}
				onclick={() => setMethod('point-buy')}
				disabled={allocationLocked}
				class="rounded px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {method === 'point-buy'
					? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
					: 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}"
			>
				Point Buy
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={method === 'quick-fire'}
				onclick={() => setMethod('quick-fire')}
				disabled={allocationLocked}
				class="rounded px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {method === 'quick-fire'
					? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
					: 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}"
			>
				Quick Fire
			</button>
		</div>
	</div>

	<!-- POINT BUY PANEL -->
	{#if method === 'point-buy'}
		<section class="space-y-4 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<header class="flex flex-wrap items-baseline justify-between gap-3">
				<div>
					<h2 class="font-semibold" data-heading>Point Buy</h2>
					<p class="text-xs text-[var(--color-muted-foreground)]">
						Distribute {POINT_BUY_TOTAL} points across the eight characteristics. Each value {POINT_BUY_MIN}–{POINT_BUY_MAX}.
						Recommended minimum: {POINT_BUY_RECOMMENDED_MIN_INT_SIZ} for INT and SIZ.
					</p>
				</div>
				<button
					type="button"
					onclick={resetPointBuy}
					disabled={allocationLocked}
					class="text-xs text-[var(--color-muted-foreground)] underline-offset-2 hover:text-[var(--color-foreground)] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
				>
					Reset to defaults
				</button>
			</header>

			<div class="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-y border-[var(--color-border)]/60 py-2 text-sm tabular-nums">
				<span>Spent: <span class="font-semibold">{pbStatus.total}</span> / {POINT_BUY_TOTAL}</span>
				<span>
					Remaining:
					<span
						class="text-2xl font-bold leading-none {pbStatus.remaining === 0
							? 'text-[var(--color-primary)]'
							: pbStatus.remaining < 0
								? 'text-[var(--color-destructive)]'
								: 'text-[var(--color-warning)]'}"
					>
						{pbStatus.remaining}
					</span>
				</span>
				{#if !pbStatus.allInRange}
					<span class="text-xs text-[var(--color-warning)]">All values must be {POINT_BUY_MIN}–{POINT_BUY_MAX}.</span>
				{/if}
			</div>

			<div class="grid gap-2 sm:grid-cols-2">
				{#each ALL_CHARACTERISTICS as char, i (char)}
					{@const v = baseValues[char]}
					{@const final = values[char]}
					{@const recWarn = (char === 'int' || char === 'siz') && v < POINT_BUY_RECOMMENDED_MIN_INT_SIZ}
					<div in:inkBleed|global={{ delay: i * 40 }} class="flex items-center justify-between gap-3 rounded border border-[var(--color-border)]/50 bg-[var(--color-background)]/40 px-3 py-2">
						<div class="flex flex-col">
							<span class="text-sm font-medium">{CHARACTERISTIC_LABELS[char]} <span class="text-xs uppercase text-[var(--color-muted-foreground)]">({char})</span></span>
							{#if recWarn}
								<span class="text-[10px] uppercase tracking-wide text-[var(--color-warning)]">Rec ≥ {POINT_BUY_RECOMMENDED_MIN_INT_SIZ}</span>
							{:else if final !== v}
								<span class="text-[10px] text-[var(--color-muted-foreground)]">→ {final} after age</span>
							{/if}
						</div>
						<div class="flex items-center gap-2">
							<button
								type="button"
								aria-label="Decrease {CHARACTERISTIC_LABELS[char]}"
								onclick={() => applyPointBuyDelta(char, -5)}
								disabled={v <= POINT_BUY_MIN || allocationLocked}
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/5 text-xl font-bold text-[var(--color-destructive)] transition-colors hover:bg-[var(--color-destructive)]/15 disabled:opacity-25"
							>−</button>
							<input
								type="number"
								use:preventNumberWheel
								min={POINT_BUY_MIN}
								max={POINT_BUY_MAX}
								value={v}
								disabled={allocationLocked}
								oninput={(e) => setPointBuyValue(char, parseInt((e.currentTarget as HTMLInputElement).value) || 0)}
								onblur={(e) => setPointBuyValueOnBlur(char, parseInt((e.currentTarget as HTMLInputElement).value) || 0)}
								class="w-14 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-1 py-0.5 text-center text-2xl font-bold leading-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50"
							/>
							<button
								type="button"
								aria-label="Increase {CHARACTERISTIC_LABELS[char]}"
								onclick={() => applyPointBuyDelta(char, 5)}
								disabled={v >= POINT_BUY_MAX || allocationLocked}
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 text-xl font-bold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/15 disabled:opacity-25"
							>+</button>
						</div>
					</div>
				{/each}
			</div>

			{#if intSizSoftWarn}
				<p class="text-xs text-[var(--color-muted-foreground)]">
					INT and SIZ below {POINT_BUY_RECOMMENDED_MIN_INT_SIZ} is allowed but the rulebook recommends {POINT_BUY_RECOMMENDED_MIN_INT_SIZ}+ unless the Keeper agrees otherwise.
				</p>
			{/if}

			<div class="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-[var(--color-border)]/60 pt-3">
				<p class="text-xs text-[var(--color-muted-foreground)]">
					{#if allocationConfirmed}
						Allocation confirmed. Age modifiers, EDU improvement, and Luck have been applied below.
					{:else if pbStatus.valid}
						All {POINT_BUY_TOTAL} points allocated. Confirm to apply age modifiers and roll Luck / EDU improvement.
					{:else if pbStatus.remaining > 0}
						{pbStatus.remaining} point{pbStatus.remaining === 1 ? '' : 's'} left to allocate.
					{:else if pbStatus.remaining < 0}
						{Math.abs(pbStatus.remaining)} point{Math.abs(pbStatus.remaining) === 1 ? '' : 's'} over budget.
					{/if}
				</p>
				<button
					type="button"
					onclick={confirmAllocation}
					disabled={!pbStatus.valid || allocationConfirmed || diceRolling}
					class="justify-self-end rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{allocationConfirmed ? 'Allocation Confirmed' : 'Confirm Allocation'}
				</button>
			</div>
		</section>
	{/if}

	<!-- QUICK FIRE PANEL -->
	{#if method === 'quick-fire'}
		<section class="space-y-4 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<header class="flex flex-wrap items-baseline justify-between gap-3">
				<div>
					<h2 class="font-semibold" data-heading>Quick Fire</h2>
					<p class="text-xs text-[var(--color-muted-foreground)]">
						Assign each value once: <span class="font-semibold text-[var(--color-foreground)]">{QUICK_FIRE_VALUES.join(', ')}</span>.
					</p>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<button
						type="button"
						onclick={autoAssignQuickFire}
						disabled={allocationLocked}
						class="text-xs text-[var(--color-primary)] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
					>
						Auto-assign
					</button>
					<button
						type="button"
						onclick={clearQuickFire}
						disabled={allocationLocked}
						class="text-xs text-[var(--color-muted-foreground)] underline-offset-2 hover:text-[var(--color-foreground)] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
					>
						Clear all
					</button>
				</div>
			</header>

			<!-- Pool chips -->
			<div class="flex flex-wrap gap-2 border-y border-[var(--color-border)]/60 py-2">
				{#each QF_OPTIONS as poolValue}
					{@const remaining = qfCounts.get(poolValue) ?? 0}
					<span
						class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums {remaining > 0
							? 'border-[var(--color-primary)] text-[var(--color-foreground)]'
							: 'border-[var(--color-border)] text-[var(--color-muted-foreground)] line-through opacity-60'}"
					>
						<span class="font-semibold">{poolValue}</span>
						<span class="text-[10px]">×{remaining > 0 ? remaining : 0}</span>
					</span>
				{/each}
				<span class="ml-auto text-xs {quickFireValid ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]'}">
					{quickFireValid ? 'Pool fully assigned' : 'Assign each value once'}
				</span>
			</div>

			<div class="grid gap-2 sm:grid-cols-2">
				{#each ALL_CHARACTERISTICS as char, i (char)}
					{@const v = baseValues[char]}
					{@const final = values[char]}
					<div in:inkBleed|global={{ delay: i * 40 }} class="flex items-center justify-between gap-3 rounded border border-[var(--color-border)]/50 bg-[var(--color-background)]/40 px-3 py-2">
						<div class="flex flex-col">
							<span class="text-sm font-medium">{CHARACTERISTIC_LABELS[char]} <span class="text-xs uppercase text-[var(--color-muted-foreground)]">({char})</span></span>
							{#if v > 0 && final !== v}
								<span class="text-[10px] text-[var(--color-muted-foreground)]">→ {final} after age</span>
							{/if}
						</div>
						<select
							value={v || ''}
							onchange={(e) => applyQuickFirePick(char, parseInt((e.currentTarget as HTMLSelectElement).value) || 0)}
							aria-label="Assign Quick Fire value to {CHARACTERISTIC_LABELS[char]}"
							disabled={allocationLocked}
							class="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-2xl font-bold leading-none tabular-nums disabled:cursor-not-allowed disabled:opacity-50"
						>
							<option value="">—</option>
							{#each QF_OPTIONS as poolValue}
								{@const remaining = qfCounts.get(poolValue) ?? 0}
								{@const isCurrent = v === poolValue}
								{#if isCurrent || remaining > 0}
									<option value={poolValue}>{poolValue}</option>
								{/if}
							{/each}
						</select>
					</div>
				{/each}
			</div>

			<div class="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-[var(--color-border)]/60 pt-3">
				<p class="text-xs text-[var(--color-muted-foreground)]">
					{#if allocationConfirmed}
						Allocation confirmed. Age modifiers, EDU improvement, and Luck have been applied below.
					{:else if quickFireValid}
						All values assigned. Confirm to apply age modifiers and roll Luck / EDU improvement.
					{:else}
						Allocate each pool value before confirming.
					{/if}
				</p>
				<button
					type="button"
					onclick={confirmAllocation}
					disabled={!quickFireValid || allocationConfirmed || diceRolling}
					class="justify-self-end rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{allocationConfirmed ? 'Allocation Confirmed' : 'Confirm Allocation'}
				</button>
			</div>
		</section>
	{/if}

	<!-- ROLL PANEL -->
	{#if method === 'roll'}
		<section class="space-y-4 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<header class="flex flex-wrap items-baseline justify-between gap-3">
				<div>
					<h2 class="font-semibold" data-heading>Roll</h2>
					<p class="text-xs text-[var(--color-muted-foreground)]">
						Roll dice for each characteristic. <span class="font-medium">3D6×5</span> for STR / CON / DEX / APP / POW,
						<span class="font-medium">(2D6+6)×5</span> for SIZ / INT / EDU.
					</p>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onclick={rollAllStats}
						disabled={diceRolling}
						class="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:opacity-50"
					>
						{diceRolling ? 'Rolling…' : hasValues ? 'Reroll All' : 'Roll All'}
					</button>
					{#if nextStatToRoll && !diceRolling}
						<button
							type="button"
							onclick={rollNextStat}
							class="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-accent)]"
						>
							Roll Next: {CHARACTERISTIC_LABELS[nextStatToRoll]}
						</button>
					{/if}
					{#if hasValues}
						<button
							type="button"
							onclick={clearRolls}
							class="text-xs text-[var(--color-muted-foreground)] underline-offset-2 hover:text-[var(--color-foreground)] hover:underline"
						>
							Clear
						</button>
					{/if}
				</div>
			</header>

			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted-foreground)]">
							<th class="pb-2 pr-4">Characteristic</th>
							<th class="pb-2 pr-4 text-center">Value</th>
							<th class="pb-2 pr-4 text-center">Dice</th>
							<th class="pb-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each ALL_CHARACTERISTICS as char (char)}
							{@const v = baseValues[char]}
							<tr class="border-b border-[var(--color-border)]/50">
								<td class="py-2 pr-4 font-medium">
									{CHARACTERISTIC_LABELS[char]}
									<span class="ml-1 text-xs text-[var(--color-muted-foreground)] uppercase">({char})</span>
								</td>
								<td class="py-2 pr-4 text-center">
									<span class="text-2xl font-bold leading-none tabular-nums {v > 0 ? '' : 'text-[var(--color-muted-foreground)]'}">{v > 0 ? v : '—'}</span>
								</td>
								<td class="whitespace-nowrap py-2 pr-4 text-center font-mono text-xs text-[var(--color-muted-foreground)] tabular-nums">
									{rolls?.[char]?.join(', ') ?? '—'}
								</td>
								<td class="py-2 text-right">
									<button
										type="button"
										onclick={() => rerollSingleStat(char)}
										disabled={diceRolling}
										class="text-xs text-[var(--color-primary)] underline-offset-2 hover:underline disabled:opacity-50"
									>
										Reroll
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	{#if hasValues && (!methodNeedsConfirmation || allocationConfirmed)}
		<!-- Compact characteristics summary table (read-only) -->
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted-foreground)]">
						<th class="pb-2 pr-4">Characteristic</th>
						<th class="pb-2 pr-4 text-center">Value</th>
						<th class="pb-2 pr-4 text-center">Half</th>
						<th class="pb-2 pr-4 text-center">Fifth</th>
					</tr>
				</thead>
				<tbody>
					{#each ALL_CHARACTERISTICS as char, i (char)}
						{@const v = values[char]}
						<tr in:inkBleed|global={{ delay: i * 50 }} class="border-b border-[var(--color-border)]/50">
							<td class="py-2 pr-4 font-medium">
								{CHARACTERISTIC_LABELS[char]}
								<span class="ml-1 text-xs text-[var(--color-muted-foreground)] uppercase">({char})</span>
							</td>
							<td class="py-2 pr-4 text-center tabular-nums">
								{baseValues[char]}{#if values[char] !== baseValues[char]}<span class="ml-1 text-xs text-[var(--color-muted-foreground)]">→ {values[char]}</span>{/if}
							</td>
							<td class="py-2 pr-4 text-center text-[var(--color-muted-foreground)] tabular-nums">{v ? halfValue(v) : '—'}</td>
							<td class="py-2 pr-4 text-center text-[var(--color-muted-foreground)] tabular-nums">{v ? fifthValue(v) : '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<label for="age" class="mb-1 block text-sm font-medium">Age</label>
			<input
				id="age"
				type="number"
				use:preventNumberWheel
				min="15"
				max="89"
				bind:value={age}
				disabled={allocationLocked}
				oninput={() => void handleAgeChanged()}
				class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm disabled:opacity-50"
			/>
			<p class="mt-2 text-xs text-[var(--color-muted-foreground)]">
				Age can reduce physical characteristics, adjust appearance or education, and trigger
				EDU improvement checks.
			</p>
		</div>

		{#if requiredDeduction > 0 || requiredEduChecks > 0}
			<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
				<h2 class="mb-2 font-semibold" data-heading>Age Adjustments</h2>
				{#if requiredDeduction > 0}
					<p class="mb-2 text-xs text-[var(--color-muted-foreground)]">
						Apply {requiredDeduction} age-deduction point{requiredDeduction === 1 ? '' : 's'} among {deductionTargets.map((target) => target.toUpperCase()).join(', ')}.
						Used: {deductionTotal}/{requiredDeduction}
					</p>
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{#each deductionTargets as target}
							<label class="flex items-center gap-2 text-sm">
								<span class="uppercase">{target}</span>
								<input
									type="number"
									use:preventNumberWheel
									min="0"
									value={physicalDeductions[target] ?? 0}
									oninput={(e) => { physicalDeductions[target] = parseInt((e.currentTarget as HTMLInputElement).value) || 0; physicalDeductions = { ...physicalDeductions }; }}
									class="w-16 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-1.5 py-0.5 text-center"
								/>
							</label>
						{/each}
					</div>
				{/if}

				{#if requiredEduChecks > 0}
					<div class="mt-3">
						<div class="flex items-baseline justify-between">
							<p class="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
								EDU Improvement {requiredEduChecks === 1 ? 'Check' : 'Checks'}
							</p>
							{#if eduChecks.length > 0 && eduChecks.length === requiredEduChecks}
								<p class="text-xs text-[var(--color-muted-foreground)]">
									{eduBaseForChecks} → <span class="font-semibold text-[var(--color-foreground)]">{eduChecks[eduChecks.length - 1].resultingEdu}</span>
								</p>
							{/if}
						</div>
						{#if eduChecks.length > 0}
							<ul class="mt-1 space-y-0.5 text-xs text-[var(--color-muted-foreground)]">
								{#each eduChecks as check, i}
									<li class="flex items-center justify-between gap-3 border-b border-[var(--color-border)]/30 py-1 last:border-b-0">
										<span>
											<span class="font-medium text-[var(--color-foreground)]">{i + 1}.</span>
											rolled <span class="tabular-nums">{check.roll}</span>
										</span>
										<span class="tabular-nums {check.success ? 'text-[var(--color-foreground)]' : ''}">
											{check.success ? `+${check.improvement} EDU` : 'no improvement'}
										</span>
									</li>
								{/each}
							</ul>
						{:else if diceRolling || autoRolling}
							<p class="mt-1 text-xs text-[var(--color-muted-foreground)]">Rolling…</p>
						{/if}
					</div>
				{/if}

				{#if ageResult.errors.length > 0}
					<ul class="mt-2 space-y-1 text-xs text-[var(--color-warning)]">
						{#each ageResult.errors as error}
							<li>{error}</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}

		<!-- Luck -->
		<div in:dossierFiling|global={{ delay: 540 }} class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="font-semibold" data-heading>Luck</h2>
					<p class="text-xs text-[var(--color-muted-foreground)]">Roll 3D6 &times; 5</p>
				</div>
				<div class="flex items-center gap-4">
					{#if luck.max > 0}
						<span class="text-2xl font-bold">{luck.max}</span>
						<span class="text-sm text-[var(--color-muted-foreground)]">
							({luck.rollSets ? luck.rollSets.map((set) => set.join(', ')).join(' / ') : luck.rolls?.join(', ')})
						</span>
					{/if}
					<button
						type="button"
						onclick={() => rollLuckDice()}
						disabled={diceRolling}
						class="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium
							text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:opacity-50"
					>
						{diceRolling ? 'Rolling...' : age >= 15 && age <= 19 ? 'Roll Luck Twice' : luck.max > 0 ? 'Reroll Luck' : 'Roll Luck'}
					</button>
				</div>
			</div>
		</div>

		<!-- Derived Stats summary -->
		<div in:dossierFiling|global={{ delay: 620 }} class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<h2 class="mb-3 font-semibold" data-heading>Derived Attributes</h2>
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<div>
					<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Hit Points</span>
					<p class="text-xl font-bold">{hp}</p>
				</div>
				<div>
					<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Magic Points</span>
					<p class="text-xl font-bold">{mp}</p>
				</div>
				<div>
					<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Sanity</span>
					<p class="text-xl font-bold">{sanity}</p>
				</div>
				<div>
					<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Move Rate</span>
					<p class="text-xl font-bold">{moveRate}</p>
				</div>
				<div>
					<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Damage Bonus</span>
					<p class="text-xl font-bold">{dbBuild.damageBonus}</p>
				</div>
				<div>
					<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Build</span>
					<p class="text-xl font-bold">{dbBuild.build}</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Navigation -->
	<div class="flex justify-end pt-4">
		{#if hasValues && !methodValid}
			<p id="char-proceed-warning" class="mr-3 self-center text-sm text-[var(--color-warning)]">
				{#if method === 'point-buy'}
					{#if !pbStatus.allInRange}All values must be {POINT_BUY_MIN}–{POINT_BUY_MAX}.
					{:else}Distribute exactly {POINT_BUY_TOTAL} points (currently {pbStatus.total}).{/if}
				{:else if method === 'quick-fire'}
					Each Quick Fire value must be used exactly once.
				{:else}
					Some rolled values are out of range — reroll the offending stat.
				{/if}
			</p>
		{:else if !canProceed}
			<p id="char-proceed-hint" class="mr-3 self-center text-sm text-[var(--color-muted-foreground)]">
				{#if !hasValues}Assign all characteristic values.
				{:else if awaitingAllocationConfirm}Confirm your characteristic allocation to continue.
				{:else if luck.max <= 0}Roll Luck before continuing.
				{:else if ageResult.errors.length > 0}Resolve age modifier errors.
				{:else if mode !== 'standard'}Lock in characteristic mode.
				{:else}Complete remaining characteristic steps.{/if}
			</p>
		{/if}
		<button
			type="button"
			onclick={proceed}
			disabled={!canProceed || diceRolling}
			aria-describedby={!canProceed
				? (hasValues && !methodValid ? 'char-proceed-warning' : 'char-proceed-hint')
				: undefined}
			class="rounded-md bg-[var(--color-primary)] px-6 py-2 text-sm font-medium
				text-[var(--color-primary-foreground)] transition-colors
				hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Next: Choose Occupation &rarr;
		</button>
	</div>
</div>
