#!/usr/bin/env node
/**
 * Reassign v0.1.0 anonymous investigator rows (user_id = 'local-dev-user') to
 * a real signed-in user. Run after upgrading from v0.1.0 to v0.1.1+ on a local
 * SQLite database (better-sqlite3). For Cloudflare D1, run the equivalent SQL
 * via `wrangler d1 execute`.
 *
 * Usage:
 *   node scripts/migrate-anonymous-investigators.mjs --user-id <id>
 *   node scripts/migrate-anonymous-investigators.mjs --email <email>
 *   node scripts/migrate-anonymous-investigators.mjs --list
 *
 * Optional: --db <path>  (defaults to ./local.db or $DATABASE_URL)
 */
import process from 'node:process';
import Database from 'better-sqlite3';

const ANON_USER_ID = 'local-dev-user';

function parseArgs(argv) {
	const args = { mode: null, value: null, db: null };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--list') args.mode = 'list';
		else if (arg === '--user-id') {
			args.mode = 'user-id';
			args.value = argv[++i];
		} else if (arg === '--email') {
			args.mode = 'email';
			args.value = argv[++i];
		} else if (arg === '--db') args.db = argv[++i];
		else if (arg === '--help' || arg === '-h') args.mode = 'help';
	}
	return args;
}

function printHelp() {
	console.log(
		'Usage: node scripts/migrate-anonymous-investigators.mjs [--list | --user-id <id> | --email <email>] [--db <path>]'
	);
}

const args = parseArgs(process.argv.slice(2));
if (!args.mode || args.mode === 'help') {
	printHelp();
	process.exit(args.mode === 'help' ? 0 : 1);
}

const dbPath = args.db ?? process.env.DATABASE_URL ?? 'local.db';
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const orphanCount = db
	.prepare('SELECT count(*) AS n FROM investigators WHERE user_id = ?')
	.get(ANON_USER_ID).n;

if (args.mode === 'list') {
	console.log(`Orphaned (user_id='${ANON_USER_ID}') investigator rows: ${orphanCount}`);
	if (orphanCount > 0) {
		const rows = db
			.prepare('SELECT id, name, era, created_at FROM investigators WHERE user_id = ? ORDER BY created_at DESC')
			.all(ANON_USER_ID);
		for (const row of rows) {
			console.log(`  ${row.id}\t${row.name || '(unnamed)'}\t${row.era}\t${new Date(row.created_at * 1000).toISOString()}`);
		}
	}
	process.exit(0);
}

if (orphanCount === 0) {
	console.log('No orphaned investigators to migrate.');
	process.exit(0);
}

let targetId = null;
if (args.mode === 'user-id') targetId = args.value;
else if (args.mode === 'email') {
	const row = db.prepare('SELECT id FROM users WHERE email = ?').get(args.value);
	if (!row) {
		console.error(`No user found with email ${args.value}. Sign in once first to create the user row.`);
		process.exit(2);
	}
	targetId = row.id;
}

if (!targetId) {
	printHelp();
	process.exit(1);
}

const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(targetId);
if (!target) {
	console.error(`No user found with id ${targetId}.`);
	process.exit(2);
}

const result = db
	.prepare('UPDATE investigators SET user_id = ? WHERE user_id = ?')
	.run(targetId, ANON_USER_ID);

console.log(`Reassigned ${result.changes} investigator row(s) to ${target.email ?? target.id}.`);
