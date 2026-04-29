import { error, type RequestEvent } from '@sveltejs/kit';
import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';
import Discord from '@auth/sveltekit/providers/discord';
import Credentials from '@auth/sveltekit/providers/credentials';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from './db';
import { users } from './db/schema';

type EnvPlatform = {
	env?: Record<string, string | D1Database | undefined>;
};

const DEV_AUTH_SECRET = 'miskatonic-university-registrar-local-development-secret';

function getEnv(event: RequestEvent, key: string): string | undefined {
	const platform = event.platform as EnvPlatform | undefined;
	const platformValue = platform?.env?.[key];
	if (typeof platformValue === 'string' && platformValue.length > 0) return platformValue;

	if (typeof process !== 'undefined') {
		return process.env[key];
	}

	return undefined;
}

export const { handle, signIn, signOut } = SvelteKitAuth(async (event) => {
	const googleId = getEnv(event, 'AUTH_GOOGLE_ID');
	const googleSecret = getEnv(event, 'AUTH_GOOGLE_SECRET');
	const discordId = getEnv(event, 'AUTH_DISCORD_ID');
	const discordSecret = getEnv(event, 'AUTH_DISCORD_SECRET');
	const nodeEnv = getEnv(event, 'NODE_ENV') ?? 'production';
	const authSecret =
		getEnv(event, 'AUTH_SECRET') ?? (nodeEnv === 'development' ? DEV_AUTH_SECRET : undefined);

	const providers = [];

	if (googleId && googleSecret) {
		providers.push(
			Google({
				clientId: googleId,
				clientSecret: googleSecret
			})
		);
	}

	if (discordId && discordSecret) {
		providers.push(
			Discord({
				clientId: discordId,
				clientSecret: discordSecret,
				client: { token_endpoint_auth_method: 'client_secret_post' }
			})
		);
	}

	if (nodeEnv === 'development') {
		providers.push(
			Credentials({
				id: 'credentials',
				name: 'Dev Login',
				credentials: {
					email: { label: 'Email', type: 'email' },
					name: { label: 'Name', type: 'text' }
				},
				async authorize(credentials) {
					const email = String(credentials?.email ?? '').trim();
					const name = String(credentials?.name ?? '').trim() || 'Dev User';
					if (!email) return null;

					const db = await getDb(event);
					const existing = await db.select().from(users).where(eq(users.email, email)).get();
					if (existing) {
						return { id: existing.id, name: existing.name, email: existing.email };
					}

					const id = nanoid(21);
					await db.insert(users).values({ id, name, email });
					return { id, name, email };
				}
			})
		);
	}

	return {
		providers,
		secret: authSecret,
		session: { strategy: 'jwt' },
		pages: {
			signIn: '/login'
		},
		callbacks: {
			jwt({ token, user, account }) {
				if (account?.provider && account.providerAccountId) {
					token.id = `${account.provider}:${account.providerAccountId}`;
				} else if (user?.id) {
					token.id = user.id;
				}
				return token;
			},
			session({ session, token }) {
				if (session.user && token.id) {
					session.user.id = String(token.id);
				}
				return session;
			}
		},
		trustHost: true
	};
});

export async function getUserId(event: RequestEvent): Promise<string | null> {
	const session = await event.locals.auth();
	return session?.user?.id ?? null;
}

export async function ensureUser(event: RequestEvent): Promise<string> {
	const session = await event.locals.auth();
	const userId = session?.user?.id;
	if (!userId) {
		throw error(401, 'Sign in required');
	}

	const db = await getDb(event);
	const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get();
	if (existing) {
		return existing.id;
	}

	if (session.user?.email) {
		const existingEmailUser = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, session.user.email))
			.get();
		if (existingEmailUser) {
			return existingEmailUser.id;
		}
	}

	await db.insert(users).values({
		id: userId,
		name: session.user?.name ?? null,
		email: session.user?.email ?? null,
		image: session.user?.image ?? null
	});

	return userId;
}
