/**
 * Restrained-eerie Svelte transitions for the wizard flow.
 *
 * Honors both `prefers-reduced-motion` and the project-level `data-reduce-effects`
 * toggle on <html> (set by the user-effects setting). When either is active,
 * transitions resolve immediately with no visible animation.
 *
 * Tone target: 1920s registrar / paper-and-ink. Durations match the existing
 * atmosphere layer (sepia-fade-in 600ms, CRT degauss 700ms) — short, settling
 * into stillness, never spectacle.
 */
import { browser } from '$app/environment';
import { fade, fly, type FadeParams, type FlyParams } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';

const NOOP: TransitionConfig = { duration: 0 };

function shouldReduce(): boolean {
	if (!browser) return false;
	if (document.documentElement.dataset.reduceEffects === 'true') return true;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Brief sepia-tinged fade. Used for wizard step transitions — the "page turn"
 * moment when the registrar files the previous form.
 */
export function ledgerPage(node: Element, params: FadeParams = {}): TransitionConfig {
	if (shouldReduce()) return NOOP;
	return fade(node, { duration: 220, easing: cubicOut, ...params });
}

/**
 * Short upward fly + fade, intended for individual rows or stat cells appearing
 * one at a time. The `delay` param is how stagger is composed: the caller passes
 * `{ delay: i * 60 }` on each iteration of an each block.
 */
export function inkBleed(node: Element, params: FlyParams = {}): TransitionConfig {
	if (shouldReduce()) return NOOP;
	return fly(node, { duration: 280, y: 6, easing: cubicOut, ...params });
}

/**
 * Slightly larger entrance for whole sections on the review page — the dossier
 * compiling itself top-to-bottom.
 */
export function dossierFiling(node: Element, params: FlyParams = {}): TransitionConfig {
	if (shouldReduce()) return NOOP;
	return fly(node, { duration: 320, y: 8, easing: cubicOut, ...params });
}
