/**
 * Auth utilities. For now, returns an anonymous local dev user.
 * Will be replaced with Auth.js session when OAuth is configured.
 */

import { getDb } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import type { AppDb } from './db';

const ANON_USER_ID = 'local-dev-user';

const ensuredDbs = new WeakSet<object>();

export function getUserId(): string {
	return ANON_USER_ID;
}

export async function ensureUser(eventOrDb?: Pick<RequestEvent, 'platform'> | AppDb): Promise<string> {
	const userId = getUserId();
	const db = isDb(eventOrDb) ? eventOrDb : await getDb(eventOrDb);

	// Auto-create the dev user if it doesn't exist
	if (!ensuredDbs.has(db)) {
		const existing = await db.select().from(users).where(eq(users.id, userId)).get();
		if (!existing) {
			try {
				await db.insert(users).values({ id: userId, name: 'Local Dev User' }).run();
			} catch {
				// Already exists
			}
		}
		ensuredDbs.add(db);
	}

	return userId;
}

function isDb(value: unknown): value is AppDb {
	return Boolean(value && typeof value === 'object' && 'select' in value);
}
