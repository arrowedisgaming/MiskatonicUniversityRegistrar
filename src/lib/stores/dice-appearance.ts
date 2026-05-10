import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import {
	DEFAULT_DICE_APPEARANCE,
	type DiceAppearancePrefs,
	isDiceColorPreset,
	isDiceTexturePreset
} from '$lib/dice/dice-appearance';

const STORAGE_KEY = 'dice-appearance-v1';

function parseStored(raw: unknown): DiceAppearancePrefs | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	let texture = o.texture;
	let color = o.color;
	// Migrate removed presets so localStorage from older builds still loads sensibly.
	if (texture === 'metal') texture = 'stars';
	if (color === 'midnight') color = 'neon';
	if (!isDiceTexturePreset(texture) || !isDiceColorPreset(color)) return null;
	return { texture, color };
}

function loadInitial(): DiceAppearancePrefs {
	if (!browser) return { ...DEFAULT_DICE_APPEARANCE };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_DICE_APPEARANCE };
		const parsed = parseStored(JSON.parse(raw));
		return parsed ?? { ...DEFAULT_DICE_APPEARANCE };
	} catch {
		return { ...DEFAULT_DICE_APPEARANCE };
	}
}

function persist(prefs: DiceAppearancePrefs): void {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function createDiceAppearanceStore() {
	const { subscribe, set: setStore, update: updateStore } = writable<DiceAppearancePrefs>(loadInitial());

	return {
		subscribe,
		set(prefs: DiceAppearancePrefs) {
			setStore(prefs);
			persist(prefs);
		},
		update(updater: (p: DiceAppearancePrefs) => DiceAppearancePrefs) {
			updateStore((current) => {
				const next = updater(current);
				persist(next);
				return next;
			});
		},
		setTexture(texture: DiceAppearancePrefs['texture']) {
			updateStore((p) => {
				const next = { ...p, texture };
				persist(next);
				return next;
			});
		},
		setColor(color: DiceAppearancePrefs['color']) {
			updateStore((p) => {
				const next = { ...p, color };
				persist(next);
				return next;
			});
		}
	};
}

export const diceAppearance = createDiceAppearanceStore();
