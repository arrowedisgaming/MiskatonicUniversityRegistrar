import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { getToken } from '@auth/core/jwt';
import { nanoid } from 'nanoid';
import { getDb } from './db';
import { adminAuditLog } from './db/schema';
import { ensureUser, DEV_AUTH_SECRET } from './auth';

type EnvPlatform = {
	env?: Record<string, string | unknown>;
};

const DEFAULT_STEP_UP_WINDOW_SECONDS = 15 * 60;

function getEnv(event: RequestEvent, key: string): string | undefined {
	const platform = event.platform as EnvPlatform | undefined;
	const platformValue = platform?.env?.[key];
	if (typeof platformValue === 'string' && platformValue.length > 0) return platformValue;

	if (typeof process !== 'undefined') {
		const fromProcess = process.env[key];
		if (typeof fromProcess === 'string' && fromProcess.length > 0) return fromProcess;
	}

	return undefined;
}

/**
 * Parse a comma-separated ADMIN_EMAILS env var into a normalized Set.
 * Empty / missing input yields an empty Set (no admins).
 */
export function parseAdminEmails(raw: string | undefined): Set<string> {
	if (!raw) return new Set();
	return new Set(
		raw
			.split(',')
			.map((s) => s.trim().toLowerCase())
			.filter((s) => s.length > 0)
	);
}

export function getAdminEmails(event: RequestEvent): Set<string> {
	return parseAdminEmails(getEnv(event, 'ADMIN_EMAILS'));
}

export function isAdminEmail(email: string | null | undefined, emails: Set<string>): boolean {
	if (!email) return false;
	return emails.has(email.trim().toLowerCase());
}

export function getAdminStepUpWindow(event: RequestEvent): number {
	const raw = getEnv(event, 'ADMIN_STEP_UP_WINDOW_SECONDS');
	if (!raw) return DEFAULT_STEP_UP_WINDOW_SECONDS;
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_STEP_UP_WINDOW_SECONDS;
	return parsed;
}

function getAuthSecret(event: RequestEvent): string {
	const nodeEnv = getEnv(event, 'NODE_ENV') ?? 'production';
	const isDev = nodeEnv === 'development';
	return getEnv(event, 'AUTH_SECRET') ?? (isDev ? DEV_AUTH_SECRET : '');
}

/**
 * Read the JWT issued-at (iat) for the current request. Returns null if no token
 * or no iat claim. We decode independently of Auth.js's session helper so we can
 * verify recency without trusting whatever the session callback chose to expose.
 */
async function getTokenIat(event: RequestEvent): Promise<number | null> {
	const secret = getAuthSecret(event);
	if (!secret) return null;
	// Auth.js cookie name & salt vary by URL scheme (`__Secure-` prefix on HTTPS).
	// Try both so we work in dev (http) and prod (https).
	const candidates: Array<{ cookieName: string; salt: string; secureCookie: boolean }> = [
		{
			cookieName: '__Secure-authjs.session-token',
			salt: '__Secure-authjs.session-token',
			secureCookie: true
		},
		{ cookieName: 'authjs.session-token', salt: 'authjs.session-token', secureCookie: false }
	];
	for (const cand of candidates) {
		try {
			const token = await getToken({
				req: event.request,
				secret,
				cookieName: cand.cookieName,
				salt: cand.salt,
				secureCookie: cand.secureCookie
			});
			const iat = (token as { iat?: number } | null)?.iat;
			if (typeof iat === 'number') return iat;
		} catch {
			// fall through and try the next candidate
		}
	}
	return null;
}

/**
 * Append an admin_audit_log row. Exported so other admin-elevated paths (e.g.
 * the cross-user sheet read in /sheet/[id]) can share the same audit shape
 * instead of inlining their own insert.
 *
 * Snapshots the actor's email into `actorEmail` so the row remains attributable
 * even after the FK is later set null (account deletion / GDPR purge).
 */
export async function recordAdminAccess(
	event: RequestEvent,
	userId: string,
	overrides: { path?: string; method?: string } = {}
): Promise<void> {
	try {
		const session = await event.locals.auth();
		const db = await getDb(event);
		await db.insert(adminAuditLog).values({
			id: nanoid(21),
			userId,
			actorEmail: session?.user?.email ?? null,
			path: overrides.path ?? new URL(event.request.url).pathname,
			method: overrides.method ?? event.request.method,
			ip: event.getClientAddress?.() ?? null,
			userAgent: event.request.headers.get('user-agent') ?? null,
			createdAt: new Date()
		});
	} catch (err) {
		// Audit must never block the request — log and continue.
		console.warn('[admin-audit] failed to record access:', (err as Error)?.message ?? err);
	}
}

/**
 * Gate an admin-only route.
 *
 * Layered checks (defense in depth):
 *  1. Logged in (delegates to ensureUser).
 *  2. Session email matches the ADMIN_EMAILS allowlist re-read on every request.
 *  3. JWT iat is within ADMIN_STEP_UP_WINDOW_SECONDS (default 15 min). Stale tokens
 *     are redirected to /login?stepUp=1.
 *  4. Every successful entry is appended to admin_audit_log.
 *
 * Throws 403 (or 401 via ensureUser) when access is denied. May `throw redirect`
 * on stale-iat for HTML loads; API endpoints get a 401 instead so fetch callers
 * can surface the step-up state without auto-following a redirect.
 */
export async function ensureAdmin(event: RequestEvent): Promise<string> {
	const userId = await ensureUser(event);
	const session = await event.locals.auth();

	const adminEmails = getAdminEmails(event);
	if (!isAdminEmail(session?.user?.email, adminEmails)) {
		throw error(403, 'Forbidden');
	}

	// Fail closed: a token we can't read counts as "no recent login" — bounce to
	// re-auth rather than letting an unparseable/forged cookie skate past the
	// step-up gate.
	const iat = await getTokenIat(event);
	const isApi = new URL(event.request.url).pathname.startsWith('/api/');
	if (iat === null) {
		if (isApi) throw error(401, 'Step-up required');
		throw redirect(303, '/login?stepUp=1');
	}
	const ageSeconds = Math.floor(Date.now() / 1000) - iat;
	const window = getAdminStepUpWindow(event);
	if (ageSeconds > window) {
		if (isApi) throw error(401, 'Step-up required');
		throw redirect(303, '/login?stepUp=1');
	}

	await recordAdminAccess(event, userId);
	return userId;
}

/**
 * Re-check the step-up window for a non-`/admin` route that wants to perform an
 * admin-elevated action (e.g. cross-user read on `/sheet/[id]`). Returns true
 * if the session is fresh enough; false (with redirect/error for HTML/API
 * respectively) when stale, mirroring `ensureAdmin`'s behaviour.
 *
 * Throws on stale tokens so the caller can fall through to the normal 404 path
 * if it would rather hide the admin capability entirely.
 */
export async function ensureAdminStepUp(event: RequestEvent): Promise<void> {
	const iat = await getTokenIat(event);
	const isApi = new URL(event.request.url).pathname.startsWith('/api/');
	if (iat === null) {
		if (isApi) throw error(401, 'Step-up required');
		throw redirect(303, '/login?stepUp=1');
	}
	const ageSeconds = Math.floor(Date.now() / 1000) - iat;
	if (ageSeconds > getAdminStepUpWindow(event)) {
		if (isApi) throw error(401, 'Step-up required');
		throw redirect(303, '/login?stepUp=1');
	}
}

/**
 * Cheap, non-throwing check for use in layout loads where we want to expose
 * `isAdmin` to the client (e.g. to render the nav link) without forcing a
 * step-up redirect just to render the header.
 */
export async function checkIsAdmin(event: RequestEvent): Promise<boolean> {
	const session = await event.locals.auth();
	const adminEmails = getAdminEmails(event);
	return isAdminEmail(session?.user?.email, adminEmails);
}
