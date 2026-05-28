import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emitCampaignRoll } from '$lib/play/emit-campaign-roll';
import type { PlayRollHistoryGenericDiceEntry } from '$lib/types/character';

const ENTRY: PlayRollHistoryGenericDiceEntry = {
	id: 'r-1',
	at: '2026-05-28T00:00:00.000Z',
	targetKind: 'genericDice',
	sides: 6,
	count: 1,
	modifier: 0,
	rolls: [4],
	total: 4
};

describe('emitCampaignRoll', () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('is a no-op when there are no active campaigns (does not call fetch)', () => {
		emitCampaignRoll([], ENTRY);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('POSTs to /api/campaigns/:id/rolls for each campaign id', () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
		emitCampaignRoll(['camp-a', 'camp-b'], ENTRY);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0][0]).toBe('/api/campaigns/camp-a/rolls');
		const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
		// Body must NOT include investigatorName — server attaches it from the
		// joined membership row so a player can't forge attribution.
		expect(body).toEqual({ entry: ENTRY });
		expect(body).not.toHaveProperty('investigatorName');
		expect(fetchMock.mock.calls[1][0]).toBe('/api/campaigns/camp-b/rolls');
	});

	it('swallows network failures — the caller never sees a rejection', async () => {
		fetchMock.mockRejectedValue(new Error('network down'));
		// Should not throw synchronously…
		expect(() => emitCampaignRoll(['camp-a'], ENTRY)).not.toThrow();
		// …and the unhandled rejection from fetch is consumed by the .catch.
		// Flush microtasks: if the promise were leaking, vitest's unhandled
		// rejection handler would have surfaced it here.
		await new Promise((r) => setImmediate(r));
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('does not await — returns synchronously even when fetch is slow', () => {
		// Pending forever
		fetchMock.mockReturnValue(new Promise(() => {}));
		const start = Date.now();
		emitCampaignRoll(['camp-a', 'camp-b', 'camp-c'], ENTRY);
		const elapsed = Date.now() - start;
		// If the helper awaited, this would block. 50ms is a generous ceiling
		// for the synchronous bookkeeping.
		expect(elapsed).toBeLessThan(50);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
});
