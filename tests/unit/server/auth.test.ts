import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { findOrCreateUserByEmail, findOrLinkOAuthAccount } from '$lib/server/auth';

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
		CREATE TABLE accounts (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			type text NOT NULL,
			provider text NOT NULL,
			provider_account_id text NOT NULL,
			refresh_token text,
			access_token text,
			expires_at integer,
			token_type text,
			scope text,
			id_token text,
			session_state text
		);
		CREATE UNIQUE INDEX accounts_provider_idx
			ON accounts (provider, provider_account_id);
		CREATE TABLE investigators (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			name text NOT NULL DEFAULT '',
			era text NOT NULL DEFAULT '1920s',
			mode text NOT NULL DEFAULT 'standard',
			occupation text NOT NULL DEFAULT '',
			data text NOT NULL,
			is_draft integer NOT NULL DEFAULT 1,
			is_archived integer NOT NULL DEFAULT 0,
			share_id text,
			is_public integer NOT NULL DEFAULT 0,
			created_at integer NOT NULL,
			updated_at integer NOT NULL
		);
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

describe('findOrLinkOAuthAccount', () => {
	let db: TestDb;

	beforeEach(() => {
		db = freshDb();
	});

	it('creates a new user and links the OAuth account on first sign-in', async () => {
		const resolved = await findOrLinkOAuthAccount(db, {
			provider: 'google',
			providerAccountId: 'google-uid-1',
			email: 'new@example.com',
			emailVerified: true,
			name: 'New User',
			image: null
		});
		expect(resolved).not.toBeNull();
		expect(resolved!.email).toBe('new@example.com');

		const accountRow = await db
			.select()
			.from(schema.accounts)
			.where(eq(schema.accounts.providerAccountId, 'google-uid-1'))
			.get();
		expect(accountRow?.userId).toBe(resolved!.id);
	});

	it('reuses the same user when the same provider account signs in twice', async () => {
		const first = await findOrLinkOAuthAccount(db, {
			provider: 'google',
			providerAccountId: 'google-uid-2',
			email: 'returning@example.com',
			emailVerified: true,
			name: null,
			image: null
		});
		const second = await findOrLinkOAuthAccount(db, {
			provider: 'google',
			providerAccountId: 'google-uid-2',
			email: 'returning@example.com',
			emailVerified: true,
			name: null,
			image: null
		});
		expect(second!.id).toBe(first!.id);
		const rows = await db.select().from(schema.users).all();
		expect(rows).toHaveLength(1);
	});

	it('keeps saved investigator ownership stable across repeated OAuth sign-ins', async () => {
		const first = await findOrLinkOAuthAccount(db, {
			provider: 'google',
			providerAccountId: 'google-stable-owner',
			email: 'owner@example.com',
			emailVerified: true,
			name: 'Owner',
			image: null
		});
		expect(first).not.toBeNull();

		const now = new Date();
		await db.insert(schema.investigators).values({
			id: 'investigator-owned-by-google',
			userId: first!.id,
			name: 'Stable Investigator',
			era: '1920s',
			mode: 'standard',
			occupation: 'professor',
			data: '{}',
			isDraft: false,
			isArchived: false,
			createdAt: now,
			updatedAt: now
		});

		const second = await findOrLinkOAuthAccount(db, {
			provider: 'google',
			providerAccountId: 'google-stable-owner',
			email: 'owner@example.com',
			emailVerified: true,
			name: 'Owner Again',
			image: null
		});

		expect(second!.id).toBe(first!.id);
		const visibleRows = await db
			.select()
			.from(schema.investigators)
			.where(eq(schema.investigators.userId, second!.id))
			.all();
		expect(visibleRows.map((row) => row.id)).toEqual(['investigator-owned-by-google']);
	});

	it('merges into an existing email-bearing user only when the new provider reports the email verified', async () => {
		await findOrLinkOAuthAccount(db, {
			provider: 'google',
			providerAccountId: 'google-uid-3',
			email: 'shared@example.com',
			emailVerified: true,
			name: 'Original',
			image: null
		});

		const merged = await findOrLinkOAuthAccount(db, {
			provider: 'discord',
			providerAccountId: 'discord-uid-3',
			email: 'shared@example.com',
			emailVerified: true,
			name: 'Discord Self',
			image: null
		});

		const users = await db.select().from(schema.users).all();
		expect(users).toHaveLength(1);
		expect(merged!.id).toBe(users[0].id);

		const accountsRows = await db.select().from(schema.accounts).all();
		expect(accountsRows.map((a) => a.provider).sort()).toEqual(['discord', 'google']);
	});

	it('does NOT merge when the new provider reports the email unverified — prevents account takeover', async () => {
		const original = await findOrLinkOAuthAccount(db, {
			provider: 'google',
			providerAccountId: 'google-uid-4',
			email: 'victim@example.com',
			emailVerified: true,
			name: 'Victim',
			image: null
		});

		const attacker = await findOrLinkOAuthAccount(db, {
			provider: 'discord',
			providerAccountId: 'attacker-discord-uid',
			email: 'victim@example.com',
			emailVerified: false,
			name: 'Attacker',
			image: null
		});

		// Attacker must not have been merged into victim's user row.
		expect(attacker!.id).not.toBe(original!.id);
	});
});
