import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import {
	hasDiceToShow,
	validateDiceRollRequest,
	type DiceRollRequest
} from '$lib/dice/protocol';

const DICE_ANIMATIONS_KEY = 'dice-roll-animations-enabled';

export interface ActiveDiceRoll {
	id: number;
	request: DiceRollRequest;
}

interface QueuedDiceRoll extends ActiveDiceRoll {
	resolve: () => void;
}

let nextRollId = 1;
let active: QueuedDiceRoll | null = null;
let currentDiceRollAnimationsEnabled = true;
let hasInitialPreferenceFlushed = false;
const queue: QueuedDiceRoll[] = [];

export const diceRollState = writable<ActiveDiceRoll | null>(null);
export const diceRollAnimationsEnabled = writable(readInitialPreference());

diceRollAnimationsEnabled.subscribe((enabled) => {
	currentDiceRollAnimationsEnabled = enabled;
	if (!browser) return;

	if (!hasInitialPreferenceFlushed) {
		hasInitialPreferenceFlushed = true;
		return;
	}

	localStorage.setItem(DICE_ANIMATIONS_KEY, enabled ? 'true' : 'false');
	if (!enabled) cancelPendingDiceRolls();
});

export function showDiceRoll(request: DiceRollRequest): Promise<void> {
	validateDiceRollRequest(request);

	if (!browser || !hasDiceToShow(request) || !currentDiceRollAnimationsEnabled) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		const roll = { id: nextRollId++, request, resolve };
		if (active) {
			queue.push(roll);
			return;
		}

		startRoll(roll);
	});
}

export function completeDiceRoll(id: number): void {
	if (!active || active.id !== id) return;

	const completed = active;
	active = null;
	diceRollState.set(null);
	completed.resolve();

	const next = queue.shift();
	if (next) startRoll(next);
}

function startRoll(roll: QueuedDiceRoll): void {
	active = roll;
	diceRollState.set({ id: roll.id, request: roll.request });
}

export function toggleDiceRollAnimations(): void {
	diceRollAnimationsEnabled.update((enabled) => !enabled);
}

function cancelPendingDiceRolls(): void {
	const current = active;
	active = null;
	diceRollState.set(null);
	current?.resolve();

	while (queue.length > 0) {
		queue.shift()?.resolve();
	}
}

function readInitialPreference(): boolean {
	if (!browser) return true;
	return localStorage.getItem(DICE_ANIMATIONS_KEY) !== 'false';
}
