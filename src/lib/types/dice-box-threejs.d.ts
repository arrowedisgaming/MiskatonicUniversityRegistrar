declare module '@3d-dice/dice-box-threejs' {
	export interface DiceBoxThreeConfig {
		assetPath?: string;
		framerate?: number;
		sounds?: boolean;
		volume?: number;
		color_spotlight?: number;
		shadows?: boolean;
		theme_surface?: string;
		theme_customColorset?: {
			name: string;
			foreground: string | string[];
			background: string | string[];
			outline: string | string[];
			edge?: string | string[];
			texture?: string;
			material?: string;
		};
		theme_colorset?: string;
		theme_texture?: string;
		theme_material?: string;
		gravity_multiplier?: number;
		light_intensity?: number;
		baseScale?: number;
		strength?: number;
		iterationLimit?: number;
		onRollComplete?: (result: unknown) => void;
	}

	/** Non-null dice theme from `theme_customColorset` — reuse for builders to avoid drift. */
	export type DiceThemeCustomColorset = NonNullable<DiceBoxThreeConfig['theme_customColorset']>;

	export default class DiceBoxThree {
		constructor(selector: string, config?: DiceBoxThreeConfig);
		initialize(): Promise<void>;
		updateConfig(config?: DiceBoxThreeConfig): Promise<void>;
		roll(notation: string): Promise<unknown>;
		clearDice(): void;
	}
}
