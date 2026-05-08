import { describe, it, expect } from 'vitest';
import { createBlankCharacter } from '$lib/types/character';
import { validateFinalInvestigator } from '$lib/server/validation/investigator';
import { getOccupations } from '$lib/server/content/loader';
import { calculateOccupationSkillPoints, calculatePersonalInterestPoints } from '$lib/engine/skills';
import { calculateAllDerived } from '$lib/engine/derived-stats';
import { getContentPack } from '$lib/server/content/loader';

function buildValidFinal() {
	const char = createBlankCharacter();
	char.isDraft = false;
	char.name = 'Dr. Henry Armitage';
	char.age = 50;

	const characteristics = { str: 50, con: 60, dex: 60, int: 80, pow: 70, app: 60, siz: 60, edu: 80 };
	char.characteristics.values = characteristics;
	char.characteristics.baseValues = characteristics;

	const occ = getOccupations().find((o) => o.id === 'professor');
	if (!occ) throw new Error('professor occupation missing — content pack regression');
	char.occupation = { occupationId: 'professor', formulaChoices: {} };

	const occPoints = calculateOccupationSkillPoints(occ.skillPointFormula, characteristics);
	const personalPoints = calculatePersonalInterestPoints(characteristics.int);

	// Spend at least the credit-rating minimum on Credit Rating to satisfy the occupation range.
	const creditRatingPoints = occ.creditRating.min;
	char.skills = [
		{
			skillId: 'credit-rating',
			customName: null,
			baseValue: 0,
			allocations: [
				{
					points: creditRatingPoints,
					source: 'occupation',
					sourceLabel: 'Occupation skill points'
				}
			],
			isOccupation: true,
			total: creditRatingPoints,
			half: Math.floor(creditRatingPoints / 2),
			fifth: Math.floor(creditRatingPoints / 5)
		}
	];

	const pack = getContentPack();
	const derived = calculateAllDerived(
		characteristics,
		char.age,
		0,
		pack.damageBonusBuildTable,
		pack.ageModifiers
	);
	char.derivedStats = {
		hp: { max: derived.hp, current: derived.hp },
		mp: { max: derived.mp, current: derived.mp },
		sanity: {
			max: derived.maxSanity,
			current: derived.startingSanity,
			startingValue: derived.startingSanity
		},
		luck: { max: 50, current: 50, rolls: null },
		damageBonus: derived.damageBonus,
		build: derived.build,
		moveRate: derived.moveRate
	};

	return { char, occPoints, personalPoints };
}

describe('validateFinalInvestigator', () => {
	it('accepts a properly-built final investigator', () => {
		const { char } = buildValidFinal();
		const result = validateFinalInvestigator(char);
		expect(result.valid).toBe(true);
	});

	it('rejects when occupation is missing', () => {
		const { char } = buildValidFinal();
		char.occupation = null;
		const result = validateFinalInvestigator(char);
		expect(result.valid).toBe(false);
	});

	it('rejects HP max that exceeds engine-derived value (anti-tamper)', () => {
		const { char } = buildValidFinal();
		char.derivedStats.hp.max = 999;
		const result = validateFinalInvestigator(char);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some((e) => e.includes('HP max'))).toBe(true);
		}
	});

	it('accepts a player-chosen occupation slot skill (e.g. interpersonal pick) as occupation-eligible', () => {
		const { char } = buildValidFinal();
		// Simulate the wizard marking 'persuade' as one of the occupation slot picks.
		// 'persuade' is not in professor.occupationSkills, so the validator must accept
		// it because the submission flags isOccupation: true.
		char.skills.push({
			skillId: 'persuade',
			customName: null,
			baseValue: 10,
			allocations: [{ points: 30, source: 'occupation', sourceLabel: 'Occupation skill points' }],
			isOccupation: true,
			total: 40,
			half: 20,
			fifth: 8
		});
		const result = validateFinalInvestigator(char);
		expect(result.valid).toBe(true);
	});

	it('rejects when a characteristic value is NaN — guards the budget math', () => {
		const { char } = buildValidFinal();
		// Simulate a forged payload that bypasses Zod (or pre-Zod older drafts):
		// a missing characteristic would feed undefined into the formula and
		// produce NaN, which would silently pass the > comparisons.
		(char.characteristics.values as Record<string, unknown>).int = undefined;
		const result = validateFinalInvestigator(char);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some((e) => e.includes('INT'))).toBe(true);
		}
	});

	it('accepts a gaslight-era investigator', () => {
		const { char } = buildValidFinal();
		char.era = 'gaslight';
		const result = validateFinalInvestigator(char);
		expect(result.valid).toBe(true);
	});

	it('rejects skill point overspend', () => {
		const { char } = buildValidFinal();
		// Professor budget is EDU×4 = 320. Spend 5 × 99 = 495 to blow past it.
		const occ = getOccupations().find((o) => o.id === 'professor')!;
		for (let i = 0; i < 5; i++) {
			const skillId = occ.occupationSkills[i % occ.occupationSkills.length].skillId;
			char.skills.push({
				skillId: `${skillId}-${i}`,
				customName: null,
				baseValue: 0,
				allocations: [{ points: 99, source: 'occupation', sourceLabel: 'overspend' }],
				isOccupation: true,
				total: 99,
				half: 49,
				fifth: 19
			});
		}
		const result = validateFinalInvestigator(char);
		expect(result.valid).toBe(false);
	});

	it('enforces the 90 skill cap during creation finalization', () => {
		const { char } = buildValidFinal();
		char.skills.push({
			skillId: 'library-use',
			customName: null,
			baseValue: 91,
			allocations: [],
			isOccupation: false,
			total: 91,
			half: 45,
			fifth: 18
		});

		const result = validateFinalInvestigator(char, { phase: 'creation' });
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.errors.some((e) => e.includes('maximum of 90'))).toBe(true);
	});

	it('allows post-creation sheet edits up to 99', () => {
		const { char } = buildValidFinal();
		char.skills.push({
			skillId: 'library-use',
			customName: null,
			baseValue: 99,
			allocations: [],
			isOccupation: false,
			total: 99,
			half: 49,
			fifth: 19
		});

		const result = validateFinalInvestigator(char, { phase: 'play' });
		expect(result.valid).toBe(true);
	});

	it('rejects a finalized investigator carrying blank-name weapon rows', () => {
		const { char } = buildValidFinal();
		char.equipment.weapons.push({
			name: '   ',
			damage: '1d6',
			range: 'touch',
			attacksPerRound: '1',
			ammo: null,
			malfunction: null
		});

		const result = validateFinalInvestigator(char);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.errors.some((e) => /blank weapon row/i.test(e))).toBe(true);
		}
	});
});
