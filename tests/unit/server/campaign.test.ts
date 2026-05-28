import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import {
	asAppDb,
	freshDb,
	insertCampaign,
	insertInvestigator,
	insertMembership,
	type TestDb
} from './campaign-fixtures';
import {
	assertCampaignKeeper,
	assertCampaignMember,
	resolveCampaignRole
} from '$lib/server/campaign/auth';
import {
	createCampaign,
	getCampaignForUser,
	listCampaignsForUser
} from '$lib/server/campaign/campaign';
import {
	CAMPAIGN_SHARE_ID_LENGTH,
	disableCampaignShare,
	enableCampaignShare,
	listJoinableInvestigators,
	resolveCampaignByShareId
} from '$lib/server/campaign/share';
import {
	joinCampaign,
	leaveCampaign,
	listActiveMembershipsForInvestigator,
	removeMember
} from '$lib/server/campaign/membership';
import {
	appendCampaignRoll,
	listCampaignRolls,
	summarizeCampaignDashboard
} from '$lib/server/campaign/rolls';
import { addItemsToMember } from '$lib/server/campaign/inventory';
import type { PlayRollHistoryGenericDiceEntry } from '$lib/types/character';

const KEEPER = 'keeper-user-id-001';
const PLAYER = 'player-user-id-001';
const OTHER = 'other-user-id-001';

function diceEntry(label: string): PlayRollHistoryGenericDiceEntry {
	return {
		id: `roll-${label}`,
		at: new Date().toISOString(),
		targetKind: 'genericDice',
		sides: 6,
		count: 1,
		modifier: 0,
		rolls: [3],
		total: 3,
		label
	};
}

// ─── Auth ────────────────────────────────────────────────────────

describe('campaign auth', () => {
	let db: TestDb;
	beforeEach(() => {
		db = freshDb();
		insertCampaign(db, { id: 'c-1', keeperUserId: KEEPER });
		insertInvestigator(db, { id: 'inv-1', userId: PLAYER });
		insertMembership(db, {
			id: 'm-1',
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
	});

	it('resolveCampaignRole returns keeper / player / none / null', async () => {
		expect(await resolveCampaignRole(asAppDb(db), { userId: KEEPER, campaignId: 'c-1' })).toBe(
			'keeper'
		);
		expect(await resolveCampaignRole(asAppDb(db), { userId: PLAYER, campaignId: 'c-1' })).toBe(
			'player'
		);
		expect(await resolveCampaignRole(asAppDb(db), { userId: OTHER, campaignId: 'c-1' })).toBe(
			'none'
		);
		expect(await resolveCampaignRole(asAppDb(db), { userId: KEEPER, campaignId: 'missing' })).toBe(
			null
		);
	});

	it('player is no longer a member after leftAt is set', async () => {
		db.update(schema.campaignMembers)
			.set({ leftAt: new Date() })
			.where(eq(schema.campaignMembers.id, 'm-1'))
			.run();
		expect(await resolveCampaignRole(asAppDb(db), { userId: PLAYER, campaignId: 'c-1' })).toBe(
			'none'
		);
	});

	it('assertCampaignKeeper rejects players with 403, missing campaigns with 404', async () => {
		expect(
			await assertCampaignKeeper(asAppDb(db), { userId: PLAYER, campaignId: 'c-1' })
		).toEqual({ ok: false, status: 403, message: 'Keeper only' });
		expect(
			await assertCampaignKeeper(asAppDb(db), { userId: KEEPER, campaignId: 'missing' })
		).toEqual({ ok: false, status: 404, message: 'Campaign not found' });
	});

	it('assertCampaignMember rejects non-members with 403', async () => {
		const r = await assertCampaignMember(asAppDb(db), { userId: OTHER, campaignId: 'c-1' });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.status).toBe(403);
	});
});

// ─── Campaign CRUD + listing ─────────────────────────────────────

describe('campaign CRUD', () => {
	let db: TestDb;
	beforeEach(() => {
		db = freshDb();
	});

	it('createCampaign inserts a row with a nanoid id and the user as keeper', async () => {
		const { id } = await createCampaign(asAppDb(db), {
			keeperUserId: KEEPER,
			name: 'Masks of Nyarlathotep'
		});
		const row = db
			.select()
			.from(schema.campaigns)
			.where(eq(schema.campaigns.id, id))
			.get();
		expect(row?.keeperUserId).toBe(KEEPER);
		expect(row?.name).toBe('Masks of Nyarlathotep');
		expect(row?.isOpen).toBe(true);
		expect(row?.shareId).toBeNull();
	});

	it('listCampaignsForUser merges keeper + player rows, de-duplicates, counts members', async () => {
		insertCampaign(db, { id: 'c-keep', keeperUserId: PLAYER, name: 'I keep this' });
		insertCampaign(db, { id: 'c-play', keeperUserId: KEEPER, name: 'I play in this' });
		insertCampaign(db, { id: 'c-keep-too', keeperUserId: PLAYER, name: 'I also keep this' });
		insertInvestigator(db, { id: 'inv-a', userId: PLAYER });
		insertInvestigator(db, { id: 'inv-other', userId: OTHER });
		insertMembership(db, {
			id: 'm-1',
			campaignId: 'c-play',
			userId: PLAYER,
			investigatorId: 'inv-a'
		});
		insertMembership(db, {
			id: 'm-2',
			campaignId: 'c-play',
			userId: OTHER,
			investigatorId: 'inv-other'
		});

		const rows = await listCampaignsForUser(asAppDb(db), PLAYER);
		const byId = new Map(rows.map((r) => [r.id, r] as const));
		expect(byId.get('c-keep')?.role).toBe('keeper');
		expect(byId.get('c-keep-too')?.role).toBe('keeper');
		expect(byId.get('c-play')?.role).toBe('player');
		expect(byId.get('c-play')?.memberCount).toBe(2);
		expect(rows).toHaveLength(3);
	});

	it('getCampaignForUser returns 404 for outsiders even if the campaign exists', async () => {
		insertCampaign(db, { id: 'c-1', keeperUserId: KEEPER });
		const r = await getCampaignForUser(asAppDb(db), { campaignId: 'c-1', userId: OTHER });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.status).toBe(403);
	});
});

// ─── Share tokens ────────────────────────────────────────────────

describe('campaign share', () => {
	let db: TestDb;
	beforeEach(() => {
		db = freshDb();
		insertCampaign(db, { id: 'c-1', keeperUserId: KEEPER });
	});

	it('enableCampaignShare sets a token of the documented length on the keeper-owned campaign', async () => {
		const r = await enableCampaignShare(asAppDb(db), { campaignId: 'c-1', userId: KEEPER });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.shareId).toHaveLength(CAMPAIGN_SHARE_ID_LENGTH);
		const row = db
			.select({ shareId: schema.campaigns.shareId })
			.from(schema.campaigns)
			.where(eq(schema.campaigns.id, 'c-1'))
			.get();
		expect(row?.shareId).toBe(r.shareId);
	});

	it('non-keeper cannot enable share (403)', async () => {
		const r = await enableCampaignShare(asAppDb(db), { campaignId: 'c-1', userId: PLAYER });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.status).toBe(403);
	});

	it('rotates token on second call — old token no longer resolves', async () => {
		const first = await enableCampaignShare(asAppDb(db), { campaignId: 'c-1', userId: KEEPER });
		const second = await enableCampaignShare(asAppDb(db), { campaignId: 'c-1', userId: KEEPER });
		if (!first.ok || !second.ok) throw new Error('expected ok');
		expect(second.shareId).not.toBe(first.shareId);
		expect(await resolveCampaignByShareId(asAppDb(db), first.shareId)).toEqual({
			ok: false,
			status: 404,
			message: 'Campaign not found'
		});
		const live = await resolveCampaignByShareId(asAppDb(db), second.shareId);
		expect(live.ok).toBe(true);
	});

	it('retries on a collision and succeeds on the second attempt', async () => {
		// Park a campaign already holding the colliding token.
		insertCampaign(db, { id: 'c-other', keeperUserId: OTHER, shareId: 'collide-token-aaaa' });

		let calls = 0;
		const generate = () => {
			calls++;
			return calls === 1 ? 'collide-token-aaaa' : 'fresh-token-bbbbbb';
		};

		const r = await enableCampaignShare(
			asAppDb(db),
			{ campaignId: 'c-1', userId: KEEPER },
			new Date(),
			generate
		);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.shareId).toBe('fresh-token-bbbbbb');
		expect(calls).toBe(2);
	});

	it('gives up after retry budget with 500 when collisions persist', async () => {
		insertCampaign(db, { id: 'c-other', keeperUserId: OTHER, shareId: 'always-collide' });
		const r = await enableCampaignShare(
			asAppDb(db),
			{ campaignId: 'c-1', userId: KEEPER },
			new Date(),
			() => 'always-collide'
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.status).toBe(500);
	});

	it('disableCampaignShare is idempotent and 403 for non-keepers', async () => {
		expect(
			(await disableCampaignShare(asAppDb(db), { campaignId: 'c-1', userId: KEEPER })).ok
		).toBe(true);
		// idempotent
		expect(
			(await disableCampaignShare(asAppDb(db), { campaignId: 'c-1', userId: KEEPER })).ok
		).toBe(true);

		await enableCampaignShare(asAppDb(db), { campaignId: 'c-1', userId: KEEPER });
		const blocked = await disableCampaignShare(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER
		});
		expect(blocked.ok).toBe(false);
		if (!blocked.ok) expect(blocked.status).toBe(403);
	});

	it('resolveCampaignByShareId only returns open campaigns', async () => {
		const enabled = await enableCampaignShare(asAppDb(db), {
			campaignId: 'c-1',
			userId: KEEPER
		});
		if (!enabled.ok) throw new Error('expected ok');

		// Closing the campaign hides it from the lookup even though the token stays.
		db.update(schema.campaigns)
			.set({ isOpen: false })
			.where(eq(schema.campaigns.id, 'c-1'))
			.run();
		expect(await resolveCampaignByShareId(asAppDb(db), enabled.shareId)).toEqual({
			ok: false,
			status: 404,
			message: 'Campaign not found'
		});
	});

	it('listJoinableInvestigators excludes drafts, archived, and already-joined characters', async () => {
		insertInvestigator(db, { id: 'inv-finished', userId: PLAYER, name: 'OK' });
		insertInvestigator(db, { id: 'inv-draft', userId: PLAYER, isDraft: true, name: 'Draft' });
		insertInvestigator(db, {
			id: 'inv-archived',
			userId: PLAYER,
			isArchived: true,
			name: 'Archived'
		});
		insertInvestigator(db, { id: 'inv-in-campaign', userId: PLAYER, name: 'Already here' });
		insertMembership(db, {
			id: 'm-already',
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-in-campaign'
		});

		const offered = await listJoinableInvestigators(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER
		});
		expect(offered.map((o) => o.id)).toEqual(['inv-finished']);
	});
});

// ─── Membership ──────────────────────────────────────────────────

describe('campaign membership', () => {
	let db: TestDb;
	beforeEach(() => {
		db = freshDb();
		insertCampaign(db, { id: 'c-1', keeperUserId: KEEPER });
		insertInvestigator(db, { id: 'inv-1', userId: PLAYER });
	});

	it('joinCampaign happy path inserts an active membership', async () => {
		const r = await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
		expect(r.ok).toBe(true);
		const rows = db
			.select()
			.from(schema.campaignMembers)
			.where(eq(schema.campaignMembers.campaignId, 'c-1'))
			.all();
		expect(rows).toHaveLength(1);
		expect(rows[0].leftAt).toBeNull();
		expect(rows[0].userId).toBe(PLAYER);
	});

	it('rejects drafts with 409', async () => {
		insertInvestigator(db, { id: 'inv-draft', userId: PLAYER, isDraft: true });
		const r = await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-draft'
		});
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.status).toBe(409);
			expect(r.message.toLowerCase()).toContain('draft');
		}
	});

	it('rejects foreign investigators with 403', async () => {
		insertInvestigator(db, { id: 'inv-elsewhere', userId: OTHER });
		const r = await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-elsewhere'
		});
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.status).toBe(403);
	});

	it('rejects archived investigators with 409', async () => {
		insertInvestigator(db, { id: 'inv-arch', userId: PLAYER, isArchived: true });
		const r = await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-arch'
		});
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.status).toBe(409);
	});

	it('rejects closed campaigns with 403', async () => {
		db.update(schema.campaigns)
			.set({ isOpen: false })
			.where(eq(schema.campaigns.id, 'c-1'))
			.run();
		const r = await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.status).toBe(403);
	});

	it('rejects duplicate active membership with 409', async () => {
		await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
		const r = await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.status).toBe(409);
	});

	it('soft-leave then rejoin reactivates the original membership row', async () => {
		const first = await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
		if (!first.ok) throw new Error('expected ok');

		const left = await leaveCampaign(asAppDb(db), { campaignId: 'c-1', userId: PLAYER });
		expect(left.ok).toBe(true);

		const second = await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
		expect(second.ok).toBe(true);
		if (!second.ok) return;
		expect(second.memberId).toBe(first.memberId); // same row, reactivated

		const rows = db.select().from(schema.campaignMembers).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].leftAt).toBeNull();
	});

	it('removeMember soft-leaves the player but only when called by the keeper', async () => {
		const join = await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
		if (!join.ok) throw new Error('expected ok');

		const blocked = await removeMember(asAppDb(db), {
			campaignId: 'c-1',
			memberId: join.memberId,
			keeperUserId: PLAYER
		});
		expect(blocked.ok).toBe(false);
		if (!blocked.ok) expect(blocked.status).toBe(403);

		const ok = await removeMember(asAppDb(db), {
			campaignId: 'c-1',
			memberId: join.memberId,
			keeperUserId: KEEPER
		});
		expect(ok.ok).toBe(true);

		const row = db
			.select()
			.from(schema.campaignMembers)
			.where(eq(schema.campaignMembers.id, join.memberId))
			.get();
		expect(row?.leftAt).not.toBeNull();
	});

	it('rejects a user trying to join with a SECOND investigator while still active (one per campaign)', async () => {
		insertInvestigator(db, { id: 'inv-2', userId: PLAYER });
		const first = await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
		expect(first.ok).toBe(true);

		const second = await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-2'
		});
		expect(second.ok).toBe(false);
		if (!second.ok) {
			expect(second.status).toBe(409);
			expect(second.message.toLowerCase()).toContain('already have an active investigator');
		}

		// After leaving the first, joining with a different investigator should succeed.
		await leaveCampaign(asAppDb(db), { campaignId: 'c-1', userId: PLAYER });
		const third = await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-2'
		});
		expect(third.ok).toBe(true);
	});

	it('partial unique index rejects a second active row even when app checks are bypassed (concurrent-join guard)', async () => {
		// Simulate two concurrent join requests by performing the read-check
		// once then attempting two raw inserts — emulating the TOCTOU window
		// the partial index is there to close.
		insertInvestigator(db, { id: 'inv-other', userId: OTHER });
		const stamp = new Date();
		// First insert: same user, active.
		db.insert(schema.campaignMembers)
			.values({
				id: 'race-a',
				campaignId: 'c-1',
				userId: PLAYER,
				investigatorId: 'inv-1',
				joinedAt: stamp,
				leftAt: null
			})
			.run();
		// Second insert collides on (campaign_id, user_id) WHERE left_at IS NULL.
		expect(() =>
			db
				.insert(schema.campaignMembers)
				.values({
					id: 'race-b',
					campaignId: 'c-1',
					userId: PLAYER,
					investigatorId: 'inv-other',
					joinedAt: stamp,
					leftAt: null
				})
				.run()
		).toThrow(/UNIQUE constraint failed/);
	});

	it('partial unique index allows historical (left) rows to coexist with a new active row', async () => {
		insertInvestigator(db, { id: 'inv-2', userId: PLAYER });
		const now = new Date();
		db.insert(schema.campaignMembers)
			.values({
				id: 'mem-old',
				campaignId: 'c-1',
				userId: PLAYER,
				investigatorId: 'inv-1',
				joinedAt: new Date(now.getTime() - 60_000),
				leftAt: now
			})
			.run();
		// A new active row for the same user but a different investigator must succeed,
		// because the partial unique index only constrains active (leftAt IS NULL) rows.
		expect(() =>
			db
				.insert(schema.campaignMembers)
				.values({
					id: 'mem-new',
					campaignId: 'c-1',
					userId: PLAYER,
					investigatorId: 'inv-2',
					joinedAt: now,
					leftAt: null
				})
				.run()
		).not.toThrow();
	});

	it('listActiveMembershipsForInvestigator excludes left memberships', async () => {
		insertCampaign(db, { id: 'c-2', keeperUserId: KEEPER });
		await joinCampaign(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
		await joinCampaign(asAppDb(db), {
			campaignId: 'c-2',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
		await leaveCampaign(asAppDb(db), { campaignId: 'c-2', userId: PLAYER });

		const active = await listActiveMembershipsForInvestigator(asAppDb(db), {
			investigatorId: 'inv-1'
		});
		expect(active.map((a) => a.campaignId)).toEqual(['c-1']);
	});
});

// ─── Rolls ───────────────────────────────────────────────────────

describe('campaign rolls', () => {
	let db: TestDb;
	beforeEach(() => {
		db = freshDb();
		insertCampaign(db, { id: 'c-1', keeperUserId: KEEPER });
		insertInvestigator(db, { id: 'inv-1', userId: PLAYER, name: 'Sarah' });
		insertMembership(db, {
			id: 'm-1',
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
	});

	it('appendCampaignRoll assigns a monotonically-increasing id', async () => {
		const a = await appendCampaignRoll(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1',
			investigatorName: 'Sarah',
			entry: diceEntry('a')
		});
		const b = await appendCampaignRoll(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1',
			investigatorName: 'Sarah',
			entry: diceEntry('b')
		});
		expect(b.id).toBeGreaterThan(a.id);
	});

	it('listCampaignRolls returns DESC by id, honors integer since cursor, caps limit', async () => {
		const ids: number[] = [];
		for (let i = 0; i < 5; i++) {
			const r = await appendCampaignRoll(asAppDb(db), {
				campaignId: 'c-1',
				userId: PLAYER,
				investigatorId: 'inv-1',
				investigatorName: 'Sarah',
				entry: diceEntry(`r-${i}`)
			});
			ids.push(r.id);
		}

		const newest = await listCampaignRolls(asAppDb(db), { campaignId: 'c-1', limit: 3 });
		expect(newest.map((r) => r.id)).toEqual([ids[4], ids[3], ids[2]]);

		const since = await listCampaignRolls(asAppDb(db), { campaignId: 'c-1', since: ids[2] });
		expect(since.map((r) => r.id)).toEqual([ids[4], ids[3]]);
	});

	it('listCampaignRolls is campaign-scoped and round-trips the JSON entry', async () => {
		insertCampaign(db, { id: 'c-other', keeperUserId: OTHER });
		await appendCampaignRoll(asAppDb(db), {
			campaignId: 'c-other',
			userId: OTHER,
			investigatorId: null,
			investigatorName: 'someone-else',
			entry: diceEntry('elsewhere')
		});
		await appendCampaignRoll(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1',
			investigatorName: 'Sarah',
			entry: diceEntry('here')
		});
		const r = await listCampaignRolls(asAppDb(db), { campaignId: 'c-1' });
		expect(r).toHaveLength(1);
		expect(r[0].entry.targetKind).toBe('genericDice');
		expect((r[0].entry as PlayRollHistoryGenericDiceEntry).label).toBe('here');
	});
});

// ─── Dashboard summarizer ────────────────────────────────────────

describe('summarizeCampaignDashboard', () => {
	let db: TestDb;
	beforeEach(() => {
		db = freshDb();
		insertCampaign(db, { id: 'c-1', keeperUserId: KEEPER });
	});

	it('returns one row per active member with vitals straight from saved JSON', async () => {
		insertInvestigator(db, {
			id: 'inv-a',
			userId: PLAYER,
			name: 'Sarah',
			customize: (c) => {
				c.derivedStats.hp = { max: 12, current: 7 };
				c.derivedStats.sanity = { max: 99, current: 41, startingValue: 55 };
			}
		});
		insertMembership(db, {
			id: 'm-a',
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-a'
		});

		const vitals = await summarizeCampaignDashboard(asAppDb(db), 'c-1');
		expect(vitals).toHaveLength(1);
		expect(vitals[0].investigatorName).toBe('Sarah');
		expect(vitals[0].hp.current).toBe(7);
		expect(vitals[0].sanity.current).toBe(41);
		expect(vitals[0].lastRoll).toBeNull();
	});

	it('excludes archived investigators (regression — they must not appear once archived)', async () => {
		insertInvestigator(db, { id: 'inv-a', userId: PLAYER, isArchived: true });
		insertMembership(db, {
			id: 'm-a',
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-a'
		});
		const vitals = await summarizeCampaignDashboard(asAppDb(db), 'c-1');
		expect(vitals).toHaveLength(0);
	});

	it('excludes members who have left', async () => {
		insertInvestigator(db, { id: 'inv-a', userId: PLAYER });
		insertMembership(db, {
			id: 'm-a',
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-a',
			leftAt: new Date()
		});
		const vitals = await summarizeCampaignDashboard(asAppDb(db), 'c-1');
		expect(vitals).toHaveLength(0);
	});

	it('marks belongsToCaller true only for the row owned by the supplied caller user id', async () => {
		insertInvestigator(db, { id: 'inv-mine', userId: PLAYER });
		insertInvestigator(db, { id: 'inv-other', userId: OTHER });
		insertMembership(db, {
			id: 'm-mine',
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-mine'
		});
		insertMembership(db, {
			id: 'm-other',
			campaignId: 'c-1',
			userId: OTHER,
			investigatorId: 'inv-other'
		});

		const asPlayer = await summarizeCampaignDashboard(asAppDb(db), 'c-1', PLAYER);
		const playerView = new Map(asPlayer.map((v) => [v.memberId, v.belongsToCaller] as const));
		expect(playerView.get('m-mine')).toBe(true);
		expect(playerView.get('m-other')).toBe(false);

		const asKeeper = await summarizeCampaignDashboard(asAppDb(db), 'c-1', KEEPER);
		const keeperView = new Map(asKeeper.map((v) => [v.memberId, v.belongsToCaller] as const));
		expect(keeperView.get('m-mine')).toBe(false);
		expect(keeperView.get('m-other')).toBe(false);

		// null callerUserId means "no caller context" — defensive default for
		// admin tooling and similar; no row should be marked as belonging.
		const anonymous = await summarizeCampaignDashboard(asAppDb(db), 'c-1', null);
		expect(anonymous.every((v) => v.belongsToCaller === false)).toBe(true);
	});

	it('attaches the latest roll per member', async () => {
		insertInvestigator(db, { id: 'inv-a', userId: PLAYER, name: 'Sarah' });
		insertMembership(db, {
			id: 'm-a',
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-a'
		});
		await appendCampaignRoll(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-a',
			investigatorName: 'Sarah',
			entry: diceEntry('old')
		});
		await appendCampaignRoll(asAppDb(db), {
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-a',
			investigatorName: 'Sarah',
			entry: diceEntry('newest')
		});
		const v = await summarizeCampaignDashboard(asAppDb(db), 'c-1');
		expect((v[0].lastRoll as PlayRollHistoryGenericDiceEntry).label).toBe('newest');
	});
});

// ─── Inventory push (concurrency-critical) ───────────────────────

describe('addItemsToMember', () => {
	let db: TestDb;
	let updatedAt: number;
	beforeEach(() => {
		db = freshDb();
		insertCampaign(db, { id: 'c-1', keeperUserId: KEEPER });
		insertInvestigator(db, { id: 'inv-1', userId: PLAYER, name: 'Sarah' });
		// Read the stored value back so we capture exactly what Drizzle's
		// `mode: 'timestamp'` (second-precision) actually persisted. In
		// production the dashboard summary read produces this same value and
		// the UI round-trips it as expectedUpdatedAt, so this mirrors real flow.
		const persisted = db
			.select({ updatedAt: schema.investigators.updatedAt })
			.from(schema.investigators)
			.where(eq(schema.investigators.id, 'inv-1'))
			.get();
		updatedAt = persisted!.updatedAt.getTime();
		insertMembership(db, {
			id: 'm-1',
			campaignId: 'c-1',
			userId: PLAYER,
			investigatorId: 'inv-1'
		});
	});

	it('happy path appends a weapon, advances updatedAt, and logs a keeperInventory roll', async () => {
		const r = await addItemsToMember(asAppDb(db), {
			campaignId: 'c-1',
			memberId: 'm-1',
			keeperUserId: KEEPER,
			keeperDisplayName: 'Henry',
			delta: {
				weapons: [
					{
						name: '.38 Revolver',
						damage: '1d10',
						range: '15/30/60',
						attacksPerRound: '1',
						ammo: 6,
						malfunction: 100
					}
				]
			},
			expectedUpdatedAt: updatedAt
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.newUpdatedAt).toBeGreaterThan(updatedAt);

		const row = db
			.select({ data: schema.investigators.data, updatedAt: schema.investigators.updatedAt })
			.from(schema.investigators)
			.where(eq(schema.investigators.id, 'inv-1'))
			.get();
		const parsed = JSON.parse(row!.data);
		expect(parsed.equipment.weapons.map((w: { name: string }) => w.name)).toContain('.38 Revolver');
		expect(row!.updatedAt.getTime()).toBe(r.newUpdatedAt);

		const rolls = await listCampaignRolls(asAppDb(db), { campaignId: 'c-1' });
		expect(rolls).toHaveLength(1);
		expect(rolls[0].entry.targetKind).toBe('keeperInventory');
	});

	it('returns 409 with currentUpdatedAt when the player has saved in the meantime', async () => {
		// Player save bumps updatedAt
		const newerStamp = new Date(updatedAt + 5000);
		db.update(schema.investigators)
			.set({ updatedAt: newerStamp })
			.where(eq(schema.investigators.id, 'inv-1'))
			.run();

		const r = await addItemsToMember(asAppDb(db), {
			campaignId: 'c-1',
			memberId: 'm-1',
			keeperUserId: KEEPER,
			keeperDisplayName: 'Henry',
			delta: { items: [{ name: 'Lantern', quantity: 1, notes: '' }] },
			expectedUpdatedAt: updatedAt
		});
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.status).toBe(409);
		expect(r.currentUpdatedAt).toBe(newerStamp.getTime());
	});

	it('non-keeper push is rejected with 403', async () => {
		const r = await addItemsToMember(asAppDb(db), {
			campaignId: 'c-1',
			memberId: 'm-1',
			keeperUserId: PLAYER,
			keeperDisplayName: 'self',
			delta: { items: [{ name: 'Lantern', quantity: 1, notes: '' }] },
			expectedUpdatedAt: updatedAt
		});
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.status).toBe(403);
	});

	it('cross-campaign tampering blocked — memberId from another campaign returns 404', async () => {
		insertCampaign(db, { id: 'c-other', keeperUserId: KEEPER });
		const r = await addItemsToMember(asAppDb(db), {
			campaignId: 'c-other',
			memberId: 'm-1', // belongs to c-1
			keeperUserId: KEEPER,
			keeperDisplayName: 'Henry',
			delta: { items: [{ name: 'X', quantity: 1, notes: '' }] },
			expectedUpdatedAt: updatedAt
		});
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.status).toBe(404);
	});

	it('empty delta is rejected with 400 — no silent no-op writes', async () => {
		const r = await addItemsToMember(asAppDb(db), {
			campaignId: 'c-1',
			memberId: 'm-1',
			keeperUserId: KEEPER,
			keeperDisplayName: 'Henry',
			delta: { weapons: [], items: [], cashDelta: 0 },
			expectedUpdatedAt: updatedAt
		});
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.status).toBe(400);
	});

	it('lost-update regression: two parallel pushes with same expectedUpdatedAt — exactly one wins', async () => {
		const [a, b] = await Promise.all([
			addItemsToMember(asAppDb(db), {
				campaignId: 'c-1',
				memberId: 'm-1',
				keeperUserId: KEEPER,
				keeperDisplayName: 'Henry',
				delta: { items: [{ name: 'A', quantity: 1, notes: '' }] },
				expectedUpdatedAt: updatedAt
			}),
			addItemsToMember(asAppDb(db), {
				campaignId: 'c-1',
				memberId: 'm-1',
				keeperUserId: KEEPER,
				keeperDisplayName: 'Henry',
				delta: { items: [{ name: 'B', quantity: 1, notes: '' }] },
				expectedUpdatedAt: updatedAt
			})
		]);
		const okCount = [a, b].filter((r) => r.ok).length;
		const conflictCount = [a, b].filter((r) => !r.ok && r.status === 409).length;
		expect(okCount).toBe(1);
		expect(conflictCount).toBe(1);

		const row = db
			.select({ data: schema.investigators.data })
			.from(schema.investigators)
			.where(eq(schema.investigators.id, 'inv-1'))
			.get();
		const items = JSON.parse(row!.data).equipment.items as Array<{ name: string }>;
		expect(items).toHaveLength(1);
		expect(['A', 'B']).toContain(items[0].name);
	});
});
