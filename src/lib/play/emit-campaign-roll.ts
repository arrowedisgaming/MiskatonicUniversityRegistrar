import type { PlayRollHistoryEntry } from '$lib/types/character';

/**
 * Mirror a player's roll into every active campaign log this investigator
 * belongs to.
 *
 * Fire-and-forget by design. The player's own `playRollHistory` is the
 * source of truth on their screen; if the POST fails (network blip, server
 * 5xx) we accept that the Keeper's log misses one entry rather than block
 * the dice animation or the surrounding `persistInvestigator` call.
 *
 * Called from `appendPlayHistory` at src/routes/sheet/[id]/+page.svelte —
 * one hook reaches every roll category (characteristic, skill, weapon
 * damage, SAN, development, generic dice).
 *
 * NB: only the `entry` is sent. The server attaches the canonical
 * investigator name from the joined membership row — the client cannot
 * forge attribution.
 */
export function emitCampaignRoll(campaignIds: string[], entry: PlayRollHistoryEntry): void {
	if (campaignIds.length === 0) return;
	for (const id of campaignIds) {
		// No `await`. Errors are swallowed: the local history already has the
		// entry and the keeper poll will pick up subsequent rolls.
		fetch(`/api/campaigns/${id}/rolls`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ entry })
		}).catch(() => {});
	}
}
