/**
 * Wizard state store — persists to localStorage across page navigations.
 * Follows OpenPentacle's pattern: writable store + manual serialization.
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { createBlankCharacter, type CoCCharacterData } from '$lib/types/character';
import { normalizeStoredMethod } from '$lib/types/content-pack';

const STORAGE_KEY = 'mur-wizard-state';
const WIZARD_STATE_VERSION = 3;

export interface WizardState {
	version: number;
	active: boolean;
	currentStep: number;
	completedSteps: number[];
	character: CoCCharacterData;
	/**
	 * Monotonic counter that bumps on every `reset()` / `start()`. Consumers
	 * (notably WizardShell) key their step-content `{#key}` on this so the
	 * +page.svelte components remount and reinitialise their local `$state`
	 * from the freshly-blank store. Without this, "Start over" while on a
	 * step would clear `$wizard.character` but the page-local state
	 * (baseValues, method, allocations…) would persist because navigating
	 * from /characteristics to /characteristics is a no-op.
	 */
	nonce: number;
}

export interface WizardDraftSummary {
	name: string;
	currentStep: number;
}

function createInitialState(): WizardState {
	return {
		version: WIZARD_STATE_VERSION,
		active: false,
		currentStep: 0,
		completedSteps: [],
		character: createBlankCharacter(),
		nonce: 0
	};
}

function createFreshActiveState(prevNonce: number): WizardState {
	const state = createInitialState();
	state.active = true;
	state.nonce = prevNonce + 1;
	return state;
}

/**
 * A pristine draft is one whose only difference from a fresh active wizard is
 * that the user just landed on step 1 — no completed steps, no character edits
 * beyond the blank-character defaults.
 */
export function isPristineDraft(state: WizardState): boolean {
	if (!state.active) return true;
	if (state.currentStep > 0) return false;
	if (state.completedSteps.length > 0) return false;
	const blank = createBlankCharacter();
	// Compare the user-editable fields that would change as soon as the player
	// touches the wizard. Characteristics are the first step, so any deviation
	// from the blank base values means the user has begun.
	if (state.character.name.trim() !== blank.name.trim()) return false;
	if (state.character.age !== blank.age) return false;
	if (state.character.era !== blank.era) return false;
	if (state.character.characteristics.method !== blank.characteristics.method) return false;
	const baseKeys = Object.keys(blank.characteristics.baseValues) as (keyof typeof blank.characteristics.baseValues)[];
	for (const k of baseKeys) {
		if (state.character.characteristics.baseValues[k] !== blank.characteristics.baseValues[k]) return false;
	}
	return true;
}

function normalizeLoadedCharacter(character: CoCCharacterData): CoCCharacterData {
	return {
		...character,
		characteristics: {
			...character.characteristics,
			// Preserve legacy method ids in the wizard draft just like we do in
			// stored characters; the characteristics page resolves to an
			// editable proxy at render time.
			method: normalizeStoredMethod(character.characteristics?.method)
		}
	};
}

/**
 * Migrate a parsed wizard-state blob to the current version, preserving as
 * much user progress as possible. Returns null only when the blob is
 * unrecoverable (corrupt JSON shape, missing required fields).
 */
export function migrateWizardState(parsed: unknown): WizardState | null {
	if (!parsed || typeof parsed !== 'object') return null;
	const candidate = parsed as Partial<WizardState> & { version?: unknown };

	if (!candidate.character || typeof candidate.character !== 'object') return null;
	if (typeof candidate.currentStep !== 'number') return null;

	const version = typeof candidate.version === 'number' ? candidate.version : 0;

	// v2 → v3: the only schema change was widening the supported method set
	// and preserving legacy method ids in storage. The on-disk shape is
	// unchanged, so a v2 draft can be promoted by bumping the version and
	// running the standard normalize pass. No user data is discarded.
	if (version === 2 || version === WIZARD_STATE_VERSION) {
		return {
			version: WIZARD_STATE_VERSION,
			active: candidate.active === true,
			currentStep: candidate.currentStep,
			completedSteps: Array.isArray(candidate.completedSteps) ? candidate.completedSteps : [],
			character: normalizeLoadedCharacter(candidate.character as CoCCharacterData),
			// `nonce` was added in v3; v2 drafts (and any v3 written before
			// this field existed) get 0 as the starting epoch. Subsequent
			// reset/start calls bump from there.
			nonce: typeof (candidate as { nonce?: unknown }).nonce === 'number'
				? (candidate as { nonce: number }).nonce
				: 0
		};
	}

	// Older or unknown versions: we have no upgrade path so the draft cannot
	// be safely resumed. Returning null causes the caller to discard.
	return null;
}

function loadFromStorage(): WizardState {
	if (!browser) return createInitialState();

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return createInitialState();

		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			localStorage.removeItem(STORAGE_KEY);
			return createInitialState();
		}

		const migrated = migrateWizardState(parsed);
		if (!migrated) {
			localStorage.removeItem(STORAGE_KEY);
			return createInitialState();
		}
		return migrated;
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
			update((s) => createFreshActiveState(s.nonce ?? 0));
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

		/**
		 * True when the user has actively progressed in the wizard. A freshly-
		 * `start()`-ed wizard sitting on step 0 with default values does not count.
		 */
		hasInProgressDraft(): boolean {
			const state = get({ subscribe });
			return state.active && !isPristineDraft(state);
		},

		/** Compact view of the current draft for landing-page display. */
		draftSummary(): WizardDraftSummary {
			const state = get({ subscribe });
			return {
				name: state.character.name?.trim() || 'Unnamed Investigator',
				currentStep: state.currentStep
			};
		},

		/** Clear the wizard and reset (preserves the monotonic nonce so a
		 *  subsequent step-page mount sees a key change and remounts). */
		reset() {
			update((s) => {
				const state = createInitialState();
				state.nonce = (s.nonce ?? 0) + 1;
				return state;
			});
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
