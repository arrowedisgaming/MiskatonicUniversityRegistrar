import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { createBlankCharacter, type CoCCharacterData } from '$lib/types/character';
import type { AppDb } from '$lib/server/db';

export type TestDb = BetterSQLite3Database<typeof schema>;

/**
 * Spins up an in-memory SQLite with just enough tables to exercise the
 * campaign modules. Mirrors the pattern in investigator-share.test.ts so
 * future maintainers see consistent test scaffolding.
 *
 * NB: `campaign_rolls.id` is INTEGER PRIMARY KEY AUTOINCREMENT — the
 * monotonic cursor that the polling path relies on. Keep that exact
 * declaration in sync with src/lib/server/db/schema.ts.
 */
export function freshDb(): TestDb {
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

		CREATE TABLE campaigns (
			id text PRIMARY KEY NOT NULL,
			keeper_user_id text NOT NULL,
			name text NOT NULL DEFAULT '',
			description text NOT NULL DEFAULT '',
			share_id text,
			is_open integer NOT NULL DEFAULT 1,
			created_at integer NOT NULL,
			updated_at integer NOT NULL
		);
		CREATE UNIQUE INDEX campaigns_share_id_unique ON campaigns (share_id);

		CREATE TABLE campaign_members (
			id text PRIMARY KEY NOT NULL,
			campaign_id text NOT NULL,
			user_id text NOT NULL,
			investigator_id text NOT NULL,
			joined_at integer NOT NULL,
			left_at integer
		);
		-- Partial unique indexes match migration 0004. Keep these in sync with
		-- src/lib/server/db/schema.ts so tests catch real production failures.
		CREATE UNIQUE INDEX campaign_members_investigator_active_uq
			ON campaign_members (campaign_id, investigator_id)
			WHERE left_at IS NULL;
		CREATE UNIQUE INDEX campaign_members_user_active_uq
			ON campaign_members (campaign_id, user_id)
			WHERE left_at IS NULL;

		CREATE TABLE campaign_rolls (
			id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			campaign_id text NOT NULL,
			user_id text,
			investigator_id text,
			investigator_name text NOT NULL,
			entry text NOT NULL,
			created_at integer NOT NULL
		);
		CREATE INDEX campaign_rolls_campaign_id_idx ON campaign_rolls (campaign_id, id);
	`);
	return drizzle(sqlite, { schema });
}

/**
 * Structural cast: the test DB shape matches AppDb (both wrap a Drizzle
 * SQLite driver). The cast is contained here so individual tests stay
 * readable.
 */
export const asAppDb = (db: TestDb): AppDb => db as unknown as AppDb;

export interface InvestigatorFixture {
	id: string;
	userId: string;
	name?: string;
	isDraft?: boolean;
	isArchived?: boolean;
	customize?: (c: CoCCharacterData) => void;
	updatedAt?: Date;
}

export function insertInvestigator(db: TestDb, f: InvestigatorFixture): CoCCharacterData {
	const character = createBlankCharacter();
	character.name = f.name ?? 'Test Investigator';
	character.isDraft = f.isDraft ?? false;
	// Minimum viable non-draft character: any positive characteristics + a
	// custom occupation with 0 skill points. This is the bar set by
	// validateFinalInvestigator at src/lib/server/validation/investigator.ts
	// — needed when a test exercises code paths that re-validate the full
	// character (e.g. inventory.addItemsToMember).
	character.characteristics.values = {
		str: 50, con: 60, dex: 50, int: 50, pow: 50, app: 50, siz: 60, edu: 50
	};
	character.characteristics.baseValues = { ...character.characteristics.values };
	character.occupation = {
		occupationId: 'custom',
		formulaChoices: {},
		customName: 'Investigator',
		customSkillPoints: 0,
		customOccupationSkills: []
	};
	// Derived values match validateFinalInvestigator's recomputation:
	//   HP max = (CON + SIZ) / 10 = (60+60)/10 = 12
	//   MP max = POW / 5 = 10
	//   Sanity starting/max = POW = 50; current ≤ max
	//   Luck rolled separately; current ≤ max
	character.derivedStats.hp = { max: 12, current: 7 };
	character.derivedStats.mp = { max: 10, current: 10 };
	character.derivedStats.sanity = { max: 99, current: 41, startingValue: 50 };
	character.derivedStats.luck = { max: 50, current: 40, rolls: null };
	f.customize?.(character);
	const now = f.updatedAt ?? new Date();
	db.insert(schema.investigators)
		.values({
			id: f.id,
			userId: f.userId,
			name: character.name,
			era: '1920s',
			mode: 'standard',
			occupation: '',
			data: JSON.stringify(character),
			isDraft: character.isDraft,
			isArchived: f.isArchived ?? false,
			shareId: null,
			isPublic: false,
			createdAt: now,
			updatedAt: now
		})
		.run();
	return character;
}

export function insertCampaign(
	db: TestDb,
	params: {
		id: string;
		keeperUserId: string;
		name?: string;
		isOpen?: boolean;
		shareId?: string | null;
	}
) {
	const now = new Date();
	db.insert(schema.campaigns)
		.values({
			id: params.id,
			keeperUserId: params.keeperUserId,
			name: params.name ?? 'A Campaign',
			description: '',
			shareId: params.shareId ?? null,
			isOpen: params.isOpen ?? true,
			createdAt: now,
			updatedAt: now
		})
		.run();
}

export function insertMembership(
	db: TestDb,
	params: {
		id: string;
		campaignId: string;
		userId: string;
		investigatorId: string;
		leftAt?: Date | null;
	}
) {
	db.insert(schema.campaignMembers)
		.values({
			id: params.id,
			campaignId: params.campaignId,
			userId: params.userId,
			investigatorId: params.investigatorId,
			joinedAt: new Date(),
			leftAt: params.leftAt ?? null
		})
		.run();
}
