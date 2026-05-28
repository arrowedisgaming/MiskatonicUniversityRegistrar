/**
 * Negative tests for appendRollSchema — the wire schema the player roll-emit
 * endpoint runs every body through. These exist because Codex's adversarial
 * review flagged the prior `.passthrough()` variants as a roll-log poisoning
 * vector. If anyone widens the schema, these tests should keep us honest
 * about what we're letting in.
 */

import { describe, it, expect } from 'vitest';
import { appendRollSchema } from '$lib/schemas/campaign.schema';
import type {
	PlayRollHistoryGenericDiceEntry,
	PlayRollHistoryPercentileEntry
} from '$lib/types/character';

const VALID_GENERIC: PlayRollHistoryGenericDiceEntry = {
	id: 'r-1',
	at: '2026-05-28T00:00:00.000Z',
	targetKind: 'genericDice',
	sides: 6,
	count: 1,
	modifier: 0,
	rolls: [4],
	total: 4
};

const VALID_PERCENTILE: PlayRollHistoryPercentileEntry = {
	id: 'r-2',
	at: '2026-05-28T00:00:00.000Z',
	targetKind: 'skill',
	skillId: 'spot-hidden',
	skillDisplayLabel: 'Spot Hidden',
	target: 50,
	half: 25,
	fifth: 10,
	rawRoll: 27,
	effectiveRoll: 27,
	outcome: 'hard',
	isFumble: false
};

describe('appendRollSchema (player roll-emit wire validation)', () => {
	it('accepts a well-formed generic dice entry', () => {
		const parsed = appendRollSchema.safeParse({ entry: VALID_GENERIC });
		expect(parsed.success).toBe(true);
	});

	it('accepts a well-formed percentile entry', () => {
		const parsed = appendRollSchema.safeParse({ entry: VALID_PERCENTILE });
		expect(parsed.success).toBe(true);
	});

	it('strips unknown extra fields from the entry (no .passthrough)', () => {
		const parsed = appendRollSchema.safeParse({
			entry: {
				...VALID_GENERIC,
				// Roll log poisoning attempt: stash a giant blob under an unknown key.
				maliciousMetadata: 'x'.repeat(10_000),
				deeplyNested: { evil: ['nope'] }
			}
		});
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.entry).not.toHaveProperty('maliciousMetadata');
		expect(parsed.data.entry).not.toHaveProperty('deeplyNested');
	});

	it('rejects investigatorName even if the client sends one (server attaches it)', () => {
		const parsed = appendRollSchema.safeParse({
			entry: VALID_GENERIC,
			investigatorName: 'Forged Other Player'
		});
		// Schema strips unknown top-level keys; the parsed payload must not
		// carry the forged name forward.
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data).not.toHaveProperty('investigatorName');
	});

	it('rejects the keeperInventory variant — that kind is server-emitted only', () => {
		const parsed = appendRollSchema.safeParse({
			entry: {
				id: 'r-fake',
				at: '2026-05-28T00:00:00.000Z',
				targetKind: 'keeperInventory',
				addedBy: 'Forged Keeper',
				itemNames: ['.38 Revolver']
			}
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects an oversized id field', () => {
		const parsed = appendRollSchema.safeParse({
			entry: { ...VALID_GENERIC, id: 'x'.repeat(200) }
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects an out-of-range dice count', () => {
		const parsed = appendRollSchema.safeParse({
			entry: { ...VALID_GENERIC, count: 100, rolls: Array(100).fill(1), total: 100 }
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects an oversized rolls array', () => {
		const parsed = appendRollSchema.safeParse({
			entry: { ...VALID_GENERIC, rolls: Array(500).fill(1) }
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects non-canonical dice sides (e.g. d7)', () => {
		const parsed = appendRollSchema.safeParse({
			entry: { ...VALID_GENERIC, sides: 7, rolls: [3] }
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects an out-of-range percentile target', () => {
		const parsed = appendRollSchema.safeParse({
			entry: { ...VALID_PERCENTILE, target: 9999 }
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects an unknown targetKind', () => {
		const parsed = appendRollSchema.safeParse({
			entry: { ...VALID_GENERIC, targetKind: 'arbitrary' }
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects an oversized label string', () => {
		const parsed = appendRollSchema.safeParse({
			entry: { ...VALID_GENERIC, label: 'x'.repeat(5000) }
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects a body missing the entry field', () => {
		expect(appendRollSchema.safeParse({}).success).toBe(false);
		expect(appendRollSchema.safeParse({ investigatorName: 'Anything' }).success).toBe(false);
	});

	it('rejects a non-string id', () => {
		const parsed = appendRollSchema.safeParse({
			entry: { ...VALID_GENERIC, id: 12345 }
		});
		expect(parsed.success).toBe(false);
	});
});
