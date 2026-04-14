/**
 * Auth utilities. For now, returns an anonymous local dev user.
 * Will be replaced with Auth.js session when OAuth is configured.
 */

import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

const ANON_USER_ID = 'local-dev-user';

let userEnsured = false;

export function getUserId(): string {
	return ANON_USER_ID;
}

export function ensureUser(): string {
	const userId = getUserId();

	// Auto-create the dev user if it doesn't exist
	if (!userEnsured) {
		const existing = db.select().from(users).where(eq(users.id, userId)).get();
		if (!existing) {
			try {
				db.insert(users).values({ id: userId, name: 'Local Dev User' }).run();
			} catch {
				// Already exists
			}
		}
		userEnsured = true;
	}

	return userId;
}
