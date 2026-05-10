import { describe, expect, it } from 'vitest';
import {
	buildDiceColorset,
	DEFAULT_DICE_APPEARANCE,
	diceColorPreviewBackground,
	isDiceColorPreset,
	isDiceTexturePreset
} from '$lib/dice/dice-appearance';

describe('buildDiceColorset', () => {
	it('maps textures to glass / wood / none (stars) per bundle', () => {
		expect(buildDiceColorset({ texture: 'marble', color: 'nautical' })).toMatchObject({
			texture: 'marble',
			material: 'glass'
		});
		expect(buildDiceColorset({ texture: 'wood', color: 'nautical' })).toMatchObject({
			texture: 'wood',
			material: 'wood'
		});
		expect(buildDiceColorset({ texture: 'stars', color: 'nautical' })).toMatchObject({
			texture: 'stars',
			material: 'none'
		});
	});

	it('uses stable palette hex values per color preset', () => {
		const cs = buildDiceColorset({ texture: 'marble', color: 'nautical' });
		expect(cs.foreground).toBe('#f4e3ae');
		expect(cs.background).toEqual(['#0c1a30', '#162a4d', '#1f3a6a', '#3a2a5e']);
		expect(cs.name).toBe('miskatonic-marble-nautical');
	});

	it('neon palette is high-chroma and distinct from nautical', () => {
		const neon = buildDiceColorset({ texture: 'marble', color: 'neon' });
		expect(neon.foreground).toBe('#0b0b12');
		expect(neon.background).toEqual(['#22ffc8', '#ff2d95', '#c8ff00', '#b366ff']);
	});

	it('defaults align with DEFAULT_DICE_APPEARANCE', () => {
		expect(buildDiceColorset(DEFAULT_DICE_APPEARANCE).name).toBe('miskatonic-marble-nautical');
	});
});

describe('type guards', () => {
	it('accepts valid texture and color ids', () => {
		expect(isDiceTexturePreset('wood')).toBe(true);
		expect(isDiceColorPreset('bone')).toBe(true);
	});

	it('rejects invalid ids', () => {
		expect(isDiceTexturePreset('metal')).toBe(false);
		expect(isDiceTexturePreset('dragon')).toBe(false);
		expect(isDiceColorPreset('midnight')).toBe(false);
		expect(isDiceColorPreset('classic')).toBe(false);
	});
});

describe('diceColorPreviewBackground', () => {
	it('returns a linear-gradient CSS string', () => {
		const bg = diceColorPreviewBackground('bone');
		expect(bg).toMatch(/^linear-gradient\(135deg, /);
		expect(bg).toContain('#f3ead8');
	});
});
