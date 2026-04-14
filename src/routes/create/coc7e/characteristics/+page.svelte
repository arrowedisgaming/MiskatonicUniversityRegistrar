<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import { ALL_CHARACTERISTICS, CHARACTERISTIC_LABELS, ROLL_3D6, ROLL_2D6_PLUS_6 } from '$lib/types/common';
	import type { CharacteristicId } from '$lib/types/common';
	import {
		rollAllCharacteristics,
		rollResultsToValues,
		rollResultsToRolls,
		halfValue,
		fifthValue
	} from '$lib/engine/characteristics';
	import { calculateHP, calculateMP, calculateStartingSanity, calculateDamageBonusAndBuild, calculateMoveRate, getAgeModifier } from '$lib/engine/derived-stats';
	import { roll3d6x5, roll2d6plus6x5, rollLuck } from '$lib/engine/dice';


	const data = page.data as {
		contentPack: import('$lib/types/content-pack').CoCContentPack;
	};

	// Local state for this step
	let method = $state<'roll' | 'quick-fire'>($wizard.character.characteristics.method || 'roll');
	let values = $state<Record<CharacteristicId, number>>({ ...$wizard.character.characteristics.values });
	let rolls = $state<Record<CharacteristicId, number[]> | null>($wizard.character.characteristics.rolls);
	let luck = $state<{ max: number; current: number; rolls: number[] | null }>({ ...$wizard.character.derivedStats.luck });
	let hasValues = $derived(Object.values(values).every((v) => v > 0));

	// Quick-fire state
	let selectedArrayIndex = $state<number | null>(null);
	let assignedChars = $state<Record<number, CharacteristicId>>({});

	// Derived stats (auto-calculated)
	let hp = $derived(hasValues ? calculateHP(values.con, values.siz) : 0);
	let mp = $derived(hasValues ? calculateMP(values.pow) : 0);
	let sanity = $derived(hasValues ? calculateStartingSanity(values.pow) : 0);
	let dbBuild = $derived(hasValues
		? calculateDamageBonusAndBuild(values.str, values.siz, data.contentPack.damageBonusBuildTable)
		: { damageBonus: '-', build: 0 }
	);
	let moveRate = $derived(hasValues
		? calculateMoveRate(values.str, values.dex, values.siz, null) // Age not yet known; recalculated in backstory step
		: 0
	);

	let canProceed = $derived(hasValues && luck.max > 0);

	function rollAll() {
		const results = rollAllCharacteristics();
		values = rollResultsToValues(results);
		rolls = rollResultsToRolls(results);
		method = 'roll';
	}

	function rerollSingle(char: CharacteristicId) {
		const is3d6 = ROLL_3D6.includes(char);
		const result = is3d6 ? roll3d6x5() : roll2d6plus6x5();
		values[char] = result.total;
		if (rolls) rolls[char] = result.rolls;
	}

	function rollLuckDice() {
		const result = rollLuck();
		luck = { max: result.total, current: result.total, rolls: result.rolls };
	}

	function selectQuickFireArray(index: number) {
		selectedArrayIndex = index;
		assignedChars = {};
		// Reset values until assignment
		values = { str: 0, con: 0, dex: 0, int: 0, pow: 0, app: 0, siz: 0, edu: 0 };
		rolls = null;
		method = 'quick-fire';
	}

	function assignQuickFireValue(arrayValue: number, valueIndex: number, char: CharacteristicId) {
		// Remove previous assignment of this value
		for (const [key, val] of Object.entries(assignedChars)) {
			if (val === char) delete assignedChars[Number(key)];
		}
		assignedChars[valueIndex] = char;
		assignedChars = { ...assignedChars }; // trigger reactivity

		// Update values from assignments
		const array = data.contentPack.quickFireArrays[selectedArrayIndex!];
		const newValues = { str: 0, con: 0, dex: 0, int: 0, pow: 0, app: 0, siz: 0, edu: 0 } as Record<CharacteristicId, number>;
		for (const [idx, assignedChar] of Object.entries(assignedChars)) {
			newValues[assignedChar] = array[Number(idx)];
		}
		values = newValues;
	}

	function proceed() {
		wizard.updateCharacter((c) => ({
			...c,
			characteristics: {
				method,
				values: { ...values },
				baseValues: { ...values },
				rolls,
				ageAdjustments: []
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
			}
		}));
		wizard.completeStep(0);
		goto(WIZARD_STEPS[1].path);
	}
</script>

<div class="space-y-8">
	<div>
		<h2 class="text-2xl font-bold" data-heading>Characteristics</h2>
		<p class="mt-1 text-sm text-[var(--color-muted-foreground)]">
			Generate your investigator's eight characteristics. These define physical and mental
			capabilities.
		</p>
	</div>

	<!-- Method selection -->
	<div class="flex gap-3">
		<button
			onclick={rollAll}
			class="rounded-md border px-4 py-2 text-sm font-medium transition-colors
				{method === 'roll'
					? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
					: 'border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-accent)]'}"
		>
			Roll Dice
		</button>
		<button
			onclick={() => { method = 'quick-fire'; values = { str: 0, con: 0, dex: 0, int: 0, pow: 0, app: 0, siz: 0, edu: 0 }; selectedArrayIndex = null; rolls = null; }}
			class="rounded-md border px-4 py-2 text-sm font-medium transition-colors
				{method === 'quick-fire'
					? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
					: 'border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-accent)]'}"
		>
			Quick-Fire Arrays
		</button>
	</div>

	{#if method === 'quick-fire' && !hasValues}
		<!-- Quick-fire array selection -->
		<div class="space-y-4">
			<p class="text-sm text-[var(--color-muted-foreground)]">
				Choose an array, then assign each value to a characteristic.
			</p>
			{#each data.contentPack.quickFireArrays as array, i}
				<button
					onclick={() => selectQuickFireArray(i)}
					class="block w-full rounded-md border p-3 text-left transition-colors
						{selectedArrayIndex === i
							? 'border-[var(--color-primary)] bg-[var(--color-accent)]'
							: 'border-[var(--color-border)] hover:bg-[var(--color-accent)]'}"
				>
					<span class="font-mono text-sm">{array.join(' / ')}</span>
				</button>
			{/each}

			{#if selectedArrayIndex !== null}
				<div class="space-y-2">
					<h3 class="text-sm font-semibold">Assign Values to Characteristics</h3>
					{#each data.contentPack.quickFireArrays[selectedArrayIndex] as value, vi}
						<div class="flex items-center gap-3">
							<span class="w-10 text-right font-mono font-bold">{value}</span>
							<span class="text-[var(--color-muted-foreground)]">&rarr;</span>
							<select
								class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm"
								value={assignedChars[vi] ?? ''}
								onchange={(e) => {
									const target = e.currentTarget as HTMLSelectElement;
									if (target.value) assignQuickFireValue(value, vi, target.value as CharacteristicId);
								}}
							>
								<option value="">— Select —</option>
								{#each ALL_CHARACTERISTICS as char}
									{@const alreadyAssigned = Object.entries(assignedChars).some(
										([idx, c]) => c === char && Number(idx) !== vi
									)}
									<option value={char} disabled={alreadyAssigned}>
										{CHARACTERISTIC_LABELS[char]}
									</option>
								{/each}
							</select>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if hasValues || method === 'roll'}
		<!-- Characteristics table -->
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted-foreground)]">
						<th class="pb-2 pr-4">Characteristic</th>
						<th class="pb-2 pr-4 text-center">Value</th>
						<th class="pb-2 pr-4 text-center">Half</th>
						<th class="pb-2 pr-4 text-center">Fifth</th>
						{#if method === 'roll'}
							<th class="pb-2 text-center">Dice</th>
							<th class="pb-2"></th>
						{/if}
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
							<td class="py-2 pr-4 text-center font-bold text-lg">{v || '—'}</td>
							<td class="py-2 pr-4 text-center text-[var(--color-muted-foreground)]">{v ? halfValue(v) : '—'}</td>
							<td class="py-2 pr-4 text-center text-[var(--color-muted-foreground)]">{v ? fifthValue(v) : '—'}</td>
							{#if method === 'roll'}
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
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

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
							({luck.rolls?.join(', ')})
						</span>
					{/if}
					<button
						onclick={rollLuckDice}
						class="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium
							text-[var(--color-primary-foreground)] transition-colors hover:opacity-90"
					>
						{luck.max > 0 ? 'Reroll' : 'Roll Luck'}
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
