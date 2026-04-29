import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

export const GET: RequestHandler = async (event) => {
	try {
		const db = await getDb(event);
		await db.select({ id: users.id }).from(users).limit(1);

		return json({
			status: 'ok',
			database: 'ok',
			timestamp: new Date().toISOString(),
			version: __APP_VERSION__
		});
	} catch (err) {
		return json(
			{
				status: 'error',
				database: 'error',
				timestamp: new Date().toISOString(),
				version: __APP_VERSION__
			},
			{ status: 503 }
		);
	}
};
