import { nanoid } from 'nanoid';
import type { AppDb } from './db';
import { analyticsEvents } from './db/schema';

export type AnalyticsEventType = 'login' | 'investigator_created' | 'pdf_generated';

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
