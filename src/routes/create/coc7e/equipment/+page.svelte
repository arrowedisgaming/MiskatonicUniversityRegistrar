<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { wizard, WIZARD_STEPS } from '$lib/stores/wizard';
	import { calculateStartingWealth } from '$lib/engine/finances';
	import type { CoCContentPack, CoCEquipmentPack } from '$lib/types/content-pack';
	import type { EquipmentItem, CharacterWeapon } from '$lib/types/character';

	const data = page.data as {
		contentPack: CoCContentPack;
		equipment: CoCEquipmentPack;
	};

	// Find Credit Rating from skills
	const creditRatingSkill = $wizard.character.skills.find((s) => s.skillId === 'credit-rating');
	const creditRating = creditRatingSkill?.total ?? 0;
	const wealthTable = data.contentPack.wealthTables[$wizard.character.era] ?? data.contentPack.wealthTable ?? [];
	const wealth = calculateStartingWealth(creditRating, wealthTable);

	// Equipment state
	let items = $state<EquipmentItem[]>(
		$wizard.character.equipment.items.length > 0
			? [...$wizard.character.equipment.items]
			: []
	);
	let weapons = $state<CharacterWeapon[]>(
		$wizard.character.equipment.weapons.length > 0
			? [...$wizard.character.equipment.weapons]
			: []
	);
	let newItemName = $state('');

	function addItem(name: string) {
		if (!name.trim()) return;
		items = [...items, { name: name.trim(), quantity: 1, notes: '' }];
		newItemName = '';
	}

	function addCommonItem(name: string) {
		if (items.some((i) => i.name === name)) return;
		items = [...items, { name, quantity: 1, notes: '' }];
	}

	function removeItem(index: number) {
		items = items.filter((_, i) => i !== index);
	}

	function addWeapon(weaponDef: typeof data.equipment.weapons[0]) {
		if (weapons.some((w) => w.name === weaponDef.name)) return;
		weapons = [...weapons, {
			name: weaponDef.name,
			damage: weaponDef.damage,
			range: weaponDef.range,
			attacksPerRound: weaponDef.attacksPerRound,
			ammo: weaponDef.ammo ?? null,
			malfunction: weaponDef.malfunction ?? null
		}];
	}

	function removeWeapon(index: number) {
		weapons = weapons.filter((_, i) => i !== index);
	}

	function proceed() {
		wizard.updateCharacter((c) => ({
			...c,
			equipment: {
				items: [...items],
				weapons: [...weapons],
				cash: wealth.cash,
				assets: wealth.assets,
				assetsLabel: wealth.assetsLabel,
				livingStandard: wealth.livingStandard,
				spendingLevel: wealth.spendingLevel
			}
		}));
		wizard.completeStep(4);
		goto(WIZARD_STEPS[5].path);
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-2xl font-bold" data-heading>Equipment &amp; Finances</h1>
		<p class="mt-1 text-sm text-[var(--color-muted-foreground)]">
			Based on your Credit Rating of {creditRating}, your spending level and starting wealth are calculated below.
		</p>
	</div>

	<!-- Finances summary -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
			<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Living Standard</span>
			<p class="text-lg font-bold">{wealth.livingStandard}</p>
		</div>
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
			<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Cash</span>
			<p class="text-lg font-bold">${wealth.cash.toLocaleString()}</p>
		</div>
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
			<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Spending Level</span>
			<p class="text-lg font-bold">${wealth.spendingLevel.toLocaleString()}</p>
		</div>
		<div class="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-3">
			<span class="text-xs uppercase text-[var(--color-muted-foreground)]">Assets</span>
			<p class="text-lg font-bold">{wealth.assetsLabel}</p>
		</div>
	</div>

	<!-- Weapons -->
	<div class="space-y-3">
		<h2 class="text-lg font-semibold" data-heading>Weapons</h2>

		{#if weapons.length > 0}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted-foreground)]">
							<th class="pb-2 pr-2">Weapon</th>
							<th class="pb-2 pr-2">Damage</th>
							<th class="pb-2 pr-2">Range</th>
							<th class="pb-2 pr-2">Attacks</th>
							<th class="pb-2 pr-2">Ammo</th>
							<th class="pb-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each weapons as weapon, i}
							<tr class="border-b border-[var(--color-border)]/30">
								<td class="py-1.5 pr-2 font-medium">{weapon.name}</td>
								<td class="py-1.5 pr-2">{weapon.damage}</td>
								<td class="py-1.5 pr-2">{weapon.range}</td>
								<td class="py-1.5 pr-2">{weapon.attacksPerRound}</td>
								<td class="py-1.5 pr-2">{weapon.ammo ?? '—'}</td>
								<td class="py-1.5">
									<button type="button" onclick={() => removeWeapon(i)} class="text-xs text-[var(--color-destructive)] hover:underline">Remove</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<details class="rounded-md border border-[var(--color-border)] p-3">
			<summary class="cursor-pointer text-sm font-medium">Add Weapon from List</summary>
			<div class="mt-2 grid gap-1 sm:grid-cols-2">
				{#each data.equipment.weapons as weapon}
					{@const alreadyAdded = weapons.some((w) => w.name === weapon.name)}
					<button
						type="button"
						onclick={() => addWeapon(weapon)}
						disabled={alreadyAdded}
						class="rounded px-2 py-1 text-left text-xs transition-colors
							{alreadyAdded ? 'opacity-40' : 'hover:bg-[var(--color-accent)]'}"
					>
						<span class="font-medium">{weapon.name}</span>
						<span class="text-[var(--color-muted-foreground)]"> — {weapon.damage}</span>
					</button>
				{/each}
			</div>
		</details>
	</div>

	<!-- General Equipment -->
	<div class="space-y-3">
		<h2 class="text-lg font-semibold" data-heading>Equipment</h2>

		{#if items.length > 0}
			<ul class="space-y-1">
				{#each items as item, i}
					<li class="flex items-center gap-2 rounded-md border border-[var(--color-border)]/30 px-3 py-1.5 text-sm">
						<span class="flex-1">{item.name}</span>
						<button type="button" onclick={() => removeItem(i)} class="text-xs text-[var(--color-destructive)] hover:underline">Remove</button>
					</li>
				{/each}
			</ul>
		{/if}

		<!-- Add custom item -->
		<div class="flex gap-2">
			<input
				type="text"
				placeholder="Add custom item..."
				bind:value={newItemName}
				onkeydown={(e) => { if (e.key === 'Enter') addItem(newItemName); }}
				class="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm
					placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
			/>
			<button
				type="button"
				onclick={() => addItem(newItemName)}
				class="rounded-md bg-[var(--color-secondary)] px-3 py-2 text-sm font-medium
					text-[var(--color-secondary-foreground)] transition-colors hover:opacity-90"
			>
				Add
			</button>
		</div>

		<!-- Common items picker -->
		<details class="rounded-md border border-[var(--color-border)] p-3">
			<summary class="cursor-pointer text-sm font-medium">Common {data.contentPack.eras.find((e) => e.id === $wizard.character.era)?.name ?? $wizard.character.era} Items</summary>
			<div class="mt-2 flex flex-wrap gap-1">
				{#each data.equipment.commonItems[$wizard.character.era] ?? data.equipment.commonItems['1920s'] ?? [] as itemName}
					{@const alreadyAdded = items.some((i) => i.name === itemName)}
					<button
						type="button"
						onclick={() => addCommonItem(itemName)}
						disabled={alreadyAdded}
						class="rounded-full border px-2 py-0.5 text-xs transition-colors
							{alreadyAdded
								? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
								: 'border-[var(--color-border)] hover:bg-[var(--color-accent)]'}"
					>
						{itemName}
					</button>
				{/each}
			</div>
		</details>
	</div>

	<!-- Navigation -->
	<div class="flex justify-between pt-4">
		<a
			href={WIZARD_STEPS[3].path}
			class="rounded-md border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium
				text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-accent)]"
		>
			&larr; Backstory
		</a>
		<button
			type="button"
			onclick={proceed}
			class="rounded-md bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium
				text-[var(--color-primary-foreground)] transition-colors hover:opacity-90"
		>
			Next: Review &rarr;
		</button>
	</div>
</div>
