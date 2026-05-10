import type { DiceThemeCustomColorset } from '@3d-dice/dice-box-threejs';

/** Surface pattern keys from `@3d-dice/dice-box-threejs` texture list. */
export type DiceTexturePreset = 'marble' | 'wood' | 'stars';

export type DiceColorPreset = 'nautical' | 'bone' | 'neon';

export interface DiceAppearancePrefs {
	texture: DiceTexturePreset;
	color: DiceColorPreset;
}

/** Ordered for UI: cool ink → warm paper → loud neon. */
export const DICE_TEXTURE_PRESETS: readonly DiceTexturePreset[] = ['marble', 'wood', 'stars'] as const;

export const DICE_COLOR_PRESETS: readonly DiceColorPreset[] = ['nautical', 'bone', 'neon'] as const;

export const DICE_TEXTURE_LABELS: Record<DiceTexturePreset, string> = {
	marble: 'Polished stone',
	wood: 'Woodgrain',
	stars: 'Starfield'
};

export const DICE_COLOR_LABELS: Record<DiceColorPreset, string> = {
	nautical: 'Nautical ink',
	bone: 'Parchment bone',
	neon: 'Arcade neon'
};

export const DEFAULT_DICE_APPEARANCE: DiceAppearancePrefs = {
	texture: 'marble',
	color: 'nautical'
};

const TEXTURE_MATERIAL: Record<DiceTexturePreset, { texture: string; material: string }> = {
	marble: { texture: 'marble', material: 'glass' },
	wood: { texture: 'wood', material: 'wood' },
	// `stars` uses matte/unlit-style dice in the engine (`material: none`) — reads very unlike stone or wood.
	stars: { texture: 'stars', material: 'none' }
};

const COLOR_PALETTES: Record<DiceColorPreset, Omit<DiceThemeCustomColorset, 'name' | 'texture' | 'material'>> = {
	nautical: {
		foreground: '#f4e3ae',
		background: ['#0c1a30', '#162a4d', '#1f3a6a', '#3a2a5e'],
		outline: '#040814',
		edge: '#c89b3c'
	},
	bone: {
		foreground: '#2c1810',
		background: ['#f3ead8', '#e5d9c8', '#d4c4a8', '#b8a684'],
		outline: '#3a2618',
		edge: '#6b5344'
	},
	// High-saturation faces — reads clearly different from nautical and bone in motion.
	neon: {
		foreground: '#0b0b12',
		background: ['#22ffc8', '#ff2d95', '#c8ff00', '#b366ff'],
		outline: '#020617',
		edge: '#fff01f'
	}
};

/**
 * Builds a `theme_customColorset` for dice-box-threejs from user presets.
 */
export function buildDiceColorset(prefs: DiceAppearancePrefs): DiceThemeCustomColorset {
	const { texture, material } = TEXTURE_MATERIAL[prefs.texture];
	const palette = COLOR_PALETTES[prefs.color];

	return {
		name: `miskatonic-${prefs.texture}-${prefs.color}`,
		texture,
		material,
		foreground: palette.foreground,
		background: palette.background,
		outline: palette.outline,
		edge: palette.edge
	};
}

export function isDiceTexturePreset(value: unknown): value is DiceTexturePreset {
	return value === 'marble' || value === 'wood' || value === 'stars';
}

export function isDiceColorPreset(value: unknown): value is DiceColorPreset {
	return value === 'nautical' || value === 'bone' || value === 'neon';
}

/** CSS `background` value for settings-page swatches (face tint preview). */
export function diceColorPreviewBackground(color: DiceColorPreset): string {
	const { background } = COLOR_PALETTES[color];
	const stops = Array.isArray(background) ? background : [background];
	return `linear-gradient(135deg, ${stops.join(', ')})`;
}
