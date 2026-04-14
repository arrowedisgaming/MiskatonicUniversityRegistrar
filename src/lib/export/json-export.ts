/**
 * JSON export — complete character data with schema version.
 * Importable back into the app.
 */

import type { CoCCharacterData } from '$lib/types/character';

export interface ExportedInvestigator {
	exportFormat: 'miskatonic-university-registrar';
	exportVersion: 1;
	exportedAt: string;
	investigator: CoCCharacterData;
}

export function exportToJSON(character: CoCCharacterData): ExportedInvestigator {
	return {
		exportFormat: 'miskatonic-university-registrar',
		exportVersion: 1,
		exportedAt: new Date().toISOString(),
		investigator: character
	};
}
