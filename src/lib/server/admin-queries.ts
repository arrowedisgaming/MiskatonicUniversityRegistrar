import { and, desc, eq, gte, or, sql } from 'drizzle-orm';
import type { AppDb } from './db';
import { accounts, adminAuditLog, analyticsEvents, investigators, users } from './db/schema';

export interface OverviewStats {
	totalUsers: number;
	totalInvestigators: number;
	draftInvestigators: number;
	publishedInvestigators: number;
	archivedInvestigators: number;
	pdfsGenerated30d: number;
	logins30d: number;
	investigatorsCreated30d: number;
}

export interface ProviderBreakdownRow {
	provider: string;
	userCount: number;
}

export interface DailyEventCount {
	day: string; // YYYY-MM-DD
	count: number;
}

export interface AdminUserRow {
	id: string;
	email: string | null;
	name: string | null;
	image: string | null;
	investigatorCount: number;
	primaryProvider: string | null;
	lastLoginAt: Date | null;
}

export interface AdminInvestigatorRow {
	id: string;
	name: string;
	era: string;
	occupation: string;
	isDraft: boolean;
	isArchived: boolean;
	createdAt: Date;
	updatedAt: Date;
	ownerId: string;
	ownerEmail: string | null;
	ownerName: string | null;
}

export interface AdminAuditRow {
	id: string;
	userId: string | null;
	actorEmail: string | null;
	userEmail: string | null;
	path: string;
	method: string;
	ip: string | null;
	userAgent: string | null;
	createdAt: Date;
}

function daysAgo(days: number): Date {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - days);
	d.setUTCHours(0, 0, 0, 0);
	return d;
}

export async function getOverviewStats(db: AppDb): Promise<OverviewStats> {
	const since = daysAgo(30);

	const countEventSince = (et: 'pdf_generated' | 'login' | 'investigator_created') =>
		db
			.select({ c: sql<number>`count(*)` })
			.from(analyticsEvents)
			.where(and(eq(analyticsEvents.eventType, et), gte(analyticsEvents.createdAt, since)));

	const [userRows, investigatorRows, pdfRows, loginRows, createdRows] = await Promise.all([
		db.select({ c: sql<number>`count(*)` }).from(users),
		db
			.select({
				total: sql<number>`count(*)`,
				drafts: sql<number>`sum(case when ${investigators.isDraft} = 1 then 1 else 0 end)`,
				archived: sql<number>`sum(case when ${investigators.isArchived} = 1 then 1 else 0 end)`
			})
			.from(investigators),
		countEventSince('pdf_generated'),
		countEventSince('login'),
		countEventSince('investigator_created')
	]);

	const userCount = userRows[0];
	const inv = investigatorRows[0] ?? { total: 0, drafts: 0, archived: 0 };
	const pdfRow = pdfRows[0];
	const loginRow = loginRows[0];
	const createdRow = createdRows[0];

	const total = Number(inv.total ?? 0);
	const drafts = Number(inv.drafts ?? 0);
	const archived = Number(inv.archived ?? 0);
	return {
		totalUsers: Number(userCount?.c ?? 0),
		totalInvestigators: total,
		draftInvestigators: drafts,
		publishedInvestigators: Math.max(0, total - drafts - archived),
		archivedInvestigators: archived,
		pdfsGenerated30d: Number(pdfRow?.c ?? 0),
		logins30d: Number(loginRow?.c ?? 0),
		investigatorsCreated30d: Number(createdRow?.c ?? 0)
	};
}

export async function getProviderBreakdown(db: AppDb): Promise<ProviderBreakdownRow[]> {
	const rows = await db
		.select({
			provider: accounts.provider,
			userCount: sql<number>`count(distinct ${accounts.userId})`
		})
		.from(accounts)
		.groupBy(accounts.provider);
	return rows.map((r) => ({ provider: r.provider, userCount: Number(r.userCount ?? 0) }));
}

/**
 * Daily counts for an event type over the last `days` days, in UTC.
 * Fills in 0-count days so the sparkline has no gaps.
 *
 * Note: Drizzle `{ mode: 'timestamp' }` stores Unix **seconds** in SQLite, so
 * we feed `createdAt` straight into `strftime(..., 'unixepoch')` without the
 * /1000 conversion that would otherwise map every row to 1970.
 */
export async function getDailyEventCounts(
	db: AppDb,
	eventType: 'login' | 'investigator_created' | 'pdf_generated',
	days: number
): Promise<DailyEventCount[]> {
	const since = daysAgo(days - 1);
	const dayExpr = sql<string>`strftime('%Y-%m-%d', ${analyticsEvents.createdAt}, 'unixepoch')`;
	const rows = await db
		.select({
			day: dayExpr,
			count: sql<number>`count(*)`
		})
		.from(analyticsEvents)
		.where(
			and(eq(analyticsEvents.eventType, eventType), gte(analyticsEvents.createdAt, since))
		)
		.groupBy(dayExpr);

	const byDay = new Map(rows.map((r) => [r.day, Number(r.count ?? 0)]));
	const result: DailyEventCount[] = [];
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date();
		d.setUTCDate(d.getUTCDate() - i);
		d.setUTCHours(0, 0, 0, 0);
		const key = d.toISOString().slice(0, 10);
		result.push({ day: key, count: byDay.get(key) ?? 0 });
	}
	return result;
}

export interface ListOptions {
	search?: string;
	page?: number;
	pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function clampPagination(opts: ListOptions): { limit: number; offset: number; page: number } {
	const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE));
	const page = Math.max(1, opts.page ?? 1);
	return { limit: pageSize, offset: (page - 1) * pageSize, page };
}

/**
 * Escape SQLite LIKE wildcards so a search for `%` or `_` is treated as a
 * literal character rather than matching everything or any single char.
 * Pair every use with `ESCAPE '\\'` in the SQL fragment.
 */
function escapeLikePattern(s: string): string {
	return s.replace(/[\\%_]/g, '\\$&');
}

export async function listUsers(
	db: AppDb,
	opts: ListOptions = {}
): Promise<{ rows: AdminUserRow[]; total: number; page: number; pageSize: number }> {
	const { limit, offset, page } = clampPagination(opts);
	const search = opts.search?.trim().toLowerCase();
	const searchPattern = search ? `%${escapeLikePattern(search)}%` : null;

	const where = searchPattern
		? or(
				sql`lower(${users.email}) LIKE ${searchPattern} ESCAPE '\\'`,
				sql`lower(${users.name}) LIKE ${searchPattern} ESCAPE '\\'`
			)
		: undefined;

	const baseQuery = db
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			image: users.image,
			investigatorCount: sql<number>`(
				select count(*) from ${investigators}
				where ${investigators.userId} = ${users.id}
				  and ${investigators.isArchived} = 0
			)`,
			primaryProvider: sql<string | null>`(
				select ${accounts.provider} from ${accounts}
				where ${accounts.userId} = ${users.id}
				limit 1
			)`,
			lastLoginAt: sql<number | null>`(
				select max(${analyticsEvents.createdAt}) from ${analyticsEvents}
				where ${analyticsEvents.userId} = ${users.id}
				  and ${analyticsEvents.eventType} = 'login'
			)`
		})
		.from(users);

	const rows = await (where ? baseQuery.where(where) : baseQuery).limit(limit).offset(offset);

	const totalQuery = db.select({ c: sql<number>`count(*)` }).from(users);
	const [{ c: total }] = await (where ? totalQuery.where(where) : totalQuery);

	return {
		rows: rows.map((r) => ({
			id: r.id,
			email: r.email,
			name: r.name,
			image: r.image,
			investigatorCount: Number(r.investigatorCount ?? 0),
			primaryProvider: r.primaryProvider,
			// `max(created_at)` returns the raw SQLite integer (Unix seconds), not
			// a Drizzle-mapped Date — multiply to ms before constructing.
			lastLoginAt:
				r.lastLoginAt === null || r.lastLoginAt === undefined
					? null
					: new Date(Number(r.lastLoginAt) * 1000)
		})),
		total: Number(total ?? 0),
		page,
		pageSize: limit
	};
}

export interface ListInvestigatorsOptions extends ListOptions {
	userId?: string;
}

export async function listInvestigators(
	db: AppDb,
	opts: ListInvestigatorsOptions = {}
): Promise<{
	rows: AdminInvestigatorRow[];
	total: number;
	page: number;
	pageSize: number;
}> {
	const { limit, offset, page } = clampPagination(opts);
	const search = opts.search?.trim().toLowerCase();
	const searchPattern = search ? `%${escapeLikePattern(search)}%` : null;

	const conditions = [];
	if (opts.userId) conditions.push(eq(investigators.userId, opts.userId));
	if (searchPattern) {
		conditions.push(
			or(
				sql`lower(${investigators.name}) LIKE ${searchPattern} ESCAPE '\\'`,
				sql`lower(${users.email}) LIKE ${searchPattern} ESCAPE '\\'`
			)!
		);
	}
	const where = conditions.length ? and(...conditions) : undefined;

	const baseSelect = db
		.select({
			id: investigators.id,
			name: investigators.name,
			era: investigators.era,
			occupation: investigators.occupation,
			isDraft: investigators.isDraft,
			isArchived: investigators.isArchived,
			createdAt: investigators.createdAt,
			updatedAt: investigators.updatedAt,
			ownerId: investigators.userId,
			ownerEmail: users.email,
			ownerName: users.name
		})
		.from(investigators)
		.leftJoin(users, eq(users.id, investigators.userId));

	const rows = await (where ? baseSelect.where(where) : baseSelect)
		.orderBy(desc(investigators.updatedAt))
		.limit(limit)
		.offset(offset);

	const totalSelect = db
		.select({ c: sql<number>`count(*)` })
		.from(investigators)
		.leftJoin(users, eq(users.id, investigators.userId));
	const [{ c: total }] = await (where ? totalSelect.where(where) : totalSelect);

	return {
		rows: rows.map((r) => ({
			id: r.id,
			name: r.name,
			era: r.era,
			occupation: r.occupation,
			isDraft: r.isDraft,
			isArchived: r.isArchived,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
			ownerId: r.ownerId,
			ownerEmail: r.ownerEmail,
			ownerName: r.ownerName
		})),
		total: Number(total ?? 0),
		page,
		pageSize: limit
	};
}

export async function listRecentAudit(
	db: AppDb,
	opts: { limit?: number } = {}
): Promise<AdminAuditRow[]> {
	const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
	const rows = await db
		.select({
			id: adminAuditLog.id,
			userId: adminAuditLog.userId,
			actorEmail: adminAuditLog.actorEmail,
			userEmail: users.email,
			path: adminAuditLog.path,
			method: adminAuditLog.method,
			ip: adminAuditLog.ip,
			userAgent: adminAuditLog.userAgent,
			createdAt: adminAuditLog.createdAt
		})
		.from(adminAuditLog)
		.leftJoin(users, eq(users.id, adminAuditLog.userId))
		.orderBy(desc(adminAuditLog.createdAt))
		.limit(limit);
	return rows.map((r) => ({
		id: r.id,
		userId: r.userId,
		actorEmail: r.actorEmail,
		userEmail: r.userEmail,
		path: r.path,
		method: r.method,
		ip: r.ip,
		userAgent: r.userAgent,
		createdAt: r.createdAt
	}));
}
