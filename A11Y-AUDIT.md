# Accessibility Audit — Miskatonic University Registrar

**Date:** 2026-05-03
**Scope:** WCAG 2.1 AA conformance, with text-contrast analysis across all four theme variants (classic-dark, classic-light, modern-dark, modern-light).
**Method:** Static analysis of `src/routes/`, `src/lib/components/`, and `src/lib/themes/`. No runtime/screen-reader testing performed — recommended as follow-up.

---

## Anti-Patterns Verdict

**PASS.** This codebase does **not** look AI-generated. Specific positives:

- Distinctive bespoke aesthetic (Lovecraftian Art Deco + 1980s CRT) — not generic shadcn defaults.
- No glassmorphism, no gradient text, no hero metrics, no AI-color-palette tells (purple/blue/teal).
- Original typography stack (Cinzel, Playfair, EB Garamond / IBM Plex Mono, VT323).
- Token-based theming (no `text-white`/`bg-black` slop).
- Native HTML form controls; semantic `<button>`/`<a>`/`<label>`.

The few smells are minor (one decorative motion effect could be quieter, see L-2 below) and intentional thematic choices (chromatic aberration on "eldritch flash") — not slop.

---

## Executive Summary

**Total findings:** 17
- **Critical:** 0
- **High:** 4
- **Medium:** 7
- **Low:** 6

**Top issues to fix first:**
1. **modern-dark muted text fails WCAG AA** (~3.3:1) — affects every "dim" caption/hint in the green-phosphor theme.
2. **modern-light primary-foreground on primary button fails AA** (~3.5:1) — off-white on amber.
3. **classic-dark / classic-light muted-on-muted is borderline** (~3.8–4.3:1) — fails AA body text in some surfaces.
4. **Buttons missing `type="button"`** (~35 occurrences) — latent submit-on-Enter bug.

**Overall quality:** Strong foundation. Skip link, landmarks, focus-visible, reduced-motion, 44px mobile touch targets, and `prefers-reduced-motion` are all correctly implemented at the layout/CSS layer. The gaps are concentrated in (a) muted-color contrast in two themes and (b) dynamic announcement (aria-live) coverage.

---

## Contrast Analysis (All Four Themes)

Approximate WCAG 2.1 contrast ratios, computed from oklch L values. Targets: **4.5:1** (AA body), **3:1** (AA large/UI), **7:1** (AAA body).

### classic-dark (default — `src/lib/themes/classic-dark.css`)

| Pair | Approx. Ratio | AA Body | AA Large | Note |
|---|---|---|---|---|
| foreground 0.87 / background 0.14 | ~11.9:1 | ✅ AAA | ✅ | Excellent body text |
| foreground 0.87 / card 0.17 | ~10.5:1 | ✅ AAA | ✅ | |
| muted-fg 0.58 / background 0.14 | ~5.0:1 | ✅ AA | ✅ | OK |
| **muted-fg 0.58 / muted 0.21** | **~3.8:1** | ❌ | ✅ | **Fails body — used for hints in muted boxes** |
| primary-fg 0.95 / primary 0.55 | ~6.2:1 | ✅ AA | ✅ | |
| accent-fg 0.87 / accent 0.28 | ~8.0:1 | ✅ AAA | ✅ | |
| destructive-fg 0.95 / destructive 0.45 | ~7.0:1 | ✅ AA | ✅ | |

### classic-light (`src/lib/themes/classic-light.css`)

| Pair | Approx. Ratio | AA Body | AA Large | Note |
|---|---|---|---|---|
| foreground 0.18 / background 0.93 | ~12.5:1 | ✅ AAA | ✅ | |
| muted-fg 0.42 / background 0.93 | ~5.0:1 | ✅ AA | ✅ | |
| **muted-fg 0.42 / muted 0.87** | **~4.3:1** | ❌ | ✅ | **Borderline — fails body by 0.2** |
| primary-fg 0.95 / primary 0.38 | ~9.0:1 | ✅ AAA | ✅ | |

### modern-dark (green phosphor — `src/lib/themes/modern-dark.css`)

| Pair | Approx. Ratio | AA Body | AA Large | Note |
|---|---|---|---|---|
| foreground 0.80 / background 0.10 | ~10:1 | ✅ AAA | ✅ | Bright green on black, fine |
| **muted-fg 0.50 / background 0.10** | **~3.7:1** | ❌ | ✅ | **Fails body** |
| **muted-fg 0.50 / muted 0.15** | **~3.3:1** | ❌ | ✅ | **Fails body — pervasive** |
| secondary-fg 0.70 / secondary 0.15 | ~6.0:1 | ✅ AA | ✅ | |
| primary-fg 0.10 / primary 0.70 | ~7.5:1 | ✅ AAA | ✅ | Good |
| destructive-fg 0.95 / destructive 0.50 | ~5.5:1 | ✅ AA | ✅ | |

> Phosphor glow text-shadow (`oklch(0.70 0.18 145 / 0.3)`) softens edges and may further reduce effective contrast for low-vision users. Already disabled under `prefers-reduced-motion`. ✅

### modern-light (amber CRT — `src/lib/themes/modern-light.css`)

| Pair | Approx. Ratio | AA Body | AA Large | Note |
|---|---|---|---|---|
| foreground 0.20 / background 0.92 | ~11:1 | ✅ AAA | ✅ | |
| muted-fg 0.45 / background 0.92 | ~5.5:1 | ✅ AA | ✅ | |
| **muted-fg 0.45 / muted 0.90** | **~4.0:1** | ❌ | ✅ | **Fails body** |
| **primary-fg 0.98 / primary 0.55 (amber)** | **~3.5:1** | ❌ | ✅ | **Fails body — affects every primary button label** |
| destructive-fg 0.95 / destructive 0.45 | ~6.5:1 | ✅ AA | ✅ | |

> Amber/gold backgrounds + white text are a notorious accessibility footgun. WCAG AA requires 4.5:1 for any text; primary button labels are normal-weight body text per shadcn defaults.

---

## Detailed Findings by Severity

### High-Severity (WCAG AA violations & latent bugs)

#### H-1 — modern-dark muted-foreground fails WCAG AA (1.4.3 Contrast Minimum)
- **Location:** `src/lib/themes/modern-dark.css:19` — `--color-muted-foreground: oklch(0.50 0.08 145)`
- **Impact:** Every page hint, helper text, breadcrumb, placeholder, and "muted" caption in the green-phosphor theme is unreadable to users with low vision. This is the entire dim-text register.
- **Standard:** WCAG 2.1 AA — 1.4.3 (4.5:1 required for body text)
- **Fix:** Bump L from 0.50 → at least 0.62, e.g. `oklch(0.62 0.10 145)`. Re-verify against `--color-muted` and `--color-background`.
- **Suggested command:** `/normalize` then `/audit` to re-verify

#### H-2 — modern-light primary-foreground fails on amber primary (1.4.3)
- **Location:** `src/lib/themes/modern-light.css` — `--color-primary-foreground: oklch(0.98 0.005 55)` on `--color-primary: oklch(0.55 0.12 55)`
- **Impact:** Every Primary CTA label (e.g., "Save", "Roll All", "Proceed") is borderline-unreadable on amber buttons in the light terminal theme.
- **Standard:** WCAG 2.1 AA — 1.4.3
- **Fix:** Either darken the primary background (L 0.55 → 0.45) or darken the foreground to a very dark text color (L 0.98 → 0.15). Modern-amber CRTs historically used dark-on-amber, which would also be more period-authentic.
- **Suggested command:** `/normalize`

#### H-3 — `<button>` elements missing `type="button"` (~35 occurrences)
- **Locations:** wizard pages (`characteristics/+page.svelte:262`, `occupation/+page.svelte`, `skills/+page.svelte:315–354`, `equipment/+page.svelte`, `review/+page.svelte`), `sheet/[id]/+page.svelte:110`, `DiceRoller.svelte:76`, plus header toggles.
- **Impact:** No `<form>` elements exist *today*, so this is latent — but the moment a wrapping form is introduced (PDF export form, comments, etc.), Enter-key submissions will fire unintended button handlers (rolling dice, navigating wizard steps).
- **Standard:** Best practice; WCAG 2.1 indirect (3.2.2 On Input).
- **Fix:** Bulk-add `type="button"` to every `<button>` that is not explicitly a submit button.
- **Suggested command:** `/harden`

#### H-4 — Disabled buttons don't explain WHY they're disabled
- **Locations:**
  - `characteristics/+page.svelte:262` — "Roll All" disabled during rolling
  - `occupation/+page.svelte:241` — "Proceed" disabled until selection
  - `skills/+page.svelte:451` — "Proceed" disabled until points spent
  - `review/+page.svelte` — Save disabled with unmet validation
- **Impact:** Screen-reader users hear "button, dimmed" with no explanation. Sighted keyboard users see a faded button with no tooltip. WCAG 3.3.1 (Error Identification) is partially relevant when the disabled state is acting as validation feedback.
- **Standard:** WCAG 2.1 AA — 3.3.1, 3.3.3
- **Fix:** Add `aria-describedby` pointing to the validation message, OR replace `disabled` with an enabled button that triggers a focused error message on click. The latter is more accessible.
- **Suggested command:** `/harden` + `/clarify`

---

### Medium-Severity

#### M-1 — Borderline muted-on-muted in classic themes (~3.8–4.3:1)
- **Locations:** `classic-dark.css` (muted-fg 0.58 / muted 0.21), `classic-light.css` (muted-fg 0.42 / muted 0.87)
- **Impact:** Fails 1.4.3 AA in any nested "muted card with muted helper text" surface. Common in wizard hints and skill descriptions.
- **Standard:** WCAG 2.1 AA — 1.4.3 (when text rendered ≤ 18.66px regular / 24px bold)
- **Fix:** classic-dark: muted-fg L 0.58 → 0.65. classic-light: muted-fg L 0.42 → 0.36.
- **Suggested command:** `/normalize`

#### M-2 — PDF export uses hardcoded grays that fail WCAG on white paper
- **Location:** `src/lib/export/pdf-export.ts:37,52,54,83,84` — `'#888888'`, `'#555555'`, `'#666'`
- **Impact:** Printed character sheets have unreadable subtitle/half-value text. `#888` on white = 2.85:1 (fails AA + AAA). Players may print sheets for play sessions and find values illegible.
- **Standard:** WCAG 2.1 AA — 1.4.3 (applies to PDFs per WCAG2ICT)
- **Fix:** Replace with `#000` for primary text and `#444` (~9:1) for secondary text. Tokenize as constants at the top of the file.
- **Suggested command:** `/harden`

#### M-3 — No `aria-live` for wizard step transitions or point-budget updates
- **Locations:**
  - `WizardShell.svelte` — step navigation
  - `skills/+page.svelte` — "Remaining: X" budget counter
  - `characteristics/+page.svelte` — roll results
  - `DiceRoller.svelte` — roll output
- **Impact:** Screen-reader users get no feedback when they spend a skill point, advance a step, or roll a die. The point counter visually updates; SR users hear silence.
- **Standard:** WCAG 2.1 AA — 4.1.3 Status Messages
- **Fix:** Wrap dynamic counters and step-change confirmations in `<div role="status" aria-live="polite">…</div>`. Use `aria-live="assertive"` only for true errors (over-budget allocation).
- **Suggested command:** `/harden`

#### M-4 — Heading hierarchy: missing `<h1>` on wizard sub-pages
- **Locations:** Each wizard step page (`characteristics`, `occupation`, `skills`, `backstory`, `equipment`, `review`) starts with an `<h2>` (e.g., `backstory/+page.svelte:77`). The wizard shell does not provide an `<h1>`, so each step has no top-level heading.
- **Impact:** Screen-reader landmark navigation is degraded. Users jumping by heading level land in mid-hierarchy.
- **Standard:** WCAG 2.1 AA — 1.3.1 Info and Relationships, 2.4.6 Headings and Labels
- **Fix:** Either (a) add `<h1>Create Investigator</h1>` to `WizardShell.svelte` and demote sub-pages from h2→h3, or (b) promote each step's heading to `<h1>` ("Characteristics", "Occupation", etc.). Option (b) is more conventional for wizards.
- **Suggested command:** `/normalize`

#### M-5 — Sheet page mid-content `<h2>` "In-Play Tracking" lacks visual section break
- **Location:** `src/routes/sheet/[id]/+page.svelte:140`
- **Impact:** Heading exists but visually appears as just-another-row. SR users navigate to it expecting a major section.
- **Fix:** Either add a `<section aria-labelledby>` wrapper with visual treatment, or move tracker into its own collapsible region.
- **Suggested command:** `/normalize`

#### M-6 — Phosphor glow + scanlines may interact poorly with vision impairments
- **Location:** `src/lib/themes/effects.css` (modern-dark scanlines, text-shadow phosphor glow)
- **Impact:** Subtle 2px scanlines and 0.3-alpha text-shadow may make sub-pixel rendering inconsistent for users with astigmatism or contrast sensitivity. *Already* disabled by `prefers-reduced-motion`, but some users want motion + reduced visual noise.
- **Standard:** WCAG 2.1 AA — 1.4.8 (Visual Presentation, AAA-only) but spirit applies
- **Fix:** Add a "Reduce theme effects" user preference that disables scanlines/glow independently of motion. Separate concerns.
- **Suggested command:** `/quieter` (theme-effects toggle)

#### M-7 — Eldritch glitch chromatic aberration may cause distress
- **Location:** `src/lib/themes/effects.css:313-314` — `oklch(0.55 0.22 25 / 0.55)` red + `oklch(0.65 0.18 200 / 0.55)` cyan text-shadow on `triggerEldritchFlash()`
- **Impact:** Intentional thematic effect, but chromatic-aberration text shifts can trigger visual snow / migraine for some users. Currently respects `prefers-reduced-motion` — verify.
- **Fix:** Confirm the flash never fires when `prefers-reduced-motion: reduce`. Add a settings toggle to opt out of all "atmosphere" effects independent of reduced motion.
- **Suggested command:** `/quieter`

---

### Low-Severity

#### L-1 — Form fields use `placeholder` for example values (acceptable, but check)
- **Verified:** `backstory/+page.svelte` — every input/textarea has a proper `<label for>` association (lines 88, 94, 100, 106, 112, 129). Placeholders provide *examples*, not labels. This is correct.
- **Action:** No fix needed — flagged here only because Phase 1 explorer mistakenly reported these as placeholder-only labels. They are fine.

#### L-2 — Avatar `<img alt="">` correct but could verify referrer policy is intentional
- **Location:** `Header.svelte:54` — `<img src={session.user.image} alt="" referrerpolicy="no-referrer" />`
- **Action:** Empty alt is correct (avatar is decorative; parent link has accessible name). No fix needed — noting for completeness.

#### L-3 — Dice overlay hardcoded hex palette (`DiceRollOverlay.svelte:150–164`)
- **Impact:** Dice colors don't adapt to theme tokens. Likely fine because dice are 3D-rendered objects, not text — contrast not directly applicable.
- **Suggested command:** `/extract` if dice palette should become a token

#### L-4 — `WizardShell` `<nav>` has `aria-label` but no `role="region"` wrapper
- **Impact:** Minor — `aria-label` on `<nav>` does provide a landmark. No fix needed unless screen-reader testing reveals confusion.

#### L-5 — Scrollbar styled with `::-webkit-scrollbar` only — no Firefox `scrollbar-color`
- **Location:** `src/app.css:63-79`
- **Impact:** Firefox users see default scrollbar. Cosmetic, not A11y.
- **Fix:** Add `scrollbar-width: thin; scrollbar-color: var(--color-border) var(--color-background);`
- **Suggested command:** `/polish`

#### L-6 — Mobile touch-target rule applies `min-height: 44px` to ALL `<a>` tags, including inline links
- **Location:** `src/app.css:50` — `button, a, select, [role="button"] { min-height: 44px; min-width: 44px; }`
- **Impact:** Inline anchors (`"see <a>licensing</a>"`) get a 44px line-height on mobile, breaking inline text flow with awkward vertical gaps.
- **Fix:** Scope to `a:not(:where(p a, li a, span a))` or use `display: inline-flex; min-height: 44px` only on standalone link components.
- **Suggested command:** `/polish`

---

## Patterns & Systemic Issues

1. **muted-foreground design token is too dim across three of four themes.** The `muted` register is consistently 0.5–1.0 contrast points below AA on muted surfaces. This is the single highest-leverage fix — one token per theme.
2. **No live-region strategy.** AlphaBanner is the only component using `aria-live`. There's no project-wide pattern for announcing dynamic state (rolls, points spent, step changes). A small `<LiveAnnouncer>` utility would solve this everywhere.
3. **Disabled-as-validation pattern.** The codebase uses `disabled={!canProceed}` consistently, but never explains the gating condition to AT users. Pattern needs an `aria-describedby` companion or a different validation UX.
4. **Hardcoded colors only in two places** (PDF export, dice overlay). Excellent restraint elsewhere — the token system is genuinely respected.

## Positive Findings (keep doing these!)

- ✅ **Skip link** at top of root layout, with proper `sr-only`/`focus:not-sr-only`
- ✅ **Semantic landmarks** — `<main id="main-content">`, `<header>`, `<footer>`, `<nav aria-label>`
- ✅ **`:focus-visible` discipline** — keyboard-only ring, suppressed on mouse click
- ✅ **`prefers-reduced-motion`** honored globally and per-component (DiceRollOverlay text fallback)
- ✅ **44px mobile touch targets** enforced via CSS (with caveat L-6)
- ✅ **iOS zoom prevention** on number inputs (`font-size: 16px`)
- ✅ **`aria-pressed`/`aria-checked`** correctly used on Header toggles and era radiogroup
- ✅ **`role="status" aria-live="polite"`** on AlphaBanner
- ✅ **Lucide icons** consistently `aria-hidden="true"` with parent button labels
- ✅ **No `<div onclick>`** anywhere — all interactive elements are `<button>` or `<a href>`
- ✅ **No positive `tabindex`** — natural tab order preserved
- ✅ **No `svelte-ignore a11y_*`** comments — compiler warnings respected
- ✅ **OKLch perceptually-uniform color tokens** — easier to reason about contrast than HSL/HEX
- ✅ **No glassmorphism, no gradient text, no AI-color slop**

---

## Recommendations by Priority

### Immediate (this week)
1. **Fix four token contrast violations** (H-1, H-2, M-1):
   - `modern-dark` muted-fg L: 0.50 → 0.62
   - `modern-light` primary darken (L 0.55 → 0.45) OR foreground darken
   - `classic-dark` muted-fg L: 0.58 → 0.65
   - `classic-light` muted-fg L: 0.42 → 0.36
   - **Then re-verify with a real contrast checker** (oklch L → sRGB → WCAG luminance).
2. **Add `type="button"`** to all non-submit buttons (H-3) — single bulk edit per file.

### Short-term (next sprint)
3. **Build a `<LiveAnnouncer>` component** and adopt across wizard, dice, sheet (M-3).
4. **Replace `disabled` validation pattern** with an enabled-button + focus-error pattern, or add `aria-describedby` (H-4).
5. **Promote wizard step `<h2>` → `<h1>`** and adjust hierarchy (M-4).
6. **Tokenize PDF export grays** and fix #888 → AA-passing color (M-2).

### Medium-term
7. **Add a "Reduce theme effects" user setting** independent of `prefers-reduced-motion` (M-6, M-7).
8. **Verify eldritch glitch respects reduced-motion** (M-7).
9. **Scope mobile 44px touch-target rule** to standalone links only (L-6).

### Long-term
10. **Run real screen-reader testing** (NVDA + VoiceOver + TalkBack) on the wizard end-to-end.
11. **Run automated axe-core in Playwright E2E** to catch regressions.
12. **Add visual contrast tests** to CI — render each theme, sample known text-on-bg pairs, assert ≥ 4.5:1.

---

## Suggested Commands (for follow-up fix passes)

| Command | Addresses | Issues fixed |
|---|---|---|
| `/normalize` | Token contrast & heading hierarchy | H-1, H-2, M-1, M-4, M-5 |
| `/harden` | Latent bugs & error/status states | H-3, H-4, M-2, M-3 |
| `/quieter` | Effects toggle | M-6, M-7 |
| `/polish` | Cosmetic fixes | L-5, L-6 |
| `/extract` | Tokenize dice palette | L-3 |
| `/audit` | Re-verify after fixes | All |

---

## Verification (how to test fixes end-to-end)

1. **Contrast verification (every theme):**
   ```bash
   npm run dev
   ```
   Open `/` in browser. For each of the four themes (toggle via Header), open DevTools → Lighthouse Accessibility audit. Target score ≥ 95.

2. **Automated A11y in Playwright:**
   ```bash
   npm install -D @axe-core/playwright
   ```
   Add an axe assertion to existing E2E tests covering each wizard step and the sheet page. Run `npm run test:e2e`.

3. **Manual keyboard sweep:**
   Tab through `/create/coc7e/characteristics` → ... → `/review`. Every interactive element must be reachable, visible focus indicator, no traps.

4. **Screen reader (manual):**
   VoiceOver (`Cmd+F5` on macOS) or NVDA. Walk the wizard. Confirm step changes, point spending, and dice rolls are announced.

5. **Reduced motion:**
   System Settings → Accessibility → Reduce Motion → ON. Reload — confirm dice overlay falls back to text, scanlines disappear, no eldritch flash fires.

6. **PDF export:**
   Save a character → Export PDF → open in Preview. All text should be ≥ 4.5:1 contrast against white.

---

## Critical Files

- **Theme tokens:** `src/lib/themes/{base,classic-dark,classic-light,modern-dark,modern-light}.css`
- **Effects:** `src/lib/themes/effects.css`
- **Global A11y CSS:** `src/app.css`
- **Wizard shell:** `src/lib/components/wizard/WizardShell.svelte`
- **Wizard steps:** `src/routes/create/coc7e/{characteristics,occupation,skills,backstory,equipment,review}/+page.svelte`
- **Sheet:** `src/routes/sheet/[id]/+page.svelte`
- **PDF export:** `src/lib/export/pdf-export.ts`
- **Header (toggles, auth, era selector):** `src/lib/components/layout/Header.svelte`
- **Dice components:** `src/lib/components/dice/{DiceRoller,DiceRollOverlay}.svelte`

---

*End of audit. No code changes were made by this report — see "Suggested Commands" to begin fixes.*
