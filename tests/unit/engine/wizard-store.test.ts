import { describe, it, expect } from 'vitest';
import { isPristineDraft, migrateWizardState, type WizardState } from '$lib/stores/wizard';
import { createBlankCharacter } from '$lib/types/character';

function makeFreshActiveState(): WizardState {
	return {
		version: 3,
		active: true,
		currentStep: 0,
		completedSteps: [],
		character: createBlankCharacter(),
		nonce: 0
	};
}

describe('isPristineDraft', () => {
	it('treats an inactive wizard as pristine', () => {
		const state = makeFreshActiveState();
		state.active = false;
		expect(isPristineDraft(state)).toBe(true);
	});

	it('treats a freshly-started wizard on step 0 as pristine', () => {
		expect(isPristineDraft(makeFreshActiveState())).toBe(true);
	});

	it('marks step-1 progress as in-progress', () => {
		const state = makeFreshActiveState();
		state.currentStep = 1;
		expect(isPristineDraft(state)).toBe(false);
	});

	it('marks any completed step as in-progress', () => {
		const state = makeFreshActiveState();
		state.completedSteps = [0];
		expect(isPristineDraft(state)).toBe(false);
	});

	it('marks a name change as in-progress', () => {
		const state = makeFreshActiveState();
		state.character.name = 'Jane Doe';
		expect(isPristineDraft(state)).toBe(false);
	});

	it('marks an age change as in-progress', () => {
		const state = makeFreshActiveState();
		state.character.age = 42;
		expect(isPristineDraft(state)).toBe(false);
	});

	it('marks an era change as in-progress', () => {
		const state = makeFreshActiveState();
		state.character.era = 'gaslight';
		expect(isPristineDraft(state)).toBe(false);
	});

	it('marks a method change as in-progress', () => {
		const state = makeFreshActiveState();
		state.character.characteristics.method = 'quick-fire';
		expect(isPristineDraft(state)).toBe(false);
	});

	it('marks any base-value change as in-progress', () => {
		const state = makeFreshActiveState();
		state.character.characteristics.baseValues.str = 80;
		expect(isPristineDraft(state)).toBe(false);
	});
});

describe('migrateWizardState', () => {
	function v2State() {
		const character = createBlankCharacter();
		character.characteristics.method = 'arrange-rolls'; // legacy method that v2 allowed
		character.name = 'Edith Penhallick';
		return {
			version: 2,
			active: true,
			currentStep: 3,
			completedSteps: [0, 1, 2],
			character
		};
	}

	it('promotes a v2 draft to v3 without losing user progress', () => {
		const migrated = migrateWizardState(v2State());
		expect(migrated).not.toBeNull();
		expect(migrated!.version).toBe(3);
		expect(migrated!.currentStep).toBe(3);
		expect(migrated!.completedSteps).toEqual([0, 1, 2]);
		expect(migrated!.character.name).toBe('Edith Penhallick');
		// Legacy method preserved (not silently rewritten)
		expect(migrated!.character.characteristics.method).toBe('arrange-rolls');
	});

	it('passes through a v3 state untouched in shape', () => {
		const character = createBlankCharacter();
		const v3 = {
			version: 3,
			active: true,
			currentStep: 1,
			completedSteps: [0],
			character
		};
		const migrated = migrateWizardState(v3);
		expect(migrated).not.toBeNull();
		expect(migrated!.version).toBe(3);
		expect(migrated!.currentStep).toBe(1);
	});

	it('defaults nonce to 0 for v2 drafts that lack the field', () => {
		const draft = v2State();
		const migrated = migrateWizardState(draft);
		expect(migrated).not.toBeNull();
		expect(migrated!.nonce).toBe(0);
	});

	it('preserves a numeric nonce on v3 inputs', () => {
		const character = createBlankCharacter();
		const v3 = {
			version: 3,
			active: true,
			currentStep: 1,
			completedSteps: [0],
			character,
			nonce: 17
		};
		const migrated = migrateWizardState(v3);
		expect(migrated).not.toBeNull();
		expect(migrated!.nonce).toBe(17);
	});

	it('returns null for unrecoverable shapes (no character)', () => {
		expect(migrateWizardState({ version: 2, currentStep: 0 })).toBeNull();
		expect(migrateWizardState(null)).toBeNull();
		expect(migrateWizardState('not-an-object')).toBeNull();
	});

	it('returns null for unknown versions older than v2', () => {
		const character = createBlankCharacter();
		const v0 = { version: 0, active: true, currentStep: 0, completedSteps: [], character };
		expect(migrateWizardState(v0)).toBeNull();
	});

	it('coerces an unrecognised method on v2 draft load to point-buy', () => {
		const draft = v2State();
		(draft.character.characteristics as { method: unknown }).method = 'made-up';
		const migrated = migrateWizardState(draft);
		expect(migrated).not.toBeNull();
		expect(migrated!.character.characteristics.method).toBe('point-buy');
	});
});
