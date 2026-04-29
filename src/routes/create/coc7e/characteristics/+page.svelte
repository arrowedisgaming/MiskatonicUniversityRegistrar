<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import { ALL_CHARACTERISTICS, CHARACTERISTIC_LABELS, ROLL_3D6, ROLL_2D6_PLUS_6 } from '$lib/types/common';
	import type { CharacteristicId, Era, Mode } from '$lib/types/common';
	import {
		rollAllCharacteristics,
		rollResultsToValues,
		rollResultsToRolls,
		halfValue,
		fifthValue
	} from '$lib/engine/characteristics';
	import { calculateHP, calculateMP, calculateStartingSanity, calculateDamageBonusAndBuild, calculateMoveRate, getAgeModifier } from '$lib/engine/derived-stats';
	import { roll3d6x5, roll2d6plus6x5, rollLuck } from '$lib/engine/dice';
	import {
		applyAgeAdjustments,
		physicalDeductionTargets,
		requiredPhysicalDeduction,
		rollEduImprovementCheck,
		makeYouthLuckAdjustment,
		type PhysicalDeductions
	} from '$lib/engine/age-adjustments';
	import type { CharacteristicMethodId } from '$lib/types/content-pack';
	import type { EduImprovementCheck, LuckAdjustment } from '$lib/types/character';

	const data = page.data as {
		contentPack: import('$lib/types/content-pack').CoCContentPack;
	};

	// Local state for this step
	let era = $state<Era>($wizard.character.era);
	let mode = $state<Mode>($wizard.character.mode);
	let age = $state($wizard.character.age);
	let method = $state<CharacteristicMethodId>($wizard.character.characteristics.method);
	let baseValues = $state<Record<CharacteristicId, number>>({ ...$wizard.character.characteristics.baseValues });
	let rolls = $state<Record<CharacteristicId, number[]> | null>($wizard.character.characteristics.rolls);
	let physicalDeductions = $state<PhysicalDeductions>({});
	let eduChecks = $state<EduImprovementCheck[]>([...($wizard.character.characteristics.eduImprovementChecks ?? [])]);
	let luckAdjustment = $state<LuckAdjustment | null>($wizard.character.characteristics.luckAdjustment ?? null);
	let luck = $state<{ max: number; current: number; rolls: number[] | null; rollSets?: number[][] | null; reason?: string | null }>({ ...$wizard.character.derivedStats.luck });

	const quickFireValues = [40, 50, 50, 50, 60, 60, 70, 80];
	const methodOptions = data.contentPack.characteristicMethods;

	let ageModifier = $derived(getAgeModifier(age, data.contentPack.ageModifiers));
	let ageResult = $derived(applyAgeAdjustments(baseValues, age, data.contentPack.ageModifiers, physicalDeductions, eduChecks, luckAdjustment));
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

	let pointBuyTotal = $derived(Object.values(baseValues).reduce((sum, value) => sum + value, 0));
	let pointBuyValid = $derived(method !== 'point-buy' || pointBuyTotal === 460);
	let quickFireValid = $derived(method !== 'quick-fire' || JSON.stringify(Object.values(baseValues).sort((a, b) => a - b)) === JSON.stringify(quickFireValues));
	let canProceed = $derived(hasValues && luck.max > 0 && ageResult.errors.length === 0 && pointBuyValid && quickFireValid && mode === 'standard');

	function resetAgeState() {
		physicalDeductions = {};
		eduChecks = [];
		luckAdjustment = null;
		if (age >= 15 && age <= 19) {
			luck = { max: 0, current: 0, rolls: null, rollSets: null, reason: null };
		}
	}

	function rollAll() {
		method = 'roll';
		const results = rollAllCharacteristics();
		baseValues = rollResultsToValues(results);
		rolls = rollResultsToRolls(results);
		resetAgeState();
	}

	function rerollSingle(char: CharacteristicId) {
		const is3d6 = ROLL_3D6.includes(char);
		const result = is3d6 ? roll3d6x5() : roll2d6plus6x5();
		baseValues[char] = result.total;
		baseValues = { ...baseValues };
		if (rolls) rolls[char] = result.rolls;
		resetAgeState();
	}

	function setBaseValue(char: CharacteristicId, value: number) {
		baseValues[char] = Math.max(0, Math.min(99, value || 0));
		baseValues = { ...baseValues };
		resetAgeState();
	}

	function setMethod(nextMethod: CharacteristicMethodId) {
		method = nextMethod;
		rolls = null;
		if (nextMethod === 'quick-fire') {
			baseValues = { str: 40, con: 50, dex: 50, int: 50, pow: 60, app: 60, siz: 70, edu: 80 };
		} else if (nextMethod === 'point-buy') {
			baseValues = { str: 50, con: 50, dex: 50, int: 60, pow: 50, app: 50, siz: 60, edu: 90 };
		} else if (nextMethod === 'arrange-rolls' || nextMethod === 'low-roll-modifier' || nextMethod === 'human-potential') {
			const results = rollAllCharacteristics();
			baseValues = rollResultsToValues(results);
			rolls = rollResultsToRolls(results);
		}
		resetAgeState();
	}

	function rollLuckDice() {
		if (age >= 15 && age <= 19) {
			const first = rollLuck();
			const second = rollLuck();
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
		luckAdjustment = null;
		luck = { max: result.total, current: result.total, rolls: result.rolls, rollSets: null, reason: null };
	}

	function rollNextEduCheck() {
		if (eduChecks.length >= requiredEduChecks) return;
		const currentEdu = eduChecks.length === 0
			? values.edu
			: eduChecks[eduChecks.length - 1].resultingEdu;
		eduChecks = [...eduChecks, rollEduImprovementCheck(currentEdu)];
	}

	function clearEduChecks() {
		eduChecks = [];
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
				rolls,
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
		goto(WIZARD_STEPS[1].path);
	}
</script>

<div class="space-y-8">
	<div>
		<h2 class="text-2xl font-bold" data-heading>Characteristics</h2>
		<p class="mt-1 text-sm text-[var(--color-muted-foreground)]">
			Choose an era, age, and generation method. Age adjustments are applied before occupation
			and skills are calculated.
		</p>
	</div>

	<div class="grid gap-4 md:grid-cols-3">
		<div>
			<label for="era" class="mb-1 block text-sm font-medium">Era</label>
			<select id="era" bind:value={era}
				class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm">
				{#each data.contentPack.eras as eraOption}
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
		<div>
			<label for="age" class="mb-1 block text-sm font-medium">Age</label>
			<input id="age" type="number" min="15" max="89" bind:value={age} oninput={resetAgeState}
				class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm" />
		</div>
	</div>

	<div>
		<label for="method" class="mb-1 block text-sm font-medium">Generation Method</label>
		<div class="flex flex-wrap items-center gap-2">
			<select id="method" value={method} onchange={(e) => setMethod((e.currentTarget as HTMLSelectElement).value as CharacteristicMethodId)}
				class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm">
				{#each methodOptions as option}
					<option value={option.id}>{option.name}</option>
				{/each}
			</select>
			<button onclick={rollAll}
				class="rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90">
				{hasValues ? 'Reroll Standard Dice' : 'Roll Dice'}
			</button>
		</div>
		{#if method === 'point-buy'}
			<p class="mt-1 text-xs text-[var(--color-muted-foreground)]">Point buy total: {pointBuyTotal}/460.</p>
		{/if}
		{#if method === 'quick-fire'}
			<p class="mt-1 text-xs text-[var(--color-muted-foreground)]">Use each value once: 40, 50, 50, 50, 60, 60, 70, 80.</p>
		{/if}
		{#if method === 'low-roll-modifier' || method === 'human-potential' || method === 'arrange-rolls'}
			<p class="mt-1 text-xs text-[var(--color-muted-foreground)]">Use the editable values below to place or apply the optional method results agreed with the Keeper.</p>
		{/if}
	</div>

	{#if hasValues}
		<!-- Characteristics table -->
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted-foreground)]">
						<th class="pb-2 pr-4">Characteristic</th>
						<th class="pb-2 pr-4 text-center">Value</th>
						<th class="pb-2 pr-4 text-center">Half</th>
						<th class="pb-2 pr-4 text-center">Fifth</th>
												<th class="pb-2 text-center">Dice</th>
						<th class="pb-2"></th>
					</tr>
				</thead>
				<tbody>
					{#each ALL_CHARACTERISTICS as char}
						{@const v = values[char]}
						<tr class="border-b border-[var(--color-border)]/50">
							<td class="py-2 pr-4 font-medium">
								{CHARACTERISTIC_LABELS[char]}
								<span class="ml-1 text-xs text-[var(--color-muted-foreground)] uppercase">({char})</span>
							</td>
							<td class="py-2 pr-4 text-center">
								<input
									type="number"
									min="0"
									max="99"
									value={baseValues[char]}
									oninput={(e) => setBaseValue(char, parseInt((e.currentTarget as HTMLInputElement).value) || 0)}
									class="w-16 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-1.5 py-0.5 text-center text-sm"
								/>
								{#if values[char] !== baseValues[char]}
									<span class="ml-1 text-xs text-[var(--color-muted-foreground)]">→ {values[char]}</span>
								{/if}
							</td>
							<td class="py-2 pr-4 text-center text-[var(--color-muted-foreground)]">{v ? halfValue(v) : '—'}</td>
							<td class="py-2 pr-4 text-center text-[var(--color-muted-foreground)]">{v ? fifthValue(v) : '—'}</td>
							<td class="py-2 pr-4 text-center font-mono text-xs text-[var(--color-muted-foreground)]">
								{rolls?.[char]?.join(', ') ?? '—'}
							</td>
							<td class="py-2">
								<button
									onclick={() => rerollSingle(char)}
									class="text-xs text-[var(--color-primary)] hover:underline"
									disabled={!hasValues}
								>
									Reroll
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if requiredDeduction > 0 || requiredEduChecks > 0}
			<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
				<h3 class="mb-2 font-semibold" data-heading>Age Adjustments</h3>
				{#if requiredDeduction > 0}
					<p class="mb-2 text-xs text-[var(--color-muted-foreground)]">
						Distribute {requiredDeduction} point{requiredDeduction === 1 ? '' : 's'} among {deductionTargets.map((target) => target.toUpperCase()).join(', ')}.
						Used: {deductionTotal}/{requiredDeduction}
					</p>
					<div class="flex flex-wrap gap-3">
						{#each deductionTargets as target}
							<label class="text-sm">
								<span class="mr-1 uppercase">{target}</span>
								<input
									type="number"
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
						<div class="flex items-center gap-2">
							<button onclick={rollNextEduCheck} disabled={eduChecks.length >= requiredEduChecks}
								class="rounded-md bg-[var(--color-secondary)] px-3 py-1.5 text-sm font-medium text-[var(--color-secondary-foreground)] disabled:opacity-50">
								Roll EDU Check
							</button>
							<button onclick={clearEduChecks} class="text-xs text-[var(--color-muted-foreground)] hover:underline">Clear</button>
							<span class="text-xs text-[var(--color-muted-foreground)]">{eduChecks.length}/{requiredEduChecks}</span>
						</div>
						{#if eduChecks.length > 0}
							<ul class="mt-2 space-y-1 text-xs text-[var(--color-muted-foreground)]">
								{#each eduChecks as check, i}
									<li>Check {i + 1}: rolled {check.roll}; {check.success ? `+${check.improvement} EDU` : 'no improvement'}.</li>
								{/each}
							</ul>
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
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="font-semibold" data-heading>Luck</h3>
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
						onclick={rollLuckDice}
						class="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium
							text-[var(--color-primary-foreground)] transition-colors hover:opacity-90"
					>
						{age >= 15 && age <= 19 ? 'Roll Luck Twice' : luck.max > 0 ? 'Reroll' : 'Roll Luck'}
					</button>
				</div>
			</div>
		</div>

		<!-- Derived Stats summary -->
		{#if hasValues}
			<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
				<h3 class="mb-3 font-semibold" data-heading>Derived Attributes</h3>
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
	{/if}

	<!-- Navigation -->
	<div class="flex justify-end pt-4">
		{#if hasValues && (!pointBuyValid || !quickFireValid)}
			<p class="mr-3 self-center text-sm text-[var(--color-warning)]">Generation method constraints are not satisfied.</p>
		{/if}
		<button
			onclick={proceed}
			disabled={!canProceed}
			class="rounded-md bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium
				text-[var(--color-primary-foreground)] transition-colors
				hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Next: Choose Occupation &rarr;
		</button>
	</div>
</div>
