import { BookOpen, Monitor, Moon, Sun } from '@lucide/svelte';
import type { Component } from 'svelte';

/* ─── Types ─────────────────────────────────── */

export type Era = 'classic' | 'modern';
export type Mode = 'light' | 'dark';

export interface EraDefinition {
	id: Era;
	label: string;
	description: string;
	icon: Component;
}

export interface ThemeDefinition {
	id: string;
	era: Era;
	mode: Mode;
	label: string;
	cssClass: string;
	resolvesDark: boolean;
}

/* ─── Era Definitions ───────────────────────── */

export const eras: EraDefinition[] = [
	{
		id: 'classic',
		label: 'Classic',
		description: '1920s Investigation',
		icon: BookOpen
	},
	{
		id: 'modern',
		label: 'Modern',
		description: '1980s Terminal',
		icon: Monitor
	}
];

/* ─── Theme Definitions ─────────────────────── */

export const themes: ThemeDefinition[] = [
	{
		id: 'classic-dark',
		era: 'classic',
		mode: 'dark',
		label: 'Classic Dark',
		cssClass: 'classic-dark',
		resolvesDark: true
	},
	{
		id: 'classic-light',
		era: 'classic',
		mode: 'light',
		label: 'Classic Light',
		cssClass: 'classic-light',
		resolvesDark: false
	},
	{
		id: 'modern-dark',
		era: 'modern',
		mode: 'dark',
		label: 'Modern Dark',
		cssClass: 'modern-dark',
		resolvesDark: true
	},
	{
		id: 'modern-light',
		era: 'modern',
		mode: 'light',
		label: 'Modern Light',
		cssClass: 'modern-light',
		resolvesDark: false
	}
];

/* ─── Defaults ──────────────────────────────── */

export const defaultEra: Era = 'classic';
export const defaultMode: Mode = 'dark';
export const defaultTheme = themes[0]; // classic-dark

/* ─── Helpers ───────────────────────────────── */

export function getEra(id: Era): EraDefinition {
	return eras.find((e) => e.id === id) ?? eras[0];
}

export function resolveTheme(era: Era, mode: Mode): ThemeDefinition {
	return themes.find((t) => t.era === era && t.mode === mode) ?? defaultTheme;
}

export function getTheme(id: string): ThemeDefinition {
	return themes.find((t) => t.id === id) ?? defaultTheme;
}

/** All CSS classes that need to be removed when switching themes. */
export const allThemeClasses = [
	...eras.map((e) => e.id),
	...themes.map((t) => t.cssClass)
];

/* ─── Mode Icons ────────────────────────────── */

export const modeIcons: Record<Mode, Component> = {
	light: Sun,
	dark: Moon
};
