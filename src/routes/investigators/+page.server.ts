import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { investigators } from '$lib/server/db/schema';
import { ensureUser } from '$lib/server/auth';
import { eq, and, desc } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, `/login?callbackUrl=${encodeURIComponent(event.url.pathname)}`);
	}

	const db = await getDb(event);
	const userId = await ensureUser(event);

	const rows = await db
		.select({
			id: investigators.id,
			name: investigators.name,
			era: investigators.era,
			occupation: investigators.occupation,
			isDraft: investigators.isDraft,
			createdAt: investigators.createdAt,
			updatedAt: investigators.updatedAt
		})
		.from(investigators)
		.where(and(eq(investigators.userId, userId), eq(investigators.isArchived, false)))
		.orderBy(desc(investigators.updatedAt));

	return { investigators: rows };
};
