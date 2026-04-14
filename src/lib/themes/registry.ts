import { Moon, Sun } from '@lucide/svelte';
import type { Component } from 'svelte';

export interface ThemeDefinition {
	id: string;
	label: string;
	icon: Component;
	cssClass: string | null;
	resolvesDark: boolean;
}

export const themes: ThemeDefinition[] = [
	{ id: 'eldritch', label: 'Eldritch Dark', icon: Moon, cssClass: 'eldritch', resolvesDark: true },
	{ id: 'parchment', label: 'Aged Parchment', icon: Sun, cssClass: 'parchment', resolvesDark: false }
];

export const defaultTheme = themes[0];

export function getTheme(id: string): ThemeDefinition {
	return themes.find((t) => t.id === id) ?? defaultTheme;
}

export const allThemeClasses = themes
	.map((t) => t.cssClass)
	.filter((c): c is string => c !== null);
