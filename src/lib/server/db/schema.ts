import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

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
