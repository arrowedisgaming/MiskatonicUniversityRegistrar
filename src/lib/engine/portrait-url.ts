export const PORTRAIT_URL_MAX_LENGTH = 2048;

const HTTP_URL_PATTERN = /^https?:\/\//i;

export function normalizePortraitUrl(raw: string): string {
	return raw.trim();
}

export function isValidPortraitUrl(url: string): boolean {
	if (url.length === 0) return true;
	if (url.length > PORTRAIT_URL_MAX_LENGTH) return false;
	return HTTP_URL_PATTERN.test(url);
}

export function validatePortraitUrl(raw: string): { ok: true; value: string } | { ok: false; message: string } {
	const value = normalizePortraitUrl(raw);
	if (value.length > PORTRAIT_URL_MAX_LENGTH) {
		return { ok: false, message: `Portrait URL must be ${PORTRAIT_URL_MAX_LENGTH} characters or fewer.` };
	}
	if (value.length > 0 && !HTTP_URL_PATTERN.test(value)) {
		return { ok: false, message: 'Portrait URL must start with http:// or https://.' };
	}
	return { ok: true, value };
}
