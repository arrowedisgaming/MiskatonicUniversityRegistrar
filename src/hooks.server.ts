import { json, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getDb } from '$lib/server/db';
import { handle as authHandle } from '$lib/server/auth';

// Optional dev-only auto-login bypass. The implementation file is gitignored
// (see src/lib/server/dev-auto-login.example.ts). When absent — production,
// fresh clones, CI — the dynamic import fails and we fall back to a no-op.
// `import.meta.glob` resolves the live path at dev-server start. When the file
// is absent (production, fresh clones, CI), the map is empty and we no-op. When
// it is present (a local dev who copied dev-auto-login.example.ts), the loader
// is included and we activate the bypass.
const devAutoLoginModules = import.meta.glob<{ devAutoLoginHandle?: Handle }>(
	'./lib/server/dev-auto-login.ts'
);
const devAutoLoginLoader = devAutoLoginModules['./lib/server/dev-auto-login.ts'];
let devAutoLoginHandle: Handle | null = null;
if (devAutoLoginLoader) {
	try {
		const mod = await devAutoLoginLoader();
		devAutoLoginHandle = mod.devAutoLoginHandle ?? null;
	} catch (err) {
		console.warn('[dev-auto-login] failed to load:', (err as Error)?.message ?? err);
	}
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_WRITES = 60;
const writeBuckets = new Map<string, { count: number; resetAt: number }>();

const appHandle: Handle = async ({ event, resolve }) => {
	event.locals.db = await getDb(event);

	if (isUnsafeRequest(event.request) && !isSameOrigin(event.request)) {
		return json({ message: 'Invalid request origin' }, { status: 403 });
	}

	if (isRateLimited(event.request, event.getClientAddress())) {
		return json({ message: 'Too many requests' }, { status: 429 });
	}

	const response = await resolve(event);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};

export const handle = devAutoLoginHandle
	? sequence(appHandle, devAutoLoginHandle, authHandle)
	: sequence(appHandle, authHandle);

function isUnsafeRequest(request: Request): boolean {
	return MUTATING_METHODS.has(request.method);
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('origin');
	if (!origin) return true;

	return origin === new URL(request.url).origin;
}

function isRateLimited(request: Request, clientAddress: string): boolean {
	if (!request.url.includes('/api/') || !isUnsafeRequest(request)) return false;

	const now = Date.now();
	const key = `${clientAddress}:${new URL(request.url).pathname}`;
	const bucket = writeBuckets.get(key);

	if (!bucket || bucket.resetAt <= now) {
		writeBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return false;
	}

	bucket.count += 1;
	return bucket.count > RATE_LIMIT_MAX_WRITES;
}
