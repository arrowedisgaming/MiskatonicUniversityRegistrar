/** The eight CoC 7e characteristics */
export type CharacteristicId = 'str' | 'con' | 'dex' | 'int' | 'pow' | 'app' | 'siz' | 'edu';

export const ALL_CHARACTERISTICS: CharacteristicId[] = [
	'str',
	'con',
	'dex',
	'int',
	'pow',
	'app',
	'siz',
	'edu'
];

export const CHARACTERISTIC_LABELS: Record<CharacteristicId, string> = {
	str: 'Strength',
	con: 'Constitution',
	dex: 'Dexterity',
	int: 'Intelligence',
	pow: 'Power',
	app: 'Appearance',
	siz: 'Size',
	edu: 'Education'
};

/** Characteristics rolled with 3d6×5 */
export const ROLL_3D6: CharacteristicId[] = ['str', 'con', 'dex', 'app', 'pow'];

/** Characteristics rolled with (2d6+6)×5 */
export const ROLL_2D6_PLUS_6: CharacteristicId[] = ['siz', 'int', 'edu'];

export type SkillCategory =
	| 'combat'
	| 'investigation'
	| 'social'
	| 'academic'
	| 'practical'
	| 'other';

export type Era = '1920s' | 'modern' | 'gaslight';

export type Mode = 'standard' | 'pulp';
