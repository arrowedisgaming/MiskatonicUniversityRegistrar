import { and, eq, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AppDb } from './db';
import { analyticsEvents } from './db/schema';

const SESSION_REFRESH_THROTTLE_MS = 24 * 60 * 60 * 1000;

export type AnalyticsEventType =
	| 'login'
	| 'session_refresh'
	| 'investigator_created'
	| 'pdf_generated';

export interface RecordEventInput {
	userId: string | null;
	eventType: AnalyticsEventType;
	provider?: string | null;
	metadata?: Record<string, unknown>;
}

/**
 * Record an analytics event. Best-effort — failures are logged but never thrown,
 * because analytics must never break a user flow (sign-in, save, export).
 */
export async function recordEvent(db: AppDb, input: RecordEventInput): Promise<void> {
	try {
		await db.insert(analyticsEvents).values({
			id: nanoid(21),
			userId: input.userId,
			eventType: input.eventType,
			provider: input.provider ?? null,
			metadata: input.metadata ? JSON.stringify(input.metadata) : null,
			createdAt: new Date()
		});
	} catch (err) {
		console.warn(
			`[analytics] failed to record ${input.eventType}:`,
			(err as Error)?.message ?? err
		);
	}
}

/**
 * Record a session_refresh activity event at most once per user per 24h.
 * Distinct from `login` so admin login metrics aren't inflated by JWT reuse —
 * only true sign-ins write `login`. lastActivityAt aggregates all event types.
 */
export async function recordSessionRefresh(db: AppDb, userId: string): Promise<void> {
	try {
		const since = new Date(Date.now() - SESSION_REFRESH_THROTTLE_MS);
		const recent = await db
			.select({ id: analyticsEvents.id })
			.from(analyticsEvents)
			.where(
				and(
					eq(analyticsEvents.userId, userId),
					eq(analyticsEvents.eventType, 'session_refresh'),
					gte(analyticsEvents.createdAt, since)
				)
			)
			.limit(1)
			.get();
		if (recent) return;

		await recordEvent(db, { userId, eventType: 'session_refresh' });
	} catch (err) {
		console.warn(
			'[analytics] failed to record session_refresh:',
			(err as Error)?.message ?? err
		);
	}
}
