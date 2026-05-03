import { writable } from 'svelte/store';

type Politeness = 'polite' | 'assertive';

interface AnnouncerState {
	polite: string;
	assertive: string;
}

const state = writable<AnnouncerState>({ polite: '', assertive: '' });

export const announcerState = { subscribe: state.subscribe };

export function announce(message: string, politeness: Politeness = 'polite') {
	// Clear first, then set in a separate render frame. queueMicrotask isn't
	// enough — Svelte may batch both updates into a single DOM write, so the
	// live region never visibly transitions through empty and screen readers
	// suppress identical consecutive messages. setTimeout guarantees a real
	// frame between the clear and the new value (NVDA/JAWS need ~30ms minimum).
	state.update((s) => ({ ...s, [politeness]: '' }));
	setTimeout(() => {
		state.update((s) => ({ ...s, [politeness]: message }));
	}, 50);
}
