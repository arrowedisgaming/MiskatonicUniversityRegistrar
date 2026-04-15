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
	let values = $state<Record<CharacteristicId, number>>({ ...$wizard.character.characteristics.values });
	let rolls = $state<Record<CharacteristicId, number[]> | null>($wizard.character.characteristics.rolls);
	let luck = $state<{ max: number; current: number; rolls: number[] | null }>({ ...$wizard.character.derivedStats.luck });
	let hasValues = $derived(Object.values(values).every((v) => v > 0));

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

	function proceed() {
		wizard.updateCharacter((c) => ({
			...c,
			characteristics: {
				method: 'roll',
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

	<!-- Roll button -->
	<button
		onclick={rollAll}
		class="rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)]
			px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90"
	>
		{hasValues ? 'Reroll All' : 'Roll Dice'}
	</button>

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
							<td class="py-2 pr-4 text-center font-bold text-lg">{v || '—'}</td>
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
