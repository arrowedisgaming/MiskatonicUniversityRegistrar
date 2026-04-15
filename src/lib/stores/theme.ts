import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import {
	allThemeClasses,
	defaultEra,
	defaultMode,
	resolveTheme,
	type Era,
	type Mode
} from '$lib/themes/registry';

const ERA_KEY = 'theme-era';
const MODE_KEY = 'theme-mode';
const OLD_KEY = 'theme';

/* ─── Migration from v1 single-theme store ──── */

function migrateOldTheme(): void {
	if (!browser) return;
	const old = localStorage.getItem(OLD_KEY);
	if (!old) return;

	if (old === 'eldritch') {
		localStorage.setItem(ERA_KEY, 'classic');
		localStorage.setItem(MODE_KEY, 'dark');
	} else if (old === 'parchment') {
		localStorage.setItem(ERA_KEY, 'classic');
		localStorage.setItem(MODE_KEY, 'light');
	}
	localStorage.removeItem(OLD_KEY);
}

/* ─── Font Loading ──────────────────────────── */

const MODERN_FONT_URL =
	'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&family=VT323&display=swap';

function ensureModernFonts(): void {
	if (!browser) return;
	const existing = document.getElementById('era-fonts-modern');
	if (existing) {
		// Already injected — make sure it's active
		existing.setAttribute('media', 'all');
		return;
	}
	const link = document.createElement('link');
	link.id = 'era-fonts-modern';
	link.rel = 'stylesheet';
	link.href = MODERN_FONT_URL;
	document.head.appendChild(link);
}

/* ─── Apply Theme to DOM ────────────────────── */

function applyToDOM(era: Era, mode: Mode): void {
	if (!browser) return;
	const root = document.documentElement;
	const theme = resolveTheme(era, mode);

	// Remove all theme/era classes, then add current
	allThemeClasses.forEach((cls) => root.classList.remove(cls));
	root.classList.add(era, theme.cssClass);

	// Load Modern fonts on demand
	if (era === 'modern') {
		ensureModernFonts();
	}
}

/* ─── Store Creation ────────────────────────── */

function createThemeStores() {
	migrateOldTheme();

	const storedEra = browser ? (localStorage.getItem(ERA_KEY) as Era | null) : null;
	const storedMode = browser ? (localStorage.getItem(MODE_KEY) as Mode | null) : null;

	const initialEra: Era = storedEra === 'classic' || storedEra === 'modern' ? storedEra : defaultEra;
	const initialMode: Mode = storedMode === 'light' || storedMode === 'dark' ? storedMode : defaultMode;

	const era = writable<Era>(initialEra);
	const mode = writable<Mode>(initialMode);

	const theme = derived([era, mode], ([$era, $mode]) => resolveTheme($era, $mode));

	function setEra(newEra: Era) {
		era.set(newEra);
		if (browser) localStorage.setItem(ERA_KEY, newEra);
	}

	function setMode(newMode: Mode) {
		mode.set(newMode);
		if (browser) localStorage.setItem(MODE_KEY, newMode);
	}

	function toggleMode() {
		let current: Mode = defaultMode;
		mode.subscribe((m) => (current = m))();
		setMode(current === 'dark' ? 'light' : 'dark');
	}

	function toggleEra() {
		let current: Era = defaultEra;
		era.subscribe((e) => (current = e))();
		setEra(current === 'classic' ? 'modern' : 'classic');
	}

	// Reactively apply theme whenever era or mode changes
	if (browser) {
		// Apply initial
		applyToDOM(initialEra, initialMode);

		// Subscribe to changes
		let currentEra = initialEra;
		let currentMode = initialMode;
		era.subscribe((e) => {
			currentEra = e;
			applyToDOM(currentEra, currentMode);
		});
		mode.subscribe((m) => {
			currentMode = m;
			applyToDOM(currentEra, currentMode);
		});
	}

	return {
		era: { subscribe: era.subscribe, set: setEra, toggle: toggleEra },
		mode: { subscribe: mode.subscribe, set: setMode, toggle: toggleMode },
		theme: { subscribe: theme.subscribe }
	};
}

export const { era, mode, theme } = createThemeStores();
