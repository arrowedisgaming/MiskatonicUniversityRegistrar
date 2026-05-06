import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { createBlankCharacter } from '$lib/types/character';
import {
	disableInvestigatorShare,
	enableInvestigatorShare,
	loadSharedInvestigator,
	SHARE_ID_LENGTH
} from '$lib/server/investigator/share';
import type { AppDb } from '$lib/server/db';

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
		CREATE UNIQUE INDEX investigators_share_id_unique ON investigators (share_id);
		CREATE INDEX investigators_user_id_idx ON investigators (user_id);
	`);
	return drizzle(sqlite, { schema });
}

type InvestigatorFixture = {
	id: string;
	userId: string;
	isDraft?: boolean;
	isArchived?: boolean;
	shareId?: string | null;
	isPublic?: boolean;
	name?: string;
};

function insertInvestigator(db: TestDb, fixture: InvestigatorFixture) {
	const {
		id,
		userId,
		isDraft = false,
		isArchived = false,
		shareId = null,
		isPublic = false,
		name = 'Test Investigator'
	} = fixture;
	const character = createBlankCharacter();
	character.name = name;
	character.isDraft = isDraft;
	const now = new Date();
	db.insert(schema.investigators)
		.values({
			id,
			userId,
			name,
			era: '1920s',
			mode: 'standard',
			occupation: '',
			data: JSON.stringify(character),
			isDraft,
			isArchived,
			shareId,
			isPublic,
			createdAt: now,
			updatedAt: now
		})
		.run();
}

// `AppDb` typing matches our test BetterSQLite3Database structurally.
const asAppDb = (db: TestDb): AppDb => db as unknown as AppDb;

describe('enableInvestigatorShare', () => {
	let db: TestDb;
	const ownerId = 'owner-user-id-aaaaaa';
	const otherUserId = 'other-user-id-aaaaa';

	beforeEach(() => {
		db = freshDb();
	});

	it('mints a 16-char share token and sets isPublic=true on a finished investigator', async () => {
		insertInvestigator(db, { id: 'inv-1', userId: ownerId, isDraft: false });

		const result = await enableInvestigatorShare(asAppDb(db), {
			investigatorId: 'inv-1',
			userId: ownerId
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('expected ok');
		expect(result.shareId).toMatch(/^[\w-]+$/);
		expect(result.shareId).toHaveLength(SHARE_ID_LENGTH);

		const row = db
			.select()
			.from(schema.investigators)
			.where(eq(schema.investigators.id, 'inv-1'))
			.get();
		expect(row?.shareId).toBe(result.shareId);
		expect(row?.isPublic).toBe(true);
	});

	it('rotates the token when called twice — old token is replaced', async () => {
		insertInvestigator(db, { id: 'inv-1', userId: ownerId, isDraft: false });

		const first = await enableInvestigatorShare(asAppDb(db), {
			investigatorId: 'inv-1',
			userId: ownerId
		});
		const second = await enableInvestigatorShare(asAppDb(db), {
			investigatorId: 'inv-1',
			userId: ownerId
		});

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (!first.ok || !second.ok) throw new Error('expected ok');
		expect(second.shareId).not.toBe(first.shareId);

		// The old token must no longer resolve via the share lookup.
		const oldLookup = await loadSharedInvestigator(asAppDb(db), first.shareId);
		expect(oldLookup).toBeNull();
		const newLookup = await loadSharedInvestigator(asAppDb(db), second.shareId);
		expect(newLookup).not.toBeNull();
	});

	it('refuses to share a draft investigator with a 409', async () => {
		insertInvestigator(db, { id: 'inv-draft', userId: ownerId, isDraft: true });

		const result = await enableInvestigatorShare(asAppDb(db), {
			investigatorId: 'inv-draft',
			userId: ownerId
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.status).toBe(409);
		expect(result.message.toLowerCase()).toContain('draft');

		// No share token should have been written.
		const row = db
			.select()
			.from(schema.investigators)
			.where(eq(schema.investigators.id, 'inv-draft'))
			.get();
		expect(row?.shareId).toBeNull();
		expect(row?.isPublic).toBe(false);
	});

	it('refuses with 404 when the investigator belongs to a different user', async () => {
		insertInvestigator(db, { id: 'inv-1', userId: ownerId, isDraft: false });

		const result = await enableInvestigatorShare(asAppDb(db), {
			investigatorId: 'inv-1',
			userId: otherUserId
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.status).toBe(404);

		// Owner row must be untouched — non-owner cannot enable share for someone else.
		const row = db
			.select()
			.from(schema.investigators)
			.where(eq(schema.investigators.id, 'inv-1'))
			.get();
		expect(row?.shareId).toBeNull();
		expect(row?.isPublic).toBe(false);
	});

	it('returns 404 for a non-existent investigator', async () => {
		const result = await enableInvestigatorShare(asAppDb(db), {
			investigatorId: 'does-not-exist',
			userId: ownerId
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.status).toBe(404);
	});
});

describe('disableInvestigatorShare', () => {
	let db: TestDb;
	const ownerId = 'owner-user-id-aaaaaa';
	const otherUserId = 'other-user-id-aaaaa';

	beforeEach(() => {
		db = freshDb();
	});

	it('clears shareId and isPublic for the owner', async () => {
		insertInvestigator(db, {
			id: 'inv-1',
			userId: ownerId,
			isDraft: false,
			shareId: 'preexisting-token',
			isPublic: true
		});

		const result = await disableInvestigatorShare(asAppDb(db), {
			investigatorId: 'inv-1',
			userId: ownerId
		});

		expect(result.ok).toBe(true);

		const row = db
			.select()
			.from(schema.investigators)
			.where(eq(schema.investigators.id, 'inv-1'))
			.get();
		expect(row?.shareId).toBeNull();
		expect(row?.isPublic).toBe(false);
	});

	it('is idempotent — disabling on an already-unshared investigator still succeeds', async () => {
		insertInvestigator(db, {
			id: 'inv-1',
			userId: ownerId,
			isDraft: false,
			shareId: null,
			isPublic: false
		});

		const result = await disableInvestigatorShare(asAppDb(db), {
			investigatorId: 'inv-1',
			userId: ownerId
		});

		expect(result.ok).toBe(true);
	});

	it('refuses with 404 when the investigator belongs to a different user', async () => {
		insertInvestigator(db, {
			id: 'inv-1',
			userId: ownerId,
			isDraft: false,
			shareId: 'still-active-token',
			isPublic: true
		});

		const result = await disableInvestigatorShare(asAppDb(db), {
			investigatorId: 'inv-1',
			userId: otherUserId
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.status).toBe(404);

		// Owner share must still be active — non-owner cannot revoke.
		const row = db
			.select()
			.from(schema.investigators)
			.where(eq(schema.investigators.id, 'inv-1'))
			.get();
		expect(row?.shareId).toBe('still-active-token');
		expect(row?.isPublic).toBe(true);
	});
});

describe('loadSharedInvestigator', () => {
	let db: TestDb;
	const ownerId = 'owner-user-id-aaaaaa';

	beforeEach(() => {
		db = freshDb();
	});

	it('returns the migrated character payload when the investigator is currently shared', async () => {
		insertInvestigator(db, {
			id: 'inv-1',
			userId: ownerId,
			isDraft: false,
			shareId: 'public-token-abc',
			isPublic: true,
			name: 'Dr. Henry Armitage'
		});

		const result = await loadSharedInvestigator(asAppDb(db), 'public-token-abc');

		expect(result).not.toBeNull();
		expect(result?.character.name).toBe('Dr. Henry Armitage');
	});

	it('never includes userId or any owner-identifying field in the payload', async () => {
		insertInvestigator(db, {
			id: 'inv-1',
			userId: ownerId,
			isDraft: false,
			shareId: 'public-token-abc',
			isPublic: true
		});

		const result = await loadSharedInvestigator(asAppDb(db), 'public-token-abc');
		expect(result).not.toBeNull();
		// The returned payload keys must not leak ownership or DB internals.
		const keys = Object.keys(result ?? {});
		expect(keys).toEqual(['character']);
		// And the character data is a CoCCharacterData; it has no userId either.
		expect(result?.character).not.toHaveProperty('userId');
	});

	it('returns null for an unknown share token', async () => {
		const result = await loadSharedInvestigator(asAppDb(db), 'no-such-token');
		expect(result).toBeNull();
	});

	it('returns null when the row exists but isPublic=false (revoked but token remembered)', async () => {
		insertInvestigator(db, {
			id: 'inv-1',
			userId: ownerId,
			isDraft: false,
			shareId: 'leftover-token',
			isPublic: false
		});

		const result = await loadSharedInvestigator(asAppDb(db), 'leftover-token');
		expect(result).toBeNull();
	});

	it('returns null when shareId is NULL on the row', async () => {
		insertInvestigator(db, {
			id: 'inv-1',
			userId: ownerId,
			isDraft: false,
			shareId: null,
			isPublic: false
		});

		// Calling with empty string should never match a real row.
		const result = await loadSharedInvestigator(asAppDb(db), '');
		expect(result).toBeNull();
	});

	it('returns null when the investigator is archived (soft-deleted) even if isPublic remains true', async () => {
		insertInvestigator(db, {
			id: 'inv-1',
			userId: ownerId,
			isDraft: false,
			shareId: 'token-on-archived-row',
			isPublic: true,
			isArchived: true
		});

		const result = await loadSharedInvestigator(asAppDb(db), 'token-on-archived-row');
		expect(result).toBeNull();
	});
});
