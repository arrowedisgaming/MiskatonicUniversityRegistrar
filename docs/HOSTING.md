# Hosting Porting Checklist

This guide tracks the work needed to make Miskatonic University Registrar deploy from one source tree to either:

- Cloudflare Pages with Cloudflare D1
- Node/Docker with local SQLite

The target shape is the same SvelteKit 2 / Svelte 5 application, the same Drizzle SQLite schema, and the same application routes: `/investigators`, `/create/coc7e`, `/sheet/[id]`, and the API routes under `/api`. The deployment-specific code should stop at the server database boundary and the hosting configuration.

## Target Architecture

The shared application should keep:

- one package, `miskatonic-university-registrar`
- one SQLite dialect schema for `users`, Auth.js tables, and `investigators`
- one CoC7e content-pack tree under `static/content-packs/coc7e`
- one server database accessor used by route handlers and auth code
- one stable health endpoint at `GET /api/health`

The deployment split should be:

- Cloudflare Pages uses `@sveltejs/adapter-cloudflare`, a D1 binding named `DB`, and Drizzle's D1 driver.
- Node/Docker uses `@sveltejs/adapter-node`, a persistent SQLite file, and Drizzle's `better-sqlite3` driver.

Application code should not import `better-sqlite3` directly. It should ask a project-local database module for the current request database, so Cloudflare builds do not statically include Node-only modules.

## Current Repo Status

Already present:

- SvelteKit 2 and Svelte 5 project structure.
- `@sveltejs/adapter-node` and `@sveltejs/adapter-cloudflare` dependencies.
- Adapter selection in `svelte.config.js` via `ADAPTER=node` or `ADAPTER=cloudflare`; unset `ADAPTER` currently uses `adapter-auto`.
- Drizzle ORM and SQLite schema in `src/lib/server/db/schema.ts`.
- dual-driver database access in `src/lib/server/db/index.ts`, using D1 when `event.platform.env.DB` exists and lazy-loading `better-sqlite3` for Node.
- Cloudflare D1 platform typing in `src/app.d.ts`.
- `wrangler.toml` with D1 binding `DB`, database name `miskatonic-db`, and the Drizzle migrations directory.
- `src/hooks.server.ts` with database attachment, security headers, origin checks for unsafe methods, and a simple write-rate limiter.
- Dockerfile, `docker-compose.yml`, a healthcheck, and `/data` secret persistence via `docker-entrypoint.sh`.
- `GET /api/health` with database readiness.
- SQLite-focused Drizzle config in `drizzle.config.ts`.
- committed Drizzle migrations under `src/lib/server/db/migrations`.
- D1 migration scripts in `package.json`.
- Auth.js schema tables, plus current anonymous local-dev user creation in `src/lib/server/auth.ts`.

Missing or incomplete for equivalent Cloudflare and Docker deployments:

- replace the placeholder D1 `database_id` in `wrangler.toml` after `miskatonic-db` is created.
- apply and verify D1 migrations with Wrangler against the real Cloudflare account.
- add an explicit Docker migration release step or container startup migration runner if deployments should self-migrate.
- finish Auth.js OAuth hooks and replace the anonymous local-dev user path for production.
- add production-grade persistent rate limiting if this app is exposed beyond a single Node process or Cloudflare runtime instance.

## Required Public Interfaces

### Environment Variables

Keep these names stable unless a later migration deliberately updates all deployment docs and examples:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `ADAPTER` | build | `node` for adapter-node, `cloudflare` for adapter-cloudflare. Currently unset falls back to `adapter-auto`. |
| `DATABASE_URL` | Node/Docker, local dev | SQLite path, for example `local.db` or `/data/miskatonic.db`. |
| `AUTH_SECRET` | auth | Production Auth.js secret. Must not be the compose-file placeholder in production. |
| `AUTH_TRUST_HOST` | auth | Needed by Auth.js behind some proxies. |
| `ORIGIN` | SvelteKit/Node | Public origin for strict origin checks when used. |
| `PORT` | Node/Docker | Node listener port. Compose maps host `${PORT:-3000}` to container `3000`. |
| `AUTH_GOOGLE_ID` | auth | Google OAuth client id. |
| `AUTH_GOOGLE_SECRET` | auth | Google OAuth client secret. |
| `AUTH_DISCORD_ID` | auth | Discord OAuth client id. |
| `AUTH_DISCORD_SECRET` | auth | Discord OAuth client secret. |
| `AUTH_URL` | auth | Canonical auth URL if the Auth.js setup needs it. |
| `NODE_ENV` | Node/Docker | `production` in deployed containers. |

### Cloudflare Binding

Cloudflare runtime code should use a D1 binding named `DB`:

```ts
event.platform.env.DB
```

Add project typing before using this in server code. The expected shape is:

```ts
declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
			};
		}
	}
}
```

### Database Access

Route handlers, load functions, hooks, and auth helpers should call one server-side accessor instead of importing a concrete `better-sqlite3` instance. A practical target shape:

```ts
import { getDb } from '$lib/server/db';

const db = await getDb(event);
```

The accessor should choose:

- D1 driver when `event.platform?.env.DB` exists.
- Node SQLite driver when running under adapter-node or local dev.

For Node, import `better-sqlite3` dynamically inside the Node-only branch. That keeps Cloudflare's build graph clear of Node native modules.

### Health Endpoint

`GET /api/health` should remain the stable uptime and Docker healthcheck contract. Today it returns:

```json
{
	"status": "ok",
	"timestamp": "ISO-8601 timestamp",
	"version": "package version"
}
```

When database readiness is added, preserve the existing fields and add database information rather than changing the route or removing keys.

## Replication Checklist

Complete these in dependency order.

### 1. Add `wrangler.toml`

Create `wrangler.toml` with a D1 binding named `DB`. Use the project and database names consistently:

```toml
name = "miskatonic-university-registrar"
compatibility_date = "2026-04-28"
pages_build_output_dir = ".svelte-kit/cloudflare"

[[d1_databases]]
binding = "DB"
database_name = "miskatonic-db"
database_id = "<cloudflare-d1-database-id>"
```

Create the database with Wrangler, then replace `database_id` with the generated id.

### 2. Decide Adapter Default

The current adapter selection is:

- `ADAPTER=node` -> adapter-node output in `build/`
- `ADAPTER=cloudflare` -> adapter-cloudflare output
- unset -> adapter-auto

For a Cloudflare-primary deployment, either change the default to Cloudflare or keep the current behavior and document that Pages builds must set `ADAPTER=cloudflare`.

For Docker, keep setting `ADAPTER=node` in the Dockerfile build stage.

### 3. Split Database Drivers

Refactor `src/lib/server/db/index.ts` into a deployment-neutral API.

Expected behavior:

- Cloudflare requests build a Drizzle D1 database from `event.platform.env.DB`.
- Node requests build a Drizzle better-sqlite3 database from `DATABASE_URL`.
- Node initialization still enables WAL and foreign keys.
- The Node database instance is cached per process.
- No top-level `better-sqlite3` import remains in files that Cloudflare bundles.

Update callers such as API routes, page server loads, and `src/lib/server/auth.ts` to receive or resolve the request database through the shared accessor.

### 4. Add Platform Typing

Add Cloudflare platform typing in `src/app.d.ts` or a dedicated server type file. Include the D1 binding:

```ts
interface Platform {
	env: {
		DB: D1Database;
	};
}
```

If the project does not already include Cloudflare worker types, add the appropriate type package or generated Wrangler types and wire them into `tsconfig.json`.

### 5. Add `hooks.server.ts`

Add a request hook chain before production auth work lands. The hook chain should cover:

- database initialization or attachment to `event.locals`
- security headers
- CSRF checks for unsafe methods
- rate limiting for write endpoints
- Auth.js integration when OAuth is completed
- user backfill or resolution so saved investigators always have a valid `users` row

The current `src/lib/server/auth.ts` uses an anonymous `local-dev-user`. Keep that behavior for local development until the Auth.js OAuth flow is complete, but avoid making production depend on a single shared anonymous user.

### 6. Generate and Commit Migrations

Generate migrations from the existing schema:

```bash
npm run db:generate
```

Commit the generated files under `src/lib/server/db/migrations`. Do not rely on `db:push` for production parity; use migration files for both D1 and Node deployment workflows.

### 7. Harden Docker Deployment

Keep the persistent database path under `/data`, as compose already sets:

```yaml
DATABASE_URL=/data/miskatonic.db
```

Add the missing production hardening:

- persist or inject a strong `AUTH_SECRET`; do not use `change-me-in-production`.
- bind the Node process intentionally, preferably to localhost when placed behind a reverse proxy.
- run migrations at container start or as an explicit release step.
- add a Docker healthcheck that calls `GET /api/health`.
- ensure the `/data` volume is writable by the runtime user if the image stops running as root.

### 8. Expand `/api/health`

Add a database readiness check while preserving the existing JSON shape. A target response can be:

```json
{
	"status": "ok",
	"database": "ok",
	"timestamp": "ISO-8601 timestamp",
	"version": "package version"
}
```

Return a non-2xx status when the app cannot reach its configured database. That lets Docker, uptime checks, and Cloudflare smoke tests catch runtime database failures.

## Verification Commands

Run these after the implementation work above is complete.

### Static Checks

```bash
npm run check
npm run test
```

### Cloudflare Build

```bash
ADAPTER=cloudflare npm run build
```

This should not fail because of `better-sqlite3` or other Node-only imports.

### Cloudflare Local Runtime

```bash
npx wrangler pages dev .svelte-kit/cloudflare
curl http://localhost:8788/api/health
```

The health response should include `status: "ok"` and database readiness once D1 is configured.

### D1 Migrations

```bash
npx wrangler d1 migrations apply miskatonic-db --local
npx wrangler d1 migrations apply miskatonic-db --remote
```

Confirm the `users`, Auth.js, and `investigators` tables exist after applying migrations.

### Node Build

```bash
ADAPTER=node npm run build
PORT=3000 DATABASE_URL=local.db node build
curl http://localhost:3000/api/health
```

The Node build should create and read the configured SQLite database without any Cloudflare bindings.

### Docker

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:3000/api/health
```

Confirm the container reports healthy once a healthcheck exists. Also verify that the SQLite file is created inside the `/data` volume as `miskatonic.db`.

### Auth

After Auth.js OAuth is completed:

- set `AUTH_SECRET` and provider credentials in the hosting environment.
- confirm Google login creates or resolves a `users` row.
- confirm Discord login creates or resolves a `users` row.
- confirm saved investigators remain associated with the authenticated user.

## Notes for This Project

The README currently describes Cloudflare D1 and Auth.js as part of the intended stack, but the implementation is still local-dev oriented in the server database and auth modules. Treat this document as the checklist for closing that gap without changing the domain model: Miskatonic saves CoC7e investigators, content packs stay under `static/content-packs/coc7e`, and Drizzle remains the shared ORM layer for both hosting targets.
