#!/usr/bin/env node
/**
 * Read-only admin activity diagnostics for local SQLite or Cloudflare D1.
 *
 * Local SQLite:
 *   node scripts/admin-activity-diagnostics.mjs
 *   node scripts/admin-activity-diagnostics.mjs --db ./local.db
 *
 * Cloudflare D1 (remote):
 *   npx wrangler d1 execute miskatonic-db --remote --file=scripts/admin-diagnostics.sql
 *
 * This script does NOT invent accounts rows (requires real OAuth provider_account_id).
 * Provider columns populate as users re-authenticate. Last-activity display is handled
 * by query fallbacks in admin-queries.ts (analytics + investigator updated_at).
 */
import process from 'node:process';
import Database from 'better-sqlite3';

function parseArgs(argv) {
	const args = { db: null, help: false };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--db') args.db = argv[++i];
		else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
	}
	return args;
}

function printHelp() {
	console.log(`Usage: node scripts/admin-activity-diagnostics.mjs [--db <path>]

Reports admin activity data gaps on a local SQLite database.
For production D1, use: npx wrangler d1 execute miskatonic-db --remote --file=scripts/admin-diagnostics.sql
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
	printHelp();
	process.exit(0);
}

// better-sqlite3 doesn't accept libSQL/Drizzle-style `file:` URIs — strip the scheme.
const rawDbPath = args.db ?? process.env.DATABASE_URL ?? 'local.db';
const dbPath = rawDbPath.startsWith('file:') ? rawDbPath.slice(5) : rawDbPath;
let db;
try {
	db = new Database(dbPath, { readonly: true });
} catch (err) {
	console.error(`Could not open database at ${dbPath}:`, err.message);
	console.error('For D1, use wrangler d1 execute with scripts/admin-diagnostics.sql');
	process.exit(1);
}

console.log(`\n=== Admin activity diagnostics (${dbPath}) ===\n`);

const usersWithoutAccounts = db
	.prepare(
		`SELECT u.id, u.email FROM users u
     LEFT JOIN accounts a ON a.user_id = u.id
     WHERE a.id IS NULL`
	)
	.all();
console.log(`Users without OAuth accounts: ${usersWithoutAccounts.length}`);
for (const row of usersWithoutAccounts.slice(0, 10)) {
	console.log(`  ${row.email ?? row.id}`);
}
if (usersWithoutAccounts.length > 10) console.log(`  ... and ${usersWithoutAccounts.length - 10} more`);

const loginEvents = db
	.prepare(`SELECT COUNT(*) AS n FROM analytics_events WHERE event_type = 'login'`)
	.get().n;
console.log(`\nLogin analytics events: ${loginEvents}`);

const eventCounts = db
	.prepare(`SELECT event_type, COUNT(*) AS cnt FROM analytics_events GROUP BY event_type`)
	.all();
console.log('Analytics by type:');
for (const row of eventCounts) {
	console.log(`  ${row.event_type}: ${row.cnt}`);
}

const orphanInv = db
	.prepare(
		`SELECT COUNT(*) AS n FROM investigators i
     LEFT JOIN users u ON u.id = i.user_id
     WHERE u.id IS NULL`
	)
	.get().n;
console.log(`\nOrphan investigators (user_id not in users): ${orphanInv}`);

const archivedOnly = db
	.prepare(
		`SELECT COUNT(*) AS n FROM users u
     WHERE (SELECT COUNT(*) FROM investigators WHERE user_id = u.id) > 0
       AND (SELECT COUNT(*) FROM investigators WHERE user_id = u.id AND is_archived = 0) = 0`
	)
	.get().n;
console.log(`Users with archived-only investigators: ${archivedOnly}`);

console.log('\n--- Per-user sample (first 10) ---');
const sample = db
	.prepare(
		`SELECT u.email,
      (SELECT COUNT(*) FROM accounts WHERE user_id = u.id) AS accounts,
      (SELECT COUNT(*) FROM investigators WHERE user_id = u.id AND is_archived = 0) AS active_inv,
      (SELECT COUNT(*) FROM investigators WHERE user_id = u.id) AS total_inv,
      (SELECT MAX(created_at) FROM analytics_events WHERE user_id = u.id) AS last_analytics_ts
    FROM users u LIMIT 10`
	)
	.all();
for (const row of sample) {
	const lastTs = row.last_analytics_ts
		? new Date(row.last_analytics_ts * 1000).toISOString()
		: '—';
	console.log(
		`  ${row.email ?? '(no email)'} | accounts=${row.accounts} | inv=${row.active_inv}/${row.total_inv} | last=${lastTs}`
	);
}

console.log('\nNo backfill mutations performed. Re-auth fills provider; query fallbacks cover last activity.\n');
db.close();
