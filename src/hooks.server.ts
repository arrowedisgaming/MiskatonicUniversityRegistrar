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
// Stricter buckets for sensitive surfaces. Path-prefix match — first hit wins.
const STRICTER_BUCKETS: Array<{ prefix: string; max: number }> = [
	// Per-IP cap on the analytics tracking pixel so an attacker can't run up the
	// pdf_generated counter to mask abuse signal.
	{ prefix: '/api/events/pdf', max: 5 },
	// Admin write surface is read-only in v1; if any /api/admin route appears
	// later, keep it quiet so credential-stuffed sessions can't be amplified.
	{ prefix: '/api/admin/', max: 30 }
];
const writeBuckets = new Map<string, { count: number; resetAt: number }>();
// On a long-lived Node process, distinct path keys accumulate forever otherwise.
// Cap is loose — Cloudflare isolates recycle fast enough that this only matters
// on local dev / self-hosted runs, but the cleanup is cheap.
const RATE_LIMIT_MAX_BUCKETS = 4096;

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

	// Admin surface: keep out of search indexes and CDN caches regardless of
	// status code (403/302/200 all need this). Layouts can also set these via
	// `setHeaders`, but they don't run when an earlier load throws.
	const path = new URL(event.request.url).pathname;
	if (path.startsWith('/admin')) {
		response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
		response.headers.set('Cache-Control', 'no-store, private, max-age=0');
	}

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
	const pathname = new URL(request.url).pathname;
	const key = `${clientAddress}:${pathname}`;
	const bucket = writeBuckets.get(key);

	const stricter = STRICTER_BUCKETS.find((b) => pathname.startsWith(b.prefix));
	const max = stricter?.max ?? RATE_LIMIT_MAX_WRITES;

	if (!bucket || bucket.resetAt <= now) {
		if (writeBuckets.size >= RATE_LIMIT_MAX_BUCKETS) pruneExpired(now);
		writeBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return false;
	}

	bucket.count += 1;
	return bucket.count > max;
}

function pruneExpired(now: number): void {
	for (const [k, b] of writeBuckets) {
		if (b.resetAt <= now) writeBuckets.delete(k);
	}
	// If still oversized after pruning expired entries, drop oldest reset-window
	// entries first. Map iteration is insertion-ordered, so the first entries
	// are the longest-lived.
	if (writeBuckets.size >= RATE_LIMIT_MAX_BUCKETS) {
		const overshoot = writeBuckets.size - RATE_LIMIT_MAX_BUCKETS + 64;
		const iter = writeBuckets.keys();
		for (let i = 0; i < overshoot; i++) {
			const next = iter.next();
			if (next.done) break;
			writeBuckets.delete(next.value);
		}
	}
}
