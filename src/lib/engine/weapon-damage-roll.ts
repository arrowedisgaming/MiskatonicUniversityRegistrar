/**
 * CoC 7e weapon damage strings: parse a single segment (no `/`), substitute DB
 * from the investigator's damage bonus string, roll dice. Pure — rng injectable.
 *
 * Dice counts are strictly capped so pathological strings (e.g. 999999999D6) cannot
 * allocate huge arrays in the browser.
 */

import type { DiceGroup, DiceRollRequest } from '$lib/dice/protocol';
import { makeDiceRollRequest } from '$lib/dice/protocol';
import type { Rng } from '$lib/engine/dice';
import { cryptoRng, rollDice } from '$lib/engine/dice';
import type { CoCCharacterData } from '$lib/types/character';

export type WeaponDamageRollPlan =
	| { ok: true; request: DiceRollRequest; total: number; breakdownText: string }
	| { ok: false; reason: string };

/** Hard cap on `N` in a single `NdS` term (weapon + DB expansion). */
export const MAX_WEAPON_DAMAGE_DICE_PER_TOKEN = 24;

/** Hard cap on total physical dice rolled for one damage segment (all terms + DB). */
export const MAX_WEAPON_DAMAGE_DICE_PER_SEGMENT = 48;

function normalizeSegment(raw: string): string {
	return raw.replace(/\s+/g, '').toUpperCase();
}

/** Split weapon damage on `/` for shotgun-style bands; trim each part. */
export function splitDamageSegments(damageField: string): string[] {
	return damageField
		.split('/')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/**
 * Parse investigator damage bonus like "-2", "+1D4", "+2D6" into flat mod + dice to roll.
 * Returns `null` when a dice term exceeds {@link MAX_WEAPON_DAMAGE_DICE_PER_TOKEN}, or
 * when the string doesn't match a recognised DB shape (so callers fail loudly rather
 * than silently dropping the term).
 */
export function parseDamageBonusForRoll(
	dbRaw: string
): { flat: number; dice: { count: number; sides: number }[] } | null {
	const s = dbRaw.replace(/\s+/g, '').toUpperCase();
	if (s === '' || s === '0') return { flat: 0, dice: [] };

	const singleDice = /^([+-]?)(\d*)D(\d+)$/.exec(s);
	if (singleDice) {
		const sign = singleDice[1] === '-' ? -1 : 1;
		const count = Math.max(1, parseInt(singleDice[2] || '1', 10) || 1);
		const sides = parseInt(singleDice[3], 10);
		if (!Number.isFinite(sides) || sides < 1) return null;
		const signedCount = sign < 0 ? -count : count;
		if (Math.abs(signedCount) > MAX_WEAPON_DAMAGE_DICE_PER_TOKEN) return null;
		return { flat: 0, dice: [{ count: signedCount, sides }] };
	}

	const intOnly = /^([+-]?\d+)$/.exec(s);
	if (intOnly) {
		const flat = parseInt(intOnly[1], 10);
		if (!Number.isFinite(flat)) return null;
		return { flat, dice: [] };
	}

	return null;
}

type ParsedToken =
	| { kind: 'dice'; count: number; sides: number; sign: 1 | -1 }
	| { kind: 'int'; value: number }
	| { kind: 'db' };

type TokenizeDamageResult =
	| { ok: true; tokens: ParsedToken[] }
	| { ok: false; error: 'invalid' | 'excessive_dice' };

/**
 * Tokenize a single damage segment (after trim). Examples: 1D6+DB, 1D10+2, DB, 2D6+4
 */
function tokenizeDamageSegment(segment: string): TokenizeDamageResult {
	const s = normalizeSegment(segment);
	if (!s) return { ok: false, error: 'invalid' };

	const tokens: ParsedToken[] = [];
	let i = 0;
	let sign: 1 | -1 = 1;

	const readInt = (): number | null => {
		const start = i;
		if (s[i] === '+' || s[i] === '-') i++;
		const numStart = i;
		while (i < s.length && /\d/.test(s[i])) i++;
		if (numStart === i) return null;
		const n = parseInt(s.slice(start, i), 10);
		return Number.isFinite(n) ? n : null;
	};

	while (i < s.length) {
		const c = s[i];
		if (c === '+') {
			sign = 1;
			i++;
			continue;
		}
		if (c === '-') {
			sign = -1;
			i++;
			continue;
		}

		if (s.startsWith('DB', i)) {
			tokens.push({ kind: 'db' });
			i += 2;
			sign = 1;
			continue;
		}

		const diceStart = i;
		let countStr = '';
		while (i < s.length && /\d/.test(s[i])) countStr += s[i++];
		if (i < s.length && s[i] === 'D') {
			i++;
			let sidesStr = '';
			while (i < s.length && /\d/.test(s[i])) {
				sidesStr += s[i];
				i++;
			}
			const count = countStr ? parseInt(countStr, 10) : 1;
			const sides = parseInt(sidesStr, 10);
			if (!Number.isFinite(count) || !Number.isFinite(sides) || count < 1 || sides < 1) {
				return { ok: false, error: 'invalid' };
			}
			if (count > MAX_WEAPON_DAMAGE_DICE_PER_TOKEN) {
				return { ok: false, error: 'excessive_dice' };
			}
			tokens.push({ kind: 'dice', count, sides, sign });
			sign = 1;
			continue;
		}

		if (countStr) {
			i = diceStart;
		}

		const n = readInt();
		if (n === null) return { ok: false, error: 'invalid' };
		tokens.push({ kind: 'int', value: sign * n });
		sign = 1;
	}

	return { ok: true, tokens };
}

function validateDiceTotals(
	tokens: ParsedToken[],
	dbParsed: { flat: number; dice: { count: number; sides: number }[] }
): string | null {
	let total = 0;
	for (const t of tokens) {
		if (t.kind === 'dice') {
			const absCount = Math.abs(t.sign * t.count);
			if (absCount > MAX_WEAPON_DAMAGE_DICE_PER_TOKEN) {
				return `Too many dice in one term (maximum ${MAX_WEAPON_DAMAGE_DICE_PER_TOKEN})`;
			}
			total += absCount;
		}
		if (t.kind === 'db') {
			for (const d of dbParsed.dice) {
				const ac = Math.abs(d.count);
				if (ac > MAX_WEAPON_DAMAGE_DICE_PER_TOKEN) {
					return `Damage bonus uses too many dice in one term (maximum ${MAX_WEAPON_DAMAGE_DICE_PER_TOKEN})`;
				}
				total += ac;
			}
		}
	}
	if (total > MAX_WEAPON_DAMAGE_DICE_PER_SEGMENT) {
		return `Too many dice in this damage formula (maximum ${MAX_WEAPON_DAMAGE_DICE_PER_SEGMENT} total per roll)`;
	}
	return null;
}

const SUPPORTED_SIDES = new Set([3, 4, 6, 8, 10, 12, 20, 100]);

function rollNdM(count: number, sides: number, rng: Rng): number[] {
	if (count <= 0 || sides < 1) return [];
	return rollDice(count, sides, rng);
}

/**
 * Only dice-count / budget checks (for save validation). Does not require a fully
 * parseable CoC formula or supported die types.
 */
export function getWeaponDamageDiceLimitError(
	segment: string,
	damageBonusString: string
): string | null {
	const trimmed = segment.trim();
	if (!trimmed) return null;

	const tr = tokenizeDamageSegment(trimmed);
	if (!tr.ok) {
		return tr.error === 'excessive_dice'
			? `Too many dice in one term (maximum ${MAX_WEAPON_DAMAGE_DICE_PER_TOKEN})`
			: null;
	}

	const dbParsed = parseDamageBonusForRoll(damageBonusString);
	if (dbParsed === null) {
		return `Damage bonus is unrecognised or exceeds dice limits (max ${MAX_WEAPON_DAMAGE_DICE_PER_TOKEN} per term)`;
	}

	return validateDiceTotals(tr.tokens, dbParsed);
}

/**
 * If any weapon damage segment violates dice limits, returns a single user-facing line.
 * Uses `derivedStats.damageBonus` for DB substitution checks.
 */
export function describeWeaponDiceLimitViolations(character: CoCCharacterData): string | null {
	const db = character.derivedStats.damageBonus;
	for (const w of character.equipment.weapons) {
		const raw = w.damage?.trim() ?? '';
		if (!raw) continue;
		const segments = splitDamageSegments(raw);
		const toScan = segments.length > 0 ? segments : [raw];
		for (const seg of toScan) {
			const err = getWeaponDamageDiceLimitError(seg, db);
			if (err) {
				const name = (w.name ?? '').trim() || 'Weapon';
				return `${name}: ${err}`;
			}
		}
	}
	return null;
}

function buildValidationContext(
	segment: string,
	damageBonusString: string
):
	| { ok: true; tokens: ParsedToken[]; dbParsed: NonNullable<ReturnType<typeof parseDamageBonusForRoll>> }
	| { ok: false; reason: string } {
	const trimmed = segment.trim();
	if (!trimmed) return { ok: false, reason: 'Empty damage' };

	const tr = tokenizeDamageSegment(trimmed);
	if (!tr.ok) {
		if (tr.error === 'excessive_dice') {
			return {
				ok: false,
				reason: `Too many dice in one term (maximum ${MAX_WEAPON_DAMAGE_DICE_PER_TOKEN})`
			};
		}
		return { ok: false, reason: 'Unrecognized damage formula' };
	}

	const dbParsed = parseDamageBonusForRoll(damageBonusString);
	if (dbParsed === null) {
		return {
			ok: false,
			reason: `Damage bonus is unrecognised or exceeds dice limits (max ${MAX_WEAPON_DAMAGE_DICE_PER_TOKEN} per term)`
		};
	}

	const limitErr = validateDiceTotals(tr.tokens, dbParsed);
	if (limitErr) return { ok: false, reason: limitErr };

	for (const t of tr.tokens) {
		if (t.kind === 'dice' && !SUPPORTED_SIDES.has(t.sides)) {
			return { ok: false, reason: `Unsupported die type: d${t.sides}` };
		}
	}
	for (const d of dbParsed.dice) {
		if (!SUPPORTED_SIDES.has(d.sides)) {
			return { ok: false, reason: `Unsupported die type in damage bonus: d${d.sides}` };
		}
	}

	return { ok: true, tokens: tr.tokens, dbParsed };
}

/**
 * Full validation for enabling play-mode rolls (limits + sides + parse).
 */
export function getWeaponDamageSegmentValidationError(
	segment: string,
	damageBonusString: string
): string | null {
	const ctx = buildValidationContext(segment, damageBonusString);
	return ctx.ok ? null : ctx.reason;
}

export function isWeaponDamageFormulaSupported(segment: string, damageBonusString: string): boolean {
	return getWeaponDamageSegmentValidationError(segment, damageBonusString) === null;
}

/**
 * Build dice groups and compute total for one damage segment.
 */
export function planWeaponDamageRoll(
	segment: string,
	damageBonusString: string,
	rng: Rng = cryptoRng
): WeaponDamageRollPlan {
	const ctx = buildValidationContext(segment.trim(), damageBonusString);
	if (!ctx.ok) {
		return { ok: false, reason: ctx.reason };
	}

	const tokens = ctx.tokens;
	const dbParsed = ctx.dbParsed;

	const groups: DiceGroup[] = [];
	const breakdownParts: string[] = [];
	let total = 0;

	for (const t of tokens) {
		if (t.kind === 'int') {
			total += t.value;
			if (t.value !== 0) breakdownParts.push(`${t.value >= 0 ? '+' : ''}${t.value}`);
			continue;
		}
		if (t.kind === 'dice') {
			const rawCount = t.sign * t.count;
			const absCount = Math.abs(rawCount);
			if (rawCount === 0) continue;
			const sides = t.sides as DiceGroup['sides'];
			const rolls = rollNdM(absCount, t.sides, rng);
			const sub = rolls.reduce((a, b) => a + b, 0) * (rawCount < 0 ? -1 : 1);
			total += sub;
			groups.push({ count: absCount, sides, results: rolls });
			const signLabel = rawCount < 0 ? '−' : '';
			breakdownParts.push(`${signLabel}${absCount}d${t.sides}: [${rolls.join(',')}] → ${sub}`);
			continue;
		}
		if (t.kind === 'db') {
			total += dbParsed.flat;
			if (dbParsed.flat !== 0) breakdownParts.push(`DB flat ${dbParsed.flat >= 0 ? '+' : ''}${dbParsed.flat}`);

			for (const d of dbParsed.dice) {
				const rawCount = d.count;
				const absCount = Math.abs(rawCount);
				if (absCount === 0) continue;
				const sides = d.sides as DiceGroup['sides'];
				const rolls = rollNdM(absCount, d.sides, rng);
				const signMul = rawCount < 0 ? -1 : 1;
				const sub = rolls.reduce((a, b) => a + b, 0) * signMul;
				total += sub;
				groups.push({ count: absCount, sides, results: rolls });
				const signLabel = rawCount < 0 ? '−' : '';
				breakdownParts.push(`DB ${signLabel}${absCount}d${sides}: [${rolls.join(',')}] → ${sub}`);
			}
		}
	}

	const trimmed = segment.trim();
	const labelSnippet = trimmed.length > 28 ? trimmed.slice(0, 28) + '…' : trimmed;
	const request = makeDiceRollRequest(groups.filter((g) => g.count > 0), {
		label: `Damage (${labelSnippet})`
	});

	const breakdownText =
		breakdownParts.length > 0 ? `${breakdownParts.join(' · ')} = ${total}` : `Total ${total}`;

	return { ok: true, request, total, breakdownText };
}
