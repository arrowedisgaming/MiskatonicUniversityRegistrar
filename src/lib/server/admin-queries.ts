import { and, asc, desc, eq, gte, or, sql, type AnyColumn, type SQLWrapper } from 'drizzle-orm';
import type { AppDb } from './db';
import { accounts, adminAuditLog, analyticsEvents, investigators, users } from './db/schema';

export type SortDir = 'asc' | 'desc';

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
	/** Non-archived investigator count. */
	investigatorCount: number;
	/** All investigators including archived. */
	totalInvestigatorCount: number;
	primaryProvider: string | null;
	lastActivityAt: Date | null;
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

/** Map raw SQLite unix-second integer to Date (for max() subquery results). */
function unixSecondsToDate(raw: number | null | undefined): Date | null {
	if (raw === null || raw === undefined) return null;
	return new Date(Number(raw) * 1000);
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
	sort?: string;
	dir?: SortDir;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const USER_SORT_KEYS = ['email', 'name', 'provider', 'investigators', 'lastActivity'] as const;
const INVESTIGATOR_SORT_KEYS = [
	'name',
	'owner',
	'era',
	'occupation',
	'status',
	'created',
	'updated'
] as const;
const AUDIT_SORT_KEYS = ['when', 'who', 'method', 'path', 'ip'] as const;

export function parseListSort(
	sort: string | null | undefined,
	dir: string | null | undefined,
	whitelist: readonly string[],
	defaultSort: string
): { sort: string; dir: SortDir } {
	const sortKey = sort && whitelist.includes(sort) ? sort : defaultSort;
	return { sort: sortKey, dir: dir === 'asc' ? 'asc' : 'desc' };
}

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

function orderByDir(expr: SQLWrapper | AnyColumn, dir: SortDir) {
	return dir === 'asc' ? asc(expr) : desc(expr);
}

/** Drizzle expands `${users.id}` inside subqueries to bare `"id"`, which SQLite binds to the inner table — qualify explicitly. */
const USER_ID_CORR = sql.raw('"users"."id"');

/** Shared subqueries for listUsers select and orderBy. */
function userListSubqueries() {
	const activeInvCount = sql<number>`(
		select count(*) from ${investigators}
		where ${investigators.userId} = ${USER_ID_CORR}
		  and ${investigators.isArchived} = 0
	)`;
	const totalInvCount = sql<number>`(
		select count(*) from ${investigators}
		where ${investigators.userId} = ${USER_ID_CORR}
	)`;
	const primaryProvider = sql<string | null>`coalesce(
		(select ${accounts.provider} from ${accounts}
		 where ${accounts.userId} = ${USER_ID_CORR} limit 1),
		(select ${analyticsEvents.provider} from ${analyticsEvents}
		 where ${analyticsEvents.userId} = ${USER_ID_CORR}
		   and ${analyticsEvents.eventType} = 'login'
		   and ${analyticsEvents.provider} is not null
		 order by ${analyticsEvents.createdAt} desc limit 1)
	)`;
	const lastActivityAt = sql<number | null>`(
		select max(ts) from (
			select max(${analyticsEvents.createdAt}) as ts from ${analyticsEvents}
			where ${analyticsEvents.userId} = ${USER_ID_CORR}
			union all
			select max(${investigators.updatedAt}) as ts from ${investigators}
			where ${investigators.userId} = ${USER_ID_CORR}
		)
	)`;
	return { activeInvCount, totalInvCount, primaryProvider, lastActivityAt };
}

function userOrderBy(sort: string, dir: SortDir) {
	const { activeInvCount, primaryProvider, lastActivityAt } = userListSubqueries();
	switch (sort) {
		case 'email':
			return orderByDir(users.email, dir);
		case 'name':
			return orderByDir(users.name, dir);
		case 'provider':
			return orderByDir(primaryProvider, dir);
		case 'investigators':
			return orderByDir(activeInvCount, dir);
		case 'lastActivity':
		default:
			return orderByDir(lastActivityAt, dir);
	}
}

export async function listUsers(
	db: AppDb,
	opts: ListOptions = {}
): Promise<{ rows: AdminUserRow[]; total: number; page: number; pageSize: number }> {
	const { limit, offset, page } = clampPagination(opts);
	const { sort, dir } = parseListSort(opts.sort, opts.dir, USER_SORT_KEYS, 'lastActivity');
	const search = opts.search?.trim().toLowerCase();
	const searchPattern = search ? `%${escapeLikePattern(search)}%` : null;

	const where = searchPattern
		? or(
				sql`lower(${users.email}) LIKE ${searchPattern} ESCAPE '\\'`,
				sql`lower(${users.name}) LIKE ${searchPattern} ESCAPE '\\'`
			)
		: undefined;

	const { activeInvCount, totalInvCount, primaryProvider, lastActivityAt } = userListSubqueries();

	const baseQuery = db
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			image: users.image,
			investigatorCount: activeInvCount,
			totalInvestigatorCount: totalInvCount,
			primaryProvider,
			lastActivityAt
		})
		.from(users);

	const rows = await (where ? baseQuery.where(where) : baseQuery)
		.orderBy(userOrderBy(sort, dir))
		.limit(limit)
		.offset(offset);

	const totalQuery = db.select({ c: sql<number>`count(*)` }).from(users);
	const [{ c: total }] = await (where ? totalQuery.where(where) : totalQuery);

	return {
		rows: rows.map((r) => ({
			id: r.id,
			email: r.email,
			name: r.name,
			image: r.image,
			investigatorCount: Number(r.investigatorCount ?? 0),
			totalInvestigatorCount: Number(r.totalInvestigatorCount ?? 0),
			primaryProvider: r.primaryProvider,
			lastActivityAt: unixSecondsToDate(r.lastActivityAt)
		})),
		total: Number(total ?? 0),
		page,
		pageSize: limit
	};
}

export interface ListInvestigatorsOptions extends ListOptions {
	userId?: string;
}

const investigatorStatusOrder = sql<number>`(
	case
		when ${investigators.isArchived} = 1 then 2
		when ${investigators.isDraft} = 1 then 1
		else 0
	end
)`;

function investigatorOrderBy(sort: string, dir: SortDir) {
	switch (sort) {
		case 'name':
			return orderByDir(investigators.name, dir);
		case 'owner':
			return orderByDir(users.email, dir);
		case 'era':
			return orderByDir(investigators.era, dir);
		case 'occupation':
			return orderByDir(investigators.occupation, dir);
		case 'status':
			return orderByDir(investigatorStatusOrder, dir);
		case 'created':
			return orderByDir(investigators.createdAt, dir);
		case 'updated':
		default:
			return orderByDir(investigators.updatedAt, dir);
	}
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
	const { sort, dir } = parseListSort(opts.sort, opts.dir, INVESTIGATOR_SORT_KEYS, 'updated');
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
		.orderBy(investigatorOrderBy(sort, dir))
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

const auditWhoOrder = sql<string>`coalesce(${users.email}, ${adminAuditLog.actorEmail}, ${adminAuditLog.userId}, '')`;

function auditOrderBy(sort: string, dir: SortDir) {
	switch (sort) {
		case 'who':
			return orderByDir(auditWhoOrder, dir);
		case 'method':
			return orderByDir(adminAuditLog.method, dir);
		case 'path':
			return orderByDir(adminAuditLog.path, dir);
		case 'ip':
			return orderByDir(adminAuditLog.ip, dir);
		case 'when':
		default:
			return orderByDir(adminAuditLog.createdAt, dir);
	}
}

export async function listRecentAudit(
	db: AppDb,
	opts: ListOptions = {}
): Promise<{ rows: AdminAuditRow[]; total: number; page: number; pageSize: number }> {
	const { limit, offset, page } = clampPagination(opts);
	const { sort, dir } = parseListSort(opts.sort, opts.dir, AUDIT_SORT_KEYS, 'when');

	const baseSelect = db
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
		.leftJoin(users, eq(users.id, adminAuditLog.userId));

	const rows = await baseSelect.orderBy(auditOrderBy(sort, dir)).limit(limit).offset(offset);

	const [{ c: total }] = await db.select({ c: sql<number>`count(*)` }).from(adminAuditLog);

	return {
		rows: rows.map((r) => ({
			id: r.id,
			userId: r.userId,
			actorEmail: r.actorEmail,
			userEmail: r.userEmail,
			path: r.path,
			method: r.method,
			ip: r.ip,
			userAgent: r.userAgent,
			createdAt: r.createdAt
		})),
		total: Number(total ?? 0),
		page,
		pageSize: limit
	};
}
