/**
 * Wizard state store — persists to localStorage across page navigations.
 * Follows OpenPentacle's pattern: writable store + manual serialization.
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { createBlankCharacter, type CoCCharacterData } from '$lib/types/character';

const STORAGE_KEY = 'mur-wizard-state';
const WIZARD_STATE_VERSION = 2;

export interface WizardState {
	version: number;
	active: boolean;
	currentStep: number;
	completedSteps: number[];
	character: CoCCharacterData;
}

function createInitialState(): WizardState {
	return {
		version: WIZARD_STATE_VERSION,
		active: false,
		currentStep: 0,
		completedSteps: [],
		character: createBlankCharacter()
	};
}

function loadFromStorage(): WizardState {
	if (!browser) return createInitialState();

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return createInitialState();

		const parsed = JSON.parse(raw) as WizardState;
		if (parsed.version !== WIZARD_STATE_VERSION) {
			localStorage.removeItem(STORAGE_KEY);
			return createInitialState();
		}
		return parsed;
	} catch {
		return createInitialState();
	}
}

function saveToStorage(state: WizardState): void {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createWizardStore() {
	const initial = loadFromStorage();
	const { subscribe, set, update } = writable<WizardState>(initial);

	// Auto-persist on changes
	subscribe((state) => {
		saveToStorage(state);
	});

	return {
		subscribe,

		/** Start a new character creation wizard */
		start() {
			const state = createInitialState();
			state.active = true;
			state.currentStep = 0;
			state.character = createBlankCharacter();
			set(state);
		},

		/** Update the character data */
		updateCharacter(updater: (char: CoCCharacterData) => CoCCharacterData) {
			update((s) => ({
				...s,
				character: updater(s.character)
			}));
		},

		/** Mark the current step as complete and advance */
		completeStep(stepIndex: number) {
			update((s) => {
				const completed = s.completedSteps.some((step) => step === stepIndex)
					? s.completedSteps
					: [...s.completedSteps, stepIndex];
				return {
					...s,
					completedSteps: completed,
					currentStep: stepIndex + 1
				};
			});
		},

		/** Navigate to a specific step */
		goToStep(stepIndex: number) {
			update((s) => ({ ...s, currentStep: stepIndex }));
		},

		/** Check if a step is accessible (completed or current) */
		isStepAccessible(stepIndex: number): boolean {
			const state = get({ subscribe });
			return stepIndex <= state.currentStep || state.completedSteps.some((step) => step === stepIndex);
		},

		/** Clear the wizard and reset */
		reset() {
			const state = createInitialState();
			set(state);
			if (browser) localStorage.removeItem(STORAGE_KEY);
		}
	};
}

export const wizard = createWizardStore();

/** Wizard step definitions */
export const WIZARD_STEPS = [
	{ id: 'characteristics', label: 'Characteristics', path: '/create/coc7e/characteristics' },
	{ id: 'occupation', label: 'Occupation', path: '/create/coc7e/occupation' },
	{ id: 'skills', label: 'Skills', path: '/create/coc7e/skills' },
	{ id: 'backstory', label: 'Backstory', path: '/create/coc7e/backstory' },
	{ id: 'equipment', label: 'Equipment', path: '/create/coc7e/equipment' },
	{ id: 'review', label: 'Review', path: '/create/coc7e/review' }
] as const;
