import { describe, it, expect } from 'vitest';
import {
	normalizePortraitUrl,
	isValidPortraitUrl,
	validatePortraitUrl,
	PORTRAIT_URL_MAX_LENGTH
} from '$lib/engine/portrait-url';

describe('normalizePortraitUrl', () => {
	it('trims surrounding whitespace', () => {
		expect(normalizePortraitUrl('  https://example.com/a.png  ')).toBe('https://example.com/a.png');
	});
});

describe('isValidPortraitUrl', () => {
	it('allows empty string', () => {
		expect(isValidPortraitUrl('')).toBe(true);
	});

	it('allows http and https URLs', () => {
		expect(isValidPortraitUrl('https://example.com/portrait.jpg')).toBe(true);
		expect(isValidPortraitUrl('http://example.com/portrait.jpg')).toBe(true);
	});

	it('rejects non-http schemes and bare paths', () => {
		expect(isValidPortraitUrl('javascript:alert(1)')).toBe(false);
		expect(isValidPortraitUrl('/images/portrait.jpg')).toBe(false);
		expect(isValidPortraitUrl('example.com/portrait.jpg')).toBe(false);
	});

	it('rejects URLs longer than the max length', () => {
		const long = `https://example.com/${'a'.repeat(PORTRAIT_URL_MAX_LENGTH)}`;
		expect(isValidPortraitUrl(long)).toBe(false);
	});
});

describe('validatePortraitUrl', () => {
	it('returns trimmed value when valid', () => {
		expect(validatePortraitUrl('  https://example.com/a.png  ')).toEqual({
			ok: true,
			value: 'https://example.com/a.png'
		});
	});

	it('returns an error for invalid schemes', () => {
		const result = validatePortraitUrl('ftp://example.com/a.png');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toContain('http');
		}
	});
});
