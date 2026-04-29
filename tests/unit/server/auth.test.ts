import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { findOrCreateUserByEmail } from '$lib/server/auth';

type TestDb = BetterSQLite3Database<typeof schema>;

function freshDb(): TestDb {
	const sqlite = new Database(':memory:');
	sqlite.exec(`
		CREATE TABLE users (
			id text PRIMARY KEY NOT NULL,
			name text,
			email text,
			email_verified integer,
			image text
		);
		CREATE UNIQUE INDEX users_email_unique ON users (email);
	`);
	return drizzle(sqlite, { schema });
}

describe('findOrCreateUserByEmail', () => {
	let db: TestDb;

	beforeEach(() => {
		db = freshDb();
	});

	it('creates a user row with a stable nanoid id when one does not exist', async () => {
		const resolved = await findOrCreateUserByEmail(db, {
			email: 'researcher@miskatonic.edu',
			name: 'Dr. Armitage',
			image: null
		});

		expect(resolved).not.toBeNull();
		expect(resolved!.id).toMatch(/^[\w-]{21}$/);
		expect(resolved!.email).toBe('researcher@miskatonic.edu');
		expect(resolved!.name).toBe('Dr. Armitage');

		const persisted = await db
			.select()
			.from(schema.users)
			.where(eq(schema.users.email, 'researcher@miskatonic.edu'))
			.get();
		expect(persisted?.id).toBe(resolved!.id);
	});

	it('returns the existing row when called twice with the same email', async () => {
		const first = await findOrCreateUserByEmail(db, { email: 'a@example.com' });
		const second = await findOrCreateUserByEmail(db, {
			email: 'a@example.com',
			name: 'Different name'
		});

		expect(second?.id).toBe(first?.id);
		expect(second?.name).toBe(first?.name);

		const rows = await db.select().from(schema.users).all();
		expect(rows).toHaveLength(1);
	});

	it('survives a duplicate-insert race by re-reading on conflict', async () => {
		const racedId = 'raced-user-id-aaaaa';
		await db
			.insert(schema.users)
			.values({ id: racedId, email: 'race@example.com', name: 'Race winner' });

		const resolved = await findOrCreateUserByEmail(db, {
			email: 'race@example.com',
			name: 'Race loser'
		});

		expect(resolved?.id).toBe(racedId);
		expect(resolved?.name).toBe('Race winner');
	});

	it('rejects a second insert with the same email via the unique index', async () => {
		await db
			.insert(schema.users)
			.values({ id: 'first-user-id-aaaaaa', email: 'unique@example.com', name: 'First' });

		// The unique index on users.email must reject a second row with the same email.
		// This is the constraint that makes the find-or-create catch branch meaningful
		// under genuine concurrent first sign-ins.
		expect(() =>
			db
				.insert(schema.users)
				.values({ id: 'second-user-id-aaaaa', email: 'unique@example.com', name: 'Second' })
				.run()
		).toThrow();
	});
});
