import { describe, expect, it } from 'vitest';
import { isAdminEmail, parseAdminEmails } from '../../../src/lib/server/admin';

describe('parseAdminEmails', () => {
	it('returns an empty set for undefined / empty input', () => {
		expect(parseAdminEmails(undefined).size).toBe(0);
		expect(parseAdminEmails('').size).toBe(0);
		expect(parseAdminEmails('   ').size).toBe(0);
	});

	it('parses a single email', () => {
		const s = parseAdminEmails('admin@example.com');
		expect(s.has('admin@example.com')).toBe(true);
		expect(s.size).toBe(1);
	});

	it('parses multiple emails, lowercasing and trimming', () => {
		const s = parseAdminEmails(' Admin@example.com , OTHER@example.com ');
		expect(s.has('admin@example.com')).toBe(true);
		expect(s.has('other@example.com')).toBe(true);
		expect(s.size).toBe(2);
	});

	it('deduplicates case-insensitively', () => {
		const s = parseAdminEmails('a@x.com, A@x.com, a@x.com');
		expect(s.size).toBe(1);
	});

	it('drops empty segments from trailing commas', () => {
		const s = parseAdminEmails('a@x.com,,,b@x.com,');
		expect(s.size).toBe(2);
	});
});

describe('isAdminEmail', () => {
	const admins = parseAdminEmails('admin@example.com, second@example.com');

	it('returns false for null / undefined / empty', () => {
		expect(isAdminEmail(null, admins)).toBe(false);
		expect(isAdminEmail(undefined, admins)).toBe(false);
		expect(isAdminEmail('', admins)).toBe(false);
	});

	it('returns true for matching email case-insensitively', () => {
		expect(isAdminEmail('admin@example.com', admins)).toBe(true);
		expect(isAdminEmail('ADMIN@example.com', admins)).toBe(true);
		expect(isAdminEmail(' admin@example.com ', admins)).toBe(true);
	});

	it('returns false for non-listed emails', () => {
		expect(isAdminEmail('intruder@example.com', admins)).toBe(false);
	});

	it('returns false when allowlist is empty', () => {
		expect(isAdminEmail('anyone@example.com', new Set())).toBe(false);
	});
});
