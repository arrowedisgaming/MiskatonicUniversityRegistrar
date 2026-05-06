import { describe, expect, it } from 'vitest';
import { sequenceRng } from '$lib/engine/dice';
import {
	describeWeaponDiceLimitViolations,
	getWeaponDamageDiceLimitError,
	getWeaponDamageSegmentValidationError,
	isWeaponDamageFormulaSupported,
	MAX_WEAPON_DAMAGE_DICE_PER_SEGMENT,
	MAX_WEAPON_DAMAGE_DICE_PER_TOKEN,
	parseDamageBonusForRoll,
	planWeaponDamageRoll,
	splitDamageSegments
} from '$lib/engine/weapon-damage-roll';
import type { CoCCharacterData } from '$lib/types/character';

describe('splitDamageSegments', () => {
	it('splits shotgun-style damage', () => {
		expect(splitDamageSegments('4D6/2D6/1D6')).toEqual(['4D6', '2D6', '1D6']);
	});

	it('keeps slash-free strings as one segment (trim outer only via split)', () => {
		expect(splitDamageSegments(' 1D6 + 2 ')).toEqual(['1D6 + 2']);
	});
});

describe('parseDamageBonusForRoll', () => {
	it('parses flat negatives and zero', () => {
		expect(parseDamageBonusForRoll('-2')).toEqual({ flat: -2, dice: [] });
		expect(parseDamageBonusForRoll('-1')).toEqual({ flat: -1, dice: [] });
		expect(parseDamageBonusForRoll('0')).toEqual({ flat: 0, dice: [] });
	});

	it('parses bonus dice', () => {
		expect(parseDamageBonusForRoll('+1D4')).toEqual({ flat: 0, dice: [{ count: 1, sides: 4 }] });
		expect(parseDamageBonusForRoll('+2D6')).toEqual({ flat: 0, dice: [{ count: 2, sides: 6 }] });
	});

	it('rejects dice count above per-token cap', () => {
		expect(parseDamageBonusForRoll(`+${MAX_WEAPON_DAMAGE_DICE_PER_TOKEN + 1}D6`)).toBeNull();
		expect(parseDamageBonusForRoll(`+${MAX_WEAPON_DAMAGE_DICE_PER_TOKEN}D6`)).toEqual({
			flat: 0,
			dice: [{ count: MAX_WEAPON_DAMAGE_DICE_PER_TOKEN, sides: 6 }]
		});
	});

	it('returns null on unrecognised DB shapes (no silent term-dropping)', () => {
		expect(parseDamageBonusForRoll('+1D4+2')).toBeNull();
		expect(parseDamageBonusForRoll('+1D4+1D6')).toBeNull();
		expect(parseDamageBonusForRoll('garbage')).toBeNull();
		expect(parseDamageBonusForRoll('+D')).toBeNull();
	});
});

describe('dice count limits', () => {
	it('rejects huge N in NdM without attempting a roll', () => {
		const p = planWeaponDamageRoll(`999999999D6`, '0');
		expect(p.ok).toBe(false);
		if (!p.ok) expect(p.reason).toMatch(/Too many dice/);
	});

	it('accepts exactly max dice per token', () => {
		const n = MAX_WEAPON_DAMAGE_DICE_PER_TOKEN;
		const rng = sequenceRng(Array.from({ length: n }, () => 1));
		const p = planWeaponDamageRoll(`${n}D6`, '0', rng);
		expect(p.ok).toBe(true);
	});

	it('rejects max+1 dice in one term', () => {
		const p = planWeaponDamageRoll(`${MAX_WEAPON_DAMAGE_DICE_PER_TOKEN + 1}D6`, '0');
		expect(p.ok).toBe(false);
	});

	it('rejects when sum of terms exceeds per-segment cap', () => {
		const a = Math.floor(MAX_WEAPON_DAMAGE_DICE_PER_SEGMENT / 2);
		const b = MAX_WEAPON_DAMAGE_DICE_PER_SEGMENT - a + 1;
		const p = planWeaponDamageRoll(`${a}D6+${b}D6`, '0');
		expect(p.ok).toBe(false);
	});

	it('accepts weapon terms that sum to segment cap', () => {
		const a = Math.floor(MAX_WEAPON_DAMAGE_DICE_PER_SEGMENT / 2);
		const b = MAX_WEAPON_DAMAGE_DICE_PER_SEGMENT - a;
		const rng = sequenceRng(Array.from({ length: a + b }, () => 1));
		const p = planWeaponDamageRoll(`${a}D6+${b}D6`, '0', rng);
		expect(p.ok).toBe(true);
	});

	it('counts DB dice toward segment total', () => {
		const w = MAX_WEAPON_DAMAGE_DICE_PER_TOKEN;
		const dbDice = MAX_WEAPON_DAMAGE_DICE_PER_SEGMENT - w + 1;
		const p = planWeaponDamageRoll(`${w}D6+DB`, `+${dbDice}D6`, sequenceRng([]));
		expect(p.ok).toBe(false);
	});

	it('surfaces limit errors in support check', () => {
		expect(isWeaponDamageFormulaSupported(`999999999D6`, '0')).toBe(false);
		expect(getWeaponDamageSegmentValidationError(`999999999D6`, '0')).toMatch(/Too many dice/);
	});

	it('getWeaponDamageDiceLimitError matches segment validation for limit failures', () => {
		const seg = `${MAX_WEAPON_DAMAGE_DICE_PER_TOKEN + 1}D6`;
		expect(getWeaponDamageDiceLimitError(seg, '0')).toBeTruthy();
		expect(getWeaponDamageSegmentValidationError(seg, '0')).toBeTruthy();
	});
});

describe('describeWeaponDiceLimitViolations', () => {
	const baseChar = (): CoCCharacterData =>
		({
			equipment: { weapons: [], items: [] },
			derivedStats: { damageBonus: '0' }
		}) as unknown as CoCCharacterData;

	it('returns a message when a weapon segment exceeds limits', () => {
		const c = baseChar();
		c.equipment.weapons = [
			{
				name: 'Test Gun',
				damage: `${MAX_WEAPON_DAMAGE_DICE_PER_TOKEN + 1}D6`,
				range: '',
				attacksPerRound: '',
				ammo: null,
				malfunction: null
			}
		];
		c.derivedStats.damageBonus = '0';
		expect(describeWeaponDiceLimitViolations(c)).toMatch(/Test Gun/);
	});
});

describe('planWeaponDamageRoll', () => {
	it('rolls weapon dice and flat without DB', () => {
		const rng = sequenceRng([4, 3]); // 2d6 -> 4+3=7, +4 flat
		const p = planWeaponDamageRoll('2D6+4', '0', rng);
		expect(p.ok).toBe(true);
		if (!p.ok) return;
		expect(p.total).toBe(11);
		expect(p.request.groups.length).toBe(1);
		expect(p.request.groups[0].count).toBe(2);
		expect(p.request.groups[0].sides).toBe(6);
	});

	it('substitutes DB from damage bonus', () => {
		// 1d3 (one roll) + DB +1d4 where d4 → 2
		const rng = sequenceRng([2, 2]);
		const p = planWeaponDamageRoll('1D3+DB', '+1D4', rng);
		expect(p.ok).toBe(true);
		if (!p.ok) return;
		// 1d3 → 2, db 1d4 → 2 → total 4
		expect(p.total).toBe(4);
	});

	it('rejects unsupported die on weapon', () => {
		const p = planWeaponDamageRoll('1D5', '0');
		expect(p.ok).toBe(false);
	});
});
