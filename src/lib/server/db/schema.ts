import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Auth.js tables ───────────────────────────────────────────────

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	name: text('name'),
	email: text('email').unique(),
	emailVerified: integer('email_verified', { mode: 'timestamp' }),
	image: text('image')
});

export const accounts = sqliteTable('accounts', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	type: text('type').notNull(),
	provider: text('provider').notNull(),
	providerAccountId: text('provider_account_id').notNull(),
	refresh_token: text('refresh_token'),
	access_token: text('access_token'),
	expires_at: integer('expires_at'),
	token_type: text('token_type'),
	scope: text('scope'),
	id_token: text('id_token'),
	session_state: text('session_state')
});

export const sessions = sqliteTable('sessions', {
	sessionToken: text('session_token').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires: integer('expires', { mode: 'timestamp' }).notNull()
});

export const verificationTokens = sqliteTable('verification_tokens', {
	identifier: text('identifier').notNull(),
	token: text('token').notNull(),
	expires: integer('expires', { mode: 'timestamp' }).notNull()
});

// ─── Application tables ──────────────────────────────────────────

export const investigators = sqliteTable(
	'investigators',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull().default(''),
		era: text('era').notNull().default('1920s'),
		mode: text('mode').notNull().default('standard'),
		occupation: text('occupation').notNull().default(''),
		/** Full CoCCharacterData as JSON blob */
		data: text('data').notNull(),
		isDraft: integer('is_draft', { mode: 'boolean' }).notNull().default(true),
		isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
		shareId: text('share_id').unique(),
		isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('investigators_user_id_idx').on(table.userId),
		index('investigators_share_id_idx').on(table.shareId)
	]
);

// ─── Campaigns ───────────────────────────────────────────────────

/**
 * A campaign is a Keeper-owned room that players join with one of their
 * investigators. Joining is gated by an unguessable `shareId` (mirrors the
 * existing investigator-share token pattern — 16-char nanoid, ~95 bits).
 * `isOpen` is a soft toggle so the Keeper can pause new joins without
 * rotating the URL.
 */
export const campaigns = sqliteTable(
	'campaigns',
	{
		id: text('id').primaryKey(),
		keeperUserId: text('keeper_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull().default(''),
		description: text('description').notNull().default(''),
		shareId: text('share_id').unique(),
		isOpen: integer('is_open', { mode: 'boolean' }).notNull().default(true),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('campaigns_keeper_idx').on(table.keeperUserId),
		index('campaigns_share_id_idx').on(table.shareId)
	]
);

/**
 * One row per (player, investigator) joined to a campaign. `leftAt` is a
 * soft-leave timestamp — kept nullable so a player can leave and re-join
 * without losing their roll history. Active membership = `leftAt IS NULL`.
 *
 * Uniqueness is enforced at the DB layer via *partial* unique indexes that
 * fire only on active rows (`WHERE left_at IS NULL`). The application-level
 * check in `joinCampaign` still runs first for clean error messages, but the
 * partial index closes the TOCTOU race between two parallel join requests
 * AND eliminates the "same user, two characters in the same campaign" hole
 * Codex flagged in adversarial review. Soft-leave + re-join still works
 * because a re-joined row reactivates the prior membership in-place rather
 * than inserting; a fresh insert during the same-user-still-active state
 * would collide on `campaign_members_user_active_uq`.
 */
export const campaignMembers = sqliteTable(
	'campaign_members',
	{
		id: text('id').primaryKey(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		investigatorId: text('investigator_id')
			.notNull()
			.references(() => investigators.id, { onDelete: 'cascade' }),
		joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull(),
		leftAt: integer('left_at', { mode: 'timestamp' })
	},
	(table) => [
		index('campaign_members_campaign_idx').on(table.campaignId),
		index('campaign_members_user_idx').on(table.userId),
		index('campaign_members_investigator_idx').on(table.investigatorId),
		// Partial unique: only at most one ACTIVE row per (campaign, investigator).
		// Same investigator can rejoin after leftAt is set; the active filter lets
		// the historical row sit alongside the new one.
		uniqueIndex('campaign_members_investigator_active_uq')
			.on(table.campaignId, table.investigatorId)
			.where(sql`left_at IS NULL`),
		// Partial unique: at most one ACTIVE row per (campaign, user) — codifies
		// the implicit assumption everywhere that one user has one current
		// investigator per campaign. The roll endpoint picks "the" membership
		// for the caller with .get(); without this constraint that choice is
		// non-deterministic when a user has multiple active rows.
		uniqueIndex('campaign_members_user_active_uq')
			.on(table.campaignId, table.userId)
			.where(sql`left_at IS NULL`)
	]
);

/**
 * Append-only unified roll log for a campaign. The `id` is a SQLite
 * autoincrement integer (ROWID-aliased) so it's strictly monotonic per
 * insert — clients use it as the cursor for `?since=<id>` polling. nanoid
 * PKs (which every other table uses) are random and unsuitable as an
 * ordering cursor.
 *
 * `userId` and `investigatorId` are nullable + set-null on delete so the
 * log survives user/investigator deletion. `investigatorName` is a
 * denormalised snapshot for display after the FK breaks (same pattern as
 * `adminAuditLog.actorEmail`).
 *
 * `entry` is a JSON-encoded `PlayRollHistoryEntry` from
 * `src/lib/types/character.ts` — covering percentile checks, weapon damage,
 * SAN, development rolls, generic dice, and the new `keeper-inventory`
 * variant.
 */
export const campaignRolls = sqliteTable(
	'campaign_rolls',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
		investigatorId: text('investigator_id').references(() => investigators.id, {
			onDelete: 'set null'
		}),
		investigatorName: text('investigator_name').notNull(),
		entry: text('entry').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [index('campaign_rolls_campaign_id_idx').on(table.campaignId, table.id)]
);

// ─── Analytics & audit ───────────────────────────────────────────

export const analyticsEvents = sqliteTable(
	'analytics_events',
	{
		id: text('id').primaryKey(),
		// Nullable + set-null on delete so analytics survive user deletion as anonymous events.
		userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
		/** 'login' | 'investigator_created' | 'pdf_generated' */
		eventType: text('event_type').notNull(),
		/** OAuth provider for 'login' events; null otherwise. */
		provider: text('provider'),
		/** Optional JSON-encoded metadata. */
		metadata: text('metadata'),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('analytics_events_type_created_idx').on(table.eventType, table.createdAt),
		index('analytics_events_user_idx').on(table.userId)
	]
);

export const adminAuditLog = sqliteTable(
	'admin_audit_log',
	{
		id: text('id').primaryKey(),
		// SET NULL + nullable so forensic history survives user deletion (account
		// merges, manual cleanup, future GDPR scoping). The actorEmail snapshot
		// keeps the row readable after the FK breaks.
		userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
		actorEmail: text('actor_email'),
		path: text('path').notNull(),
		method: text('method').notNull(),
		ip: text('ip'),
		userAgent: text('user_agent'),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('admin_audit_user_idx').on(table.userId),
		index('admin_audit_created_idx').on(table.createdAt)
	]
);
