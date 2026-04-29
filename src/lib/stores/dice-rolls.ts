import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import {
	hasDiceToShow,
	validateDiceRollRequest,
	type DiceRollRequest
} from '$lib/dice/protocol';

export interface ActiveDiceRoll {
	id: number;
	request: DiceRollRequest;
}

interface QueuedDiceRoll extends ActiveDiceRoll {
	resolve: () => void;
}

let nextRollId = 1;
let active: QueuedDiceRoll | null = null;
const queue: QueuedDiceRoll[] = [];

export const diceRollState = writable<ActiveDiceRoll | null>(null);

export function showDiceRoll(request: DiceRollRequest): Promise<void> {
	validateDiceRollRequest(request);

	if (!browser || !hasDiceToShow(request)) {
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
