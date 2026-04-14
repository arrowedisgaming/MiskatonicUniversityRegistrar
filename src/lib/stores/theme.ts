import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { getTheme, allThemeClasses, defaultTheme, type ThemeDefinition } from '$lib/themes/registry';

const STORAGE_KEY = 'theme';

function createThemeStore() {
	const stored = browser ? localStorage.getItem(STORAGE_KEY) : null;
	const initial = stored ? getTheme(stored) : defaultTheme;
	const { subscribe, set } = writable<ThemeDefinition>(initial);

	function apply(theme: ThemeDefinition) {
		if (!browser) return;
		const root = document.documentElement;
		allThemeClasses.forEach((cls) => root.classList.remove(cls));
		if (theme.cssClass) root.classList.add(theme.cssClass);
		localStorage.setItem(STORAGE_KEY, theme.id);
		set(theme);
	}

	// Apply initial theme on load
	if (browser) apply(initial);

	return {
		subscribe,
		set: apply
	};
}

export const theme = createThemeStore();
