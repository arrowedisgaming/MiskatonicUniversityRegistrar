import type { LayoutServerLoad } from './$types';
import { loadWizardData } from '$lib/server/content/loader';

export const load: LayoutServerLoad = async () => {
	const { contentPack, skills, occupations, equipment, names, backstoryTables } = loadWizardData();
	return {
		contentPack,
		skills,
		occupations,
		equipment,
		names,
		backstoryTables
	};
};
