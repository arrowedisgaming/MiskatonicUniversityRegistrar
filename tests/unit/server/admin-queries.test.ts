import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import {
	listUsers,
	listInvestigators,
	listRecentAudit,
	parseListSort
} from '$lib/server/admin-queries';

type TestDb = BetterSQLite3Database<typeof schema>;

function unixNow(): Date {
	return new Date();
}

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
		CREATE TABLE investigators (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			name text NOT NULL DEFAULT '',
			era text NOT NULL DEFAULT '1920s',
			mode text NOT NULL DEFAULT 'standard',
			occupation text NOT NULL DEFAULT '',
			data text NOT NULL DEFAULT '{}',
			is_draft integer NOT NULL DEFAULT 0,
			is_archived integer NOT NULL DEFAULT 0,
			share_id text,
			is_public integer NOT NULL DEFAULT 0,
			created_at integer NOT NULL,
			updated_at integer NOT NULL
		);
		CREATE TABLE analytics_events (
			id text PRIMARY KEY NOT NULL,
			user_id text,
			event_type text NOT NULL,
			provider text,
			metadata text,
			created_at integer NOT NULL
		);
		CREATE TABLE admin_audit_log (
			id text PRIMARY KEY NOT NULL,
			user_id text,
			actor_email text,
			path text NOT NULL,
			method text NOT NULL,
			ip text,
			user_agent text,
			created_at integer NOT NULL
		);
	`);
	return drizzle(sqlite, { schema });
}

describe('parseListSort', () => {
	it('defaults unknown sort keys to the default', () => {
		expect(parseListSort('bogus', 'asc', ['email', 'name'], 'email')).toEqual({
			sort: 'email',
			dir: 'asc'
		});
	});

	it('defaults dir to desc when not asc', () => {
		expect(parseListSort('email', 'bogus', ['email'], 'email')).toEqual({
			sort: 'email',
			dir: 'desc'
		});
	});
});

describe('listUsers', () => {
	let db: TestDb;

	beforeEach(() => {
		db = freshDb();
	});

	it('falls back to analytics provider when accounts row is missing', async () => {
		const now = unixNow();
		await db.insert(schema.users).values({
			id: 'user-1',
			email: 'a@example.com',
			name: 'Alice'
		});
		await db.insert(schema.analyticsEvents).values({
			id: 'evt-1',
			userId: 'user-1',
			eventType: 'login',
			provider: 'google',
			createdAt: now
		});

		const { rows } = await listUsers(db);
		expect(rows[0]?.primaryProvider).toBe('google');
	});

	it('uses accounts provider over analytics when both exist', async () => {
		const now = unixNow();
		await db.insert(schema.users).values({ id: 'user-1', email: 'a@example.com' });
		await db.insert(schema.accounts).values({
			id: 'acc-1',
			userId: 'user-1',
			type: 'oauth',
			provider: 'discord',
			providerAccountId: 'discord-1'
		});
		await db.insert(schema.analyticsEvents).values({
			id: 'evt-1',
			userId: 'user-1',
			eventType: 'login',
			provider: 'google',
			createdAt: now
		});

		const { rows } = await listUsers(db);
		expect(rows[0]?.primaryProvider).toBe('discord');
	});

	it('reports active and total investigator counts', async () => {
		const now = unixNow();
		await db.insert(schema.users).values({ id: 'user-1', email: 'a@example.com' });
		await db.insert(schema.investigators).values({
			id: 'inv-1',
			userId: 'user-1',
			name: 'Active',
			era: '1920s',
			mode: 'standard',
			occupation: '',
			data: '{}',
			isDraft: false,
			isArchived: false,
			createdAt: now,
			updatedAt: now
		});
		await db.insert(schema.investigators).values({
			id: 'inv-2',
			userId: 'user-1',
			name: 'Archived',
			era: '1920s',
			mode: 'standard',
			occupation: '',
			data: '{}',
			isDraft: false,
			isArchived: true,
			createdAt: now,
			updatedAt: now
		});

		const { rows } = await listUsers(db);
		expect(rows[0]?.investigatorCount).toBe(1);
		expect(rows[0]?.totalInvestigatorCount).toBe(2);
	});

	it('uses investigator updated_at when no analytics events exist', async () => {
		const updated = new Date('2024-06-15T12:00:00Z');
		await db.insert(schema.users).values({ id: 'user-1', email: 'a@example.com' });
		await db.insert(schema.investigators).values({
			id: 'inv-1',
			userId: 'user-1',
			name: 'Char',
			era: '1920s',
			mode: 'standard',
			occupation: '',
			data: '{}',
			isDraft: false,
			isArchived: false,
			createdAt: updated,
			updatedAt: updated
		});

		const { rows } = await listUsers(db);
		expect(rows[0]?.lastActivityAt?.toISOString()).toBe(updated.toISOString());
	});

	it('uses non-login analytics events for last activity', async () => {
		const invUpdated = new Date('2024-01-01T00:00:00Z');
		const pdfAt = new Date('2024-06-01T00:00:00Z');
		await db.insert(schema.users).values({ id: 'user-1', email: 'a@example.com' });
		await db.insert(schema.investigators).values({
			id: 'inv-1',
			userId: 'user-1',
			name: 'Char',
			era: '1920s',
			mode: 'standard',
			occupation: '',
			data: '{}',
			isDraft: false,
			isArchived: false,
			createdAt: invUpdated,
			updatedAt: invUpdated
		});
		await db.insert(schema.analyticsEvents).values({
			id: 'evt-pdf',
			userId: 'user-1',
			eventType: 'pdf_generated',
			createdAt: pdfAt
		});

		const { rows } = await listUsers(db);
		expect(rows[0]?.lastActivityAt?.toISOString()).toBe(pdfAt.toISOString());
	});

	it('sorts by email ascending', async () => {
		await db.insert(schema.users).values({ id: 'u-b', email: 'b@example.com' });
		await db.insert(schema.users).values({ id: 'u-a', email: 'a@example.com' });

		const { rows } = await listUsers(db, { sort: 'email', dir: 'asc' });
		expect(rows.map((r) => r.email)).toEqual(['a@example.com', 'b@example.com']);
	});

	it('rejects unknown sort and uses default lastActivity', async () => {
		const old = new Date('2020-01-01T00:00:00Z');
		const recent = new Date('2024-01-01T00:00:00Z');
		await db.insert(schema.users).values({ id: 'old', email: 'old@example.com' });
		await db.insert(schema.users).values({ id: 'new', email: 'new@example.com' });
		await db.insert(schema.analyticsEvents).values({
			id: 'e-old',
			userId: 'old',
			eventType: 'login',
			createdAt: old
		});
		await db.insert(schema.analyticsEvents).values({
			id: 'e-new',
			userId: 'new',
			eventType: 'login',
			createdAt: recent
		});

		const { rows } = await listUsers(db, { sort: 'not-a-column', dir: 'desc' });
		expect(rows[0]?.email).toBe('new@example.com');
	});
});

describe('listInvestigators', () => {
	let db: TestDb;

	beforeEach(() => {
		db = freshDb();
	});

	it('sorts by name descending', async () => {
		const now = unixNow();
		await db.insert(schema.users).values({ id: 'u-1', email: 'a@example.com' });
		await db.insert(schema.investigators).values({
			id: 'inv-a',
			userId: 'u-1',
			name: 'Alpha',
			era: '1920s',
			mode: 'standard',
			occupation: '',
			data: '{}',
			isDraft: false,
			isArchived: false,
			createdAt: now,
			updatedAt: now
		});
		await db.insert(schema.investigators).values({
			id: 'inv-z',
			userId: 'u-1',
			name: 'Zulu',
			era: '1920s',
			mode: 'standard',
			occupation: '',
			data: '{}',
			isDraft: false,
			isArchived: false,
			createdAt: now,
			updatedAt: now
		});

		const { rows } = await listInvestigators(db, { sort: 'name', dir: 'desc' });
		expect(rows.map((r) => r.name)).toEqual(['Zulu', 'Alpha']);
	});
});

describe('listRecentAudit', () => {
	let db: TestDb;

	beforeEach(() => {
		db = freshDb();
	});

	it('paginates and sorts by path', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		const t2 = new Date('2024-02-01T00:00:00Z');
		await db.insert(schema.adminAuditLog).values({
			id: 'a-1',
			path: '/admin/z',
			method: 'GET',
			createdAt: t1
		});
		await db.insert(schema.adminAuditLog).values({
			id: 'a-2',
			path: '/admin/a',
			method: 'GET',
			createdAt: t2
		});

		const { rows, total } = await listRecentAudit(db, { sort: 'path', dir: 'asc', pageSize: 10 });
		expect(total).toBe(2);
		expect(rows.map((r) => r.path)).toEqual(['/admin/a', '/admin/z']);
	});
});

describe('recordSessionRefresh', () => {
	let db: TestDb;

	beforeEach(() => {
		db = freshDb();
	});

	it('records at most one session_refresh per 24h', async () => {
		const { recordSessionRefresh } = await import('$lib/server/analytics');
		await db.insert(schema.users).values({ id: 'user-1', email: 'a@example.com' });

		await recordSessionRefresh(db, 'user-1');
		await recordSessionRefresh(db, 'user-1');

		const events = await db.select().from(schema.analyticsEvents).all();
		expect(events.filter((e) => e.eventType === 'session_refresh')).toHaveLength(1);
	});

	it('does not inflate login metrics', async () => {
		const { recordSessionRefresh } = await import('$lib/server/analytics');
		await db.insert(schema.users).values({ id: 'user-1', email: 'a@example.com' });

		await recordSessionRefresh(db, 'user-1');

		const events = await db.select().from(schema.analyticsEvents).all();
		expect(events.filter((e) => e.eventType === 'login')).toHaveLength(0);
	});
});
