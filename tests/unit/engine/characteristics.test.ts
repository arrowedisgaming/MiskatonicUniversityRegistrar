import { describe, it, expect } from 'vitest';
import {
	rollAllCharacteristics,
	rollResultsToValues,
	halfValue,
	fifthValue,
	validateCharacteristics,
	pointBuyStatus,
	isQuickFireAssignment,
	quickFireAvailableCounts,
	quickFireSwapAssignment,
	isReconcileTokenFresh,
	POINT_BUY_TOTAL,
	QUICK_FIRE_VALUES
} from '$lib/engine/characteristics';
import { ALL_CHARACTERISTICS, ROLL_3D6, ROLL_2D6_PLUS_6 } from '$lib/types/common';
import type { CharacteristicId } from '$lib/types/common';
import {
	editableCharacteristicMethod,
	normalizeStoredMethod,
	isCharacteristicMethodId,
	isStoredCharacteristicMethodId
} from '$lib/types/content-pack';

describe('rollAllCharacteristics', () => {
	it('returns results for all 8 characteristics', () => {
		const results = rollAllCharacteristics();
		expect(results).toHaveLength(8);
		const charIds = results.map((r) => r.characteristic);
		for (const c of ALL_CHARACTERISTICS) {
			expect(charIds).toContain(c);
		}
	});

	it('3d6×5 characteristics are in range 15-90', () => {
		const results = rollAllCharacteristics();
		for (const r of results) {
			if (ROLL_3D6.includes(r.characteristic)) {
				expect(r.total).toBeGreaterThanOrEqual(15);
				expect(r.total).toBeLessThanOrEqual(90);
			}
		}
	});

	it('(2d6+6)×5 characteristics are in range 40-90', () => {
		const results = rollAllCharacteristics();
		for (const r of results) {
			if (ROLL_2D6_PLUS_6.includes(r.characteristic)) {
				expect(r.total).toBeGreaterThanOrEqual(40);
				expect(r.total).toBeLessThanOrEqual(90);
			}
		}
	});
});

describe('rollResultsToValues', () => {
	it('converts results array to record', () => {
		const results = rollAllCharacteristics();
		const values = rollResultsToValues(results);
		expect(Object.keys(values)).toHaveLength(8);
		for (const r of results) {
			expect(values[r.characteristic]).toBe(r.total);
		}
	});
});

describe('halfValue', () => {
	it('returns floor of score / 2', () => {
		expect(halfValue(65)).toBe(32);
		expect(halfValue(50)).toBe(25);
		expect(halfValue(75)).toBe(37);
		expect(halfValue(15)).toBe(7);
		expect(halfValue(1)).toBe(0);
	});
});

describe('fifthValue', () => {
	it('returns floor of score / 5', () => {
		expect(fifthValue(65)).toBe(13);
		expect(fifthValue(50)).toBe(10);
		expect(fifthValue(75)).toBe(15);
		expect(fifthValue(15)).toBe(3);
		expect(fifthValue(1)).toBe(0);
	});
});

describe('validateCharacteristics', () => {
	it('accepts valid characteristic values', () => {
		const values = { str: 50, con: 60, dex: 45, int: 65, pow: 55, app: 40, siz: 60, edu: 70 };
		const result = validateCharacteristics(values);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('rejects 3d6×5 characteristics below 15', () => {
		const values = { str: 10, con: 60, dex: 45, int: 65, pow: 55, app: 40, siz: 60, edu: 70 };
		const result = validateCharacteristics(values);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('STR');
	});

	it('rejects (2d6+6)×5 characteristics below 40', () => {
		const values = { str: 50, con: 60, dex: 45, int: 30, pow: 55, app: 40, siz: 60, edu: 70 };
		const result = validateCharacteristics(values);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('INT');
	});

	it('rejects characteristics above 90', () => {
		const values = { str: 95, con: 60, dex: 45, int: 65, pow: 55, app: 40, siz: 60, edu: 70 };
		const result = validateCharacteristics(values);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('STR');
	});
});

describe('isCharacteristicMethodId', () => {
	it('accepts current methods', () => {
		expect(isCharacteristicMethodId('point-buy')).toBe(true);
		expect(isCharacteristicMethodId('quick-fire')).toBe(true);
		expect(isCharacteristicMethodId('roll')).toBe(true);
	});
	it('rejects legacy and unknown values', () => {
		expect(isCharacteristicMethodId('arrange-rolls')).toBe(false);
		expect(isCharacteristicMethodId('low-roll-modifier')).toBe(false);
		expect(isCharacteristicMethodId(undefined)).toBe(false);
		expect(isCharacteristicMethodId('')).toBe(false);
	});
});

describe('isStoredCharacteristicMethodId', () => {
	it.each(['point-buy', 'quick-fire', 'roll', 'arrange-rolls', 'low-roll-modifier', 'human-potential'])(
		'accepts %s as a stored id',
		(value) => {
			expect(isStoredCharacteristicMethodId(value)).toBe(true);
		}
	);
	it('rejects truly unknown values', () => {
		expect(isStoredCharacteristicMethodId(undefined)).toBe(false);
		expect(isStoredCharacteristicMethodId('made-up')).toBe(false);
		expect(isStoredCharacteristicMethodId(42)).toBe(false);
	});
});

describe('normalizeStoredMethod', () => {
	it.each(['point-buy', 'quick-fire', 'roll'])('passes through current method %s', (value) => {
		expect(normalizeStoredMethod(value)).toBe(value);
	});

	it.each(['arrange-rolls', 'low-roll-modifier', 'human-potential'])(
		'preserves legacy method %s for provenance',
		(value) => {
			expect(normalizeStoredMethod(value)).toBe(value);
		}
	);

	it.each([undefined, null, 42, ''])('coerces truly unknown value %s to point-buy', (value) => {
		expect(normalizeStoredMethod(value)).toBe('point-buy');
	});
});

describe('editableCharacteristicMethod', () => {
	it('passes through current methods', () => {
		expect(editableCharacteristicMethod('point-buy')).toBe('point-buy');
		expect(editableCharacteristicMethod('quick-fire')).toBe('quick-fire');
		expect(editableCharacteristicMethod('roll')).toBe('roll');
	});

	it.each(['arrange-rolls', 'low-roll-modifier', 'human-potential', undefined, null, 42, ''])(
		'resolves legacy or unknown value %s to point-buy as editable proxy',
		(value) => {
			expect(editableCharacteristicMethod(value)).toBe('point-buy');
		}
	);
});

describe('pointBuyStatus', () => {
	it('reports valid 460-total assignment in 15..90 range', () => {
		const values = { str: 50, con: 50, dex: 50, int: 60, pow: 50, app: 50, siz: 60, edu: 90 };
		const status = pointBuyStatus(values);
		expect(status.total).toBe(460);
		expect(status.remaining).toBe(0);
		expect(status.allInRange).toBe(true);
		expect(status.totalCorrect).toBe(true);
		expect(status.valid).toBe(true);
	});

	it('marks invalid when total is wrong', () => {
		const values = { str: 50, con: 50, dex: 50, int: 50, pow: 50, app: 50, siz: 60, edu: 60 };
		const status = pointBuyStatus(values);
		expect(status.total).toBe(420);
		expect(status.remaining).toBe(40);
		expect(status.totalCorrect).toBe(false);
		expect(status.valid).toBe(false);
	});

	it('marks invalid when any value is below 15', () => {
		const values = { str: 14, con: 60, dex: 60, int: 60, pow: 60, app: 60, siz: 70, edu: 76 };
		const status = pointBuyStatus(values);
		expect(status.allInRange).toBe(false);
		expect(status.valid).toBe(false);
	});

	it('marks invalid when any value is above 90', () => {
		const values = { str: 91, con: 50, dex: 50, int: 50, pow: 50, app: 50, siz: 50, edu: 69 };
		const status = pointBuyStatus(values);
		expect(status.allInRange).toBe(false);
		expect(status.valid).toBe(false);
	});

	it('total constant equals 460', () => {
		expect(POINT_BUY_TOTAL).toBe(460);
	});
});

describe('isQuickFireAssignment', () => {
	it('accepts the canonical pool by count, not order', () => {
		const values = { str: 80, con: 70, dex: 60, int: 60, pow: 50, app: 50, siz: 50, edu: 40 };
		expect(isQuickFireAssignment(values)).toBe(true);
	});

	it('accepts the rulebook example assignment', () => {
		const values = { str: 40, con: 50, dex: 50, int: 50, pow: 60, app: 60, siz: 70, edu: 80 };
		expect(isQuickFireAssignment(values)).toBe(true);
	});

	it('rejects when a pool value count is wrong', () => {
		// Three 50s required; here only two
		const values = { str: 40, con: 50, dex: 50, int: 60, pow: 60, app: 60, siz: 70, edu: 80 };
		expect(isQuickFireAssignment(values)).toBe(false);
	});

	it('rejects when an out-of-pool value appears', () => {
		const values = { str: 40, con: 50, dex: 50, int: 50, pow: 60, app: 60, siz: 70, edu: 90 };
		expect(isQuickFireAssignment(values)).toBe(false);
	});

	it('rejects all-zero (cleared) state', () => {
		const values = { str: 0, con: 0, dex: 0, int: 0, pow: 0, app: 0, siz: 0, edu: 0 };
		expect(isQuickFireAssignment(values)).toBe(false);
	});
});

describe('quickFireAvailableCounts', () => {
	it('reports zero remaining for a complete assignment', () => {
		const values = { str: 40, con: 50, dex: 50, int: 50, pow: 60, app: 60, siz: 70, edu: 80 };
		const counts = quickFireAvailableCounts(values);
		expect(counts.get(40)).toBe(0);
		expect(counts.get(50)).toBe(0);
		expect(counts.get(60)).toBe(0);
		expect(counts.get(70)).toBe(0);
		expect(counts.get(80)).toBe(0);
	});

	it('reports the full pool for an empty assignment', () => {
		const values = { str: 0, con: 0, dex: 0, int: 0, pow: 0, app: 0, siz: 0, edu: 0 };
		const counts = quickFireAvailableCounts(values);
		expect(counts.get(40)).toBe(1);
		expect(counts.get(50)).toBe(3);
		expect(counts.get(60)).toBe(2);
		expect(counts.get(70)).toBe(1);
		expect(counts.get(80)).toBe(1);
	});

	it('shows remaining 50s when only one slot holds 50', () => {
		const values = { str: 50, con: 0, dex: 0, int: 0, pow: 0, app: 0, siz: 0, edu: 0 };
		const counts = quickFireAvailableCounts(values);
		expect(counts.get(50)).toBe(2);
	});

	it('quick-fire pool exposes the documented values', () => {
		expect([...QUICK_FIRE_VALUES]).toEqual([40, 50, 50, 50, 60, 60, 70, 80]);
	});
});

describe('isReconcileTokenFresh', () => {
	it('returns true when token matches the current generation', () => {
		expect(isReconcileTokenFresh(5, 5)).toBe(true);
	});

	it('returns false after the generation has advanced', () => {
		expect(isReconcileTokenFresh(5, 6)).toBe(false);
		expect(isReconcileTokenFresh(0, 1)).toBe(false);
	});

	it('treats undefined token as always-fresh (manual / non-reconciled callers)', () => {
		expect(isReconcileTokenFresh(undefined, 0)).toBe(true);
		expect(isReconcileTokenFresh(undefined, 99)).toBe(true);
	});
});

describe('quickFireSwapAssignment', () => {
	const base = { str: 40, con: 50, dex: 50, int: 50, pow: 60, app: 60, siz: 70, edu: 80 } as Record<CharacteristicId, number>;

	it('no-op when picking the value already held', () => {
		const next = quickFireSwapAssignment(base, 'str', 40);
		expect(next).toEqual(base);
	});

	it('swaps when picking a value already exhausted in the pool (single holder)', () => {
		// Pool: 40 has count 1 — already on STR. Picking 40 for EDU swaps STR→80, EDU→40
		const next = quickFireSwapAssignment(base, 'edu', 40);
		expect(next.edu).toBe(40);
		expect(next.str).toBe(80); // EDU's old value moved to STR
		// Counts still match the pool
		expect(isQuickFireAssignment(next)).toBe(true);
	});

	it('preserves pool integrity when picking a value with remaining count', () => {
		const partial = { str: 40, con: 50, dex: 0, int: 0, pow: 60, app: 60, siz: 70, edu: 80 } as Record<CharacteristicId, number>;
		// 50 still has 2 remaining, no swap needed
		const next = quickFireSwapAssignment(partial, 'dex', 50);
		expect(next.dex).toBe(50);
		expect(next.con).toBe(50); // unchanged
	});
});
