/**
 * Atmosphere store — programmatic triggers for ephemeral environmental effects.
 *
 * Effects defined here intentionally do not fire on a schedule from this module.
 * Callers (era toggle, future Sanity-loss handlers, etc.) decide when to call
 * triggerEldritchFlash() / triggerEraTransition(). Each call sets a transient
 * attribute or class on <html> for the configured duration; CSS in
 * `src/lib/themes/effects.css` reacts to that selector.
 *
 * Reduced motion is respected at the CSS layer — these triggers may fire freely;
 * the keyframe rules are no-ops when prefers-reduced-motion is set.
 */
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const ELDRITCH_CLASS = 'eldritch-glitching';
const ELDRITCH_DEFAULT_MS = 600;
const ERA_TRANSITION_MS = 700;

let eldritchTimeout: ReturnType<typeof setTimeout> | null = null;
let eraTransitionTimeout: ReturnType<typeof setTimeout> | null = null;

/** Public-readable flag, mostly for UI badges / dev affordances. */
export const eldritchFlashActive = writable(false);

/**
 * Apply a brief eldritch displacement + chromatic-aberration overlay to the
 * page. Safe to call repeatedly — overlapping calls extend the active window.
 */
export function triggerEldritchFlash(durationMs: number = ELDRITCH_DEFAULT_MS): void {
	if (!browser) return;
	document.documentElement.classList.add(ELDRITCH_CLASS);
	eldritchFlashActive.set(true);

	if (eldritchTimeout) clearTimeout(eldritchTimeout);
	eldritchTimeout = setTimeout(() => {
		document.documentElement.classList.remove(ELDRITCH_CLASS);
		eldritchFlashActive.set(false);
		eldritchTimeout = null;
	}, durationMs);
}

/**
 * Mark <html> with `data-era-transitioning="modern-in" | "classic-in"` so the
 * CSS keyframes (CRT degauss / sepia fade-in) play once. Clears the attribute
 * after the animation is expected to have finished.
 */
export function triggerEraTransition(direction: 'modern-in' | 'classic-in'): void {
	if (!browser) return;
	document.documentElement.setAttribute('data-era-transitioning', direction);

	if (eraTransitionTimeout) clearTimeout(eraTransitionTimeout);
	eraTransitionTimeout = setTimeout(() => {
		document.documentElement.removeAttribute('data-era-transitioning');
		eraTransitionTimeout = null;
	}, ERA_TRANSITION_MS);
}
