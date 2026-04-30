# Design System: Miskatonic University Registrar

**Project ID:** _reserved — populate after first Stitch project is created_
**Last verified against source:** 2026-04-30
**Source of truth files:** `src/lib/themes/*.css`, `src/app.css`, `src/lib/themes/registry.ts`

---

## 0. How to Use This Document

**Audience.** Three readers, in priority order:

1. **The Stitch MCP server** — when generating new screens, the prompts MUST reference the tokens, atmosphere blocks, and component patterns below verbatim.
2. **Future contributors** (human or LLM) — this is the canonical reference for what the app looks like and how new screens should behave.
3. **Code review** — diffs that touch theme tokens, fonts, radii, or atmospheric effects MUST be reflected here in the same PR.

**Authority rules.**

- This document is the single source of truth. If code disagrees with this document, **fix the code or update the document** — never let them drift silently.
- All token values quoted in §2 are pulled verbatim from `src/lib/themes/*.css`. They can be grepped back to verify.
- Every component pattern in §5 and every screen in §6 MUST specify both Classic and Modern realizations. Solo-era entries are a smell.

**Per-era discipline.** This is a **dual-era** app. There is no "default" era at the design level — `classic-dark` happens to be the runtime default in `src/lib/themes/registry.ts`, but designs must work equally well in all four themes (Classic Dark, Classic Light, Modern Dark, Modern Light). When in doubt, prototype in Classic Dark and Modern Dark first; the light variants are derivations.

---

## 1. Visual Theme & Atmosphere

### 1.1 The Dual-Era Premise

Miskatonic University Registrar is a Call of Cthulhu 7th Edition character builder that lets the user roleplay the act of *registering an investigator* in one of two fictional bureaucratic settings:

- **Classic — "1920s Candlelit Study"** — the gaslit, occult-academic Lovecraft default. Investigators are scholars, journalists, antiquarians.
- **Modern — "1980s Phosphor Terminal"** — a Reagan-era university computer running an early CRUD app. Investigators are programmers, journalists with fax machines, deprogrammers.

These are not skins. They are two distinct, complete visual languages. A character generated in Classic should feel like it was typed on a Smith-Corona; a character in Modern should feel like it was entered into a green-screen registrar terminal at 2 a.m. The user toggles era and light/dark independently in the header (`src/lib/components/layout/Header.svelte:106–140`), giving four full themes.

### 1.2 Classic — Mood Board

| Aspect | Description |
|---|---|
| **Mood** | Occult-academic, gaslit, parchment-aged, hushed |
| **Surface metaphor** | Aged paper / candlelit oak desk |
| **Atmospheric effects** | Paper grain (SVG `feTurbulence`, opacity 0.06 dark / 0.08 light), low-frequency paper-fiber overlay on `html::before`, three irregularly-placed coffee ring stains via `body { background-image }`, old-photograph radial vignette, antique ink text-shadow on `[data-heading]` and `[data-flavor]`, art-deco horizontal rules with center diamond `◆`, gold ornamental underline on `h2[data-heading]` |
| **Era-transition flourish** | Sepia fade-in keyframe (600ms) when toggling INTO Classic — see §13.5 |
| **Typography hook** | `[data-typed]` attribute → Special Elite typewriter face (see §13.4) for "values typed onto the paper form" — names, stat numerics, audit echoes |
| **Photography style** | Sepia-toned, soft-focus, never sharp |
| **Iconography** | `lucide` icons at `size=16`–`18`, monoline weight; `BookOpen` represents the era in the toggle |
| **Forbidden** | Bright saturated colors (other than gold accent), neon, sharp glow, monospace fonts, scanlines |

### 1.3 Modern — Mood Board

| Aspect | Description |
|---|---|
| **Mood** | Hacker-night, glowing CRT, sharp-edged, monospaced, dry |
| **Surface metaphor** | Phosphor-coated cathode-ray tube |
| **Atmospheric effects** | CRT scanlines (`repeating-linear-gradient`, 2px transparent / 2px black at 0.06 alpha dark, 0.03 alpha light), CRT radial vignette, phosphor `text-shadow: 0 0 4px` on body text and `0 0 8px` on `[data-heading]` (Modern Dark only — static, never animated) |
| **Era-transition flourish** | CRT degauss-in keyframe (700ms) when toggling INTO Modern — blur + saturate + hue-rotate + horizontal jitter, settles to clean. See §13.5 |
| **Ambient flourish** | Phosphor flicker every ~90 s on Modern Dark (briefly dims `.app-frame` for ~360ms via `filter`). See §13.6 |
| **Programmatic flourish** | Eldritch glitch — chromatic aberration + animated SVG displacement, fired via `triggerEldritchFlash()`. Reserved for narrative moments (Sanity loss, Mythos crits). See §13.7 |
| **Photography style** | Avoid photography; use ASCII art, terminal text, or geometric monochrome |
| **Iconography** | Same `lucide` set as Classic for consistency, but rendered with sharp 0rem corners; `Monitor` represents the era in the toggle |
| **Forbidden** | Soft shadows, rounded corners, serif fonts, gold accents, paper grain, vignette romance |

---

## 2. Color Palette & Roles

All values below are **verbatim** from `src/lib/themes/*.css`. Every value can be grepped back to verify (e.g., `grep "oklch(0.14 0.015 150)" src/lib/themes/`).

### 2.1 Classic Dark — *Default theme; deep greenish-black with warm amber and antique gold*

Source: `src/lib/themes/classic-dark.css` (also mirrored in `base.css` as `:root` defaults)

| Role | Token | Value | Descriptive name |
|---|---|---|---|
| Surface base | `--color-background` | `oklch(0.14 0.015 150)` | Deep moss-black |
| Body text | `--color-foreground` | `oklch(0.87 0.025 80)` | Warm cream |
| Card / panel | `--color-card` | `oklch(0.17 0.02 130)` | Lifted desk-surface |
| Card text | `--color-card-foreground` | `oklch(0.87 0.025 80)` | Warm cream |
| Popover surface | `--color-popover` | `oklch(0.17 0.02 130)` | Lifted desk-surface |
| Popover text | `--color-popover-foreground` | `oklch(0.87 0.025 80)` | Warm cream |
| Primary action | `--color-primary` | `oklch(0.55 0.10 155)` | Muted teal |
| Primary text on action | `--color-primary-foreground` | `oklch(0.95 0.01 85)` | Bone white |
| Secondary surface | `--color-secondary` | `oklch(0.22 0.025 100)` | Smoked olive |
| Secondary text | `--color-secondary-foreground` | `oklch(0.87 0.025 80)` | Warm cream |
| Muted surface | `--color-muted` | `oklch(0.21 0.015 110)` | Dim olive |
| Muted text | `--color-muted-foreground` | `oklch(0.58 0.02 80)` | Aged ivory |
| Accent surface | `--color-accent` | `oklch(0.28 0.04 75)` | Warm amber-brown |
| Accent text | `--color-accent-foreground` | `oklch(0.87 0.025 80)` | Warm cream |
| Destructive | `--color-destructive` | `oklch(0.45 0.15 25)` | Deep blood-red |
| Destructive text | `--color-destructive-foreground` | `oklch(0.95 0.01 90)` | Bone white |
| Border | `--color-border` | `oklch(0.26 0.025 110)` | Walnut hairline |
| Input outline | `--color-input` | `oklch(0.26 0.025 110)` | Walnut hairline |
| Focus ring | `--color-ring` | `oklch(0.55 0.10 155)` | Muted teal |
| Warning | `--color-warning` | `oklch(0.65 0.12 65)` | Amber alert |
| Warning text | `--color-warning-foreground` | `oklch(0.15 0.02 65)` | Ink |
| **Decoration only** | `--color-gold` | `oklch(0.65 0.12 75)` | Antique gold (h2 underline, `<hr>` ◆) |

### 2.2 Classic Light — *Aged parchment, ink-brown text, amber accents*

Source: `src/lib/themes/classic-light.css`

| Role | Token | Value | Descriptive name |
|---|---|---|---|
| Surface base | `--color-background` | `oklch(0.93 0.04 80)` | Warm cream paper |
| Body text | `--color-foreground` | `oklch(0.18 0.02 70)` | Iron-gall ink |
| Card / panel | `--color-card` | `oklch(0.90 0.04 80)` | Aged-page tan |
| Popover | `--color-popover` | `oklch(0.91 0.035 80)` | Aged-page tan |
| Primary action | `--color-primary` | `oklch(0.38 0.08 155)` | Deep teal ink |
| Primary text | `--color-primary-foreground` | `oklch(0.95 0.02 80)` | Bone |
| Secondary | `--color-secondary` | `oklch(0.86 0.035 80)` | Sun-bleached parchment |
| Muted | `--color-muted` | `oklch(0.87 0.03 80)` | Dust |
| Muted text | `--color-muted-foreground` | `oklch(0.42 0.02 70)` | Faded ink |
| Accent | `--color-accent` | `oklch(0.86 0.05 75)` | Light amber wash |
| Destructive | `--color-destructive` | `oklch(0.40 0.18 25)` | Sealing-wax red |
| Border / input | `--color-border` / `--color-input` | `oklch(0.76 0.04 80)` | Worn paper edge |
| Focus ring | `--color-ring` | `oklch(0.38 0.08 155)` | Deep teal ink |
| Warning | `--color-warning` | `oklch(0.55 0.12 65)` | Amber alert |
| Decoration only | `--color-gold` | `oklch(0.50 0.10 75)` | Tarnished gold |

### 2.3 Modern Dark — *Phosphor CRT, near-black background, vivid green text*

Source: `src/lib/themes/modern-dark.css`. **Note `--radius: 0rem` and the monospace font family overrides.**

| Role | Token | Value | Descriptive name |
|---|---|---|---|
| Surface base | `--color-background` | `oklch(0.10 0.005 145)` | Off-tube black |
| Body text | `--color-foreground` | `oklch(0.80 0.15 145)` | Phosphor green |
| Card | `--color-card` | `oklch(0.12 0.008 145)` | Slight CRT lift |
| Popover | `--color-popover` | `oklch(0.12 0.008 145)` | Slight CRT lift |
| Primary action | `--color-primary` | `oklch(0.70 0.18 145)` | Vivid phosphor green |
| Primary text | `--color-primary-foreground` | `oklch(0.10 0.005 145)` | Off-tube black |
| Secondary | `--color-secondary` | `oklch(0.15 0.01 145)` | Burned-in row |
| Secondary text | `--color-secondary-foreground` | `oklch(0.70 0.12 145)` | Dim phosphor |
| Muted | `--color-muted` | `oklch(0.15 0.008 145)` | Burned-in row |
| Muted text | `--color-muted-foreground` | `oklch(0.50 0.08 145)` | Faded phosphor |
| Accent | `--color-accent` | `oklch(0.18 0.015 145)` | Glow halo |
| Destructive | `--color-destructive` | `oklch(0.50 0.15 25)` | Error-red |
| Border / input | `--color-border` / `--color-input` | `oklch(0.25 0.04 145)` | Trace line |
| Focus ring | `--color-ring` | `oklch(0.70 0.18 145)` | Vivid phosphor green |
| Warning | `--color-warning` | `oklch(0.65 0.12 55)` | Amber warning lamp |
| Geometry | `--radius` | `0rem` | Sharp / no rounding |

`--color-gold` is **not defined** in Modern themes. Stitch must not reference gold accents in Modern designs.

### 2.4 Modern Light — *Amber CRT, light gray background, dark text*

Source: `src/lib/themes/modern-light.css`. **Note `--radius: 0rem`.**

| Role | Token | Value | Descriptive name |
|---|---|---|---|
| Surface base | `--color-background` | `oklch(0.92 0.01 100)` | Lab-bench gray |
| Body text | `--color-foreground` | `oklch(0.20 0.01 100)` | Charcoal |
| Card | `--color-card` | `oklch(0.95 0.008 100)` | Paper-white |
| Primary action | `--color-primary` | `oklch(0.55 0.12 55)` | Amber terminal |
| Secondary | `--color-secondary` | `oklch(0.88 0.01 100)` | Hardware gray |
| Muted | `--color-muted` | `oklch(0.90 0.008 100)` | Faint background |
| Accent | `--color-accent` | `oklch(0.88 0.015 55)` | Pale amber |
| Destructive | `--color-destructive` | `oklch(0.45 0.18 25)` | Error red |
| Border / input | `--color-border` / `--color-input` | `oklch(0.78 0.01 100)` | Bezel gray |
| Focus ring | `--color-ring` | `oklch(0.55 0.12 55)` | Amber terminal |
| Warning | `--color-warning` | `oklch(0.60 0.12 55)` | Amber lamp |
| Geometry | `--radius` | `0rem` | Sharp / no rounding |

### 2.5 Cross-cutting Role Map

When designing a new screen, refer to **role names**, not raw colors. Stitch prompts MUST use `--color-primary` / `--color-foreground` style references rather than hex/oklch literals so the design picks up the active theme automatically.

| Functional role | Token |
|---|---|
| Page surface | `--color-background` |
| Default text | `--color-foreground` |
| Lifted panel (card, popover, header bar, footer bar) | `--color-card` |
| Secondary surface (chips, secondary buttons) | `--color-secondary` |
| Disabled / muted text | `--color-muted-foreground` |
| Hover wash, active toggle bg | `--color-accent` |
| Primary CTA, progress bar fill, focus ring | `--color-primary` |
| Negative actions, error cards | `--color-destructive` |
| Hairline rules, button outlines, input borders | `--color-border` |
| Cautions, age-modifier alerts | `--color-warning` |
| Classic-only ornament (h2 underline, hr ◆) | `--color-gold` (never on Modern) |

---

## 3. Typography Rules

### 3.1 Font stacks (verbatim from `base.css`, overridden in Modern themes)

| Era | `--font-display` (h1, opt-in) | `--font-heading` (h2–h6) | `--font-flavor` | `--font-body` | `--font-typed` |
|---|---|---|---|---|---|
| Classic | `'Cinzel', serif` | `'Playfair Display', serif` | `'IM Fell English', serif` (italicized via `[data-flavor]`) | `'EB Garamond', 'Crimson Text', Georgia, serif` | `'Special Elite', 'Courier New', monospace` |
| Modern | `'IBM Plex Mono', monospace` | `'IBM Plex Mono', monospace` | `'VT323', monospace` | `'IBM Plex Mono', monospace` | `'IBM Plex Mono', monospace` |

**Why five Classic faces?** Each represents a different *kind of writing* in a 1920s academic registrar's office:

- **Cinzel (display)** — engraved Roman caps. Reads as a brass nameplate over the building entrance: "MISKATONIC UNIVERSITY REGISTRAR." Used on h1 and any element with `[data-display]`. Tracking widened to 0.04em.
- **Playfair Display (heading)** — formal transitional serif. Reads as a section break in a published volume.
- **EB Garamond (body)** — book-page typeface. Reads as the printed forms and ledger pages a 1920s clerk would actually see.
- **IM Fell English italic (flavor)** — hand-set 17th-century revival. Reads as a marginal note in a leather-bound journal.
- **Special Elite (typed)** — typewriter face. Reads as values typed onto a printed form. Opt-in via `[data-typed]`.

Modern collapses all five into IBM Plex Mono (with VT323 for `[data-flavor]`) — a terminal has only one face.

### 3.2 Semantic attribute hooks

The codebase uses three data attributes (defined in `src/lib/themes/base.css`) to opt into the era's typographic roles. **Stitch MUST emit these on every appropriate element**:

- `data-display` — engraved-caps face (Cinzel in Classic, mono in Modern). h1 already inherits this automatically; add to wordmarks, large hero titles, certificate-style elements.
- `data-heading` — heading face (Playfair Display in Classic, mono in Modern). Applied to h1–h6 automatically; can also be added to step labels, card titles, brand wordmark.
- `data-flavor` — flavor italic (IM Fell English in Classic, VT323 in Modern). For atmospheric copy: homepage tagline, empty-state quotes, mood-laden error messages.
- `data-typed` — typewriter face (Special Elite in Classic, no-op in Modern). For "values typed onto the paper form": investigator name displays, stat numerics, audit echoes.

Plain body text inherits `--font-body` (EB Garamond in Classic, IBM Plex Mono in Modern). The `body` rule sets `line-height: 1.55` because both faces read more comfortably with extra leading.

### 3.3 Hierarchy scale

The codebase uses Tailwind utility classes rather than a fixed scale. The recommended ladder, derived from existing usage:

| Use | Tailwind | px-equivalent |
|---|---|---|
| Page title (`h1[data-heading]`) | `text-4xl sm:text-5xl font-bold tracking-wide` | 36→48 |
| Section heading (`h2[data-heading]`) | `text-2xl font-semibold` | 24 |
| Subheading (`h3[data-heading]`) | `text-lg font-semibold` | 18 |
| Hero flavor (`p[data-flavor]`) | `text-lg` | 18 |
| Body | `text-base` (default) | 16 |
| Secondary body | `text-sm` | 14 |
| Footer / fine print | `text-xs leading-relaxed` | 12 |
| Mobile-first form input | `text-base` minimum (≥16px to prevent iOS zoom — enforced in `app.css:57`) |

`tracking-wide` (~`0.025em`) is appropriate for Classic headings. Classic headings already get `letter-spacing: 0.02em` from `base.css:43`. Modern headings rely on the monospaced font to convey character — additional letter-spacing should be avoided.

### 3.4 Italics, weight, case

- **Flavor copy is always italic** (forced by `base.css:48`). Stitch should not double-italicize via inline styles.
- **Avoid uppercase headings** — looks generic and clashes with both eras. Era flavor lives in font choice, not transform.
- **Bold for emphasis only**, never for entire headings (Playfair Display is already heavy at `font-bold`).
- **Modern monospace at `font-bold`** is fine — IBM Plex Mono has a true bold weight.

---

## 4. Geometry & Depth

### 4.1 Border radius

Defined per theme via `--radius`:

| Era | `--radius` | Visual character |
|---|---|---|
| Classic (Dark + Light) | `0.25rem` (4px) | "Subtle softening" — not pill-shaped, not sharp. Applied to buttons, cards, inputs. Pill-shaped (`rounded-full`) is reserved for the user-avatar circle and small status dots. |
| Modern (Dark + Light) | `0rem` | Sharp / precise. Authentic terminal aesthetic. **Never override with `rounded-*` utilities in Modern era components.** |

Stitch outputs that hardcode `rounded-md` or similar must instead use `rounded-[var(--radius)]` so Modern stays sharp.

### 4.2 Elevation

The codebase uses borders and `--color-card` lifts in place of shadows for most surfaces. Shadows appear in only one place (`app.css:119`) — the dice-overlay fallback box.

| Era | Elevation strategy |
|---|---|
| Classic | "Whisper-soft warm shadow" allowed for floating elements (dialogs, dice fallback): `box-shadow: 0 18px 50px color-mix(in oklch, var(--color-background) 70%, black)`. Cards lift via `--color-card` only — no shadow. |
| Modern | **Flat by default.** Phosphor glow (`text-shadow`, on Modern Dark only) is the depth cue. Box-shadows on Modern look anachronistic; if you need elevation, use a brighter `--color-border` outline or a single-pixel inner highlight. |

### 4.3 Borders & rules

- **Hairline borders** (`1px solid var(--color-border)`) are the workhorse separator in both eras. Used on header bottom, footer top, card outlines, input outlines.
- **Classic `<hr>` is decorative**: a centered diamond `◆` on a tapering gold gradient (`effects.css:78–103`). Stitch should emit plain `<hr>` and let the CSS do the work — never inline a custom rule.
- **Classic `h2[data-heading]` gets a 1px gold underline** automatically (`effects.css:108–112`). Don't add manual underlines or `border-b` to h2 headings in Classic.

---

## 5. Component Patterns

For each component: **anatomy → Classic realization → Modern realization → accessibility note**. Components marked **PRESCRIBED** are not yet built; the spec is the contract for when they are.

### 5.1 Buttons

**Anatomy.** All buttons share: `inline-flex items-center gap-2`, `rounded-md` (resolved via `--radius`), `px-{4–6} py-{2–3}` depending on size, `transition-colors`, focus ring via `:focus-visible` from `app.css:38`. On mobile (≤768px), enforced minimum 44×44px touch target via `app.css:50`.

| Variant | Surface | Text | Border | Hover |
|---|---|---|---|---|
| Primary | `--color-primary` | `--color-primary-foreground` | none | `hover:opacity-90` |
| Secondary / Outline | transparent | `--color-foreground` | `1px var(--color-border)` | `hover:bg-[var(--color-accent)]` |
| Destructive | `--color-destructive` | `--color-destructive-foreground` | none | `hover:opacity-90` |
| Ghost / icon | transparent | `--color-muted-foreground` | none | `hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]` |

**Classic.** 4px radius, no shadow, hover slightly opacifies. Lucide icons `size=18` paired with text.
**Modern.** 0px radius (sharp), no shadow, **on Modern Dark the button text inherits the body phosphor glow** — leave it alone, do not add per-button text-shadow.
**Accessibility.** Always `aria-label` on icon-only buttons (header dice toggle, sign-out — see `Header.svelte:68,89,91`). Toggle buttons use `aria-pressed`. Radiogroup pattern for the era toggle (`Header.svelte:108`).

### 5.2 Cards & Containers

**Anatomy.** `bg-[var(--color-card)] border border-[var(--color-border)] rounded-md p-{4–6}`. Page-level wrappers use `mx-auto max-w-{4xl|5xl|6xl} px-4 py-{6–16}` — see §8.3 for canonical widths.

**Classic.** Subtle 4px softening, parchment-feel `--color-card` lift, optional gold ornament if it's a "section of the page" rather than a list item.
**Modern.** Sharp-edged, flat. The `--color-card` is barely-visible-darker on Dark / barely-visible-lighter on Light — this is intentional terminal aesthetic. Don't increase the contrast.
**Accessibility.** Decorative cards do not need labels. Cards that act as links (e.g., investigator cards on `/investigators`) use a wrapping `<a>` and visible focus ring via `:focus-visible`.

### 5.3 Form inputs

**Anatomy.** `bg-[var(--color-background)] border border-[var(--color-input)] rounded-md px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]`. Number inputs inherit `font-size: 16px` minimum on mobile (`app.css:57`).

**Classic.** Subtle radius, ink-on-parchment vibe. Helper text uses `[data-flavor]` for placeholder hints with character (e.g., backstory wizard).
**Modern.** Sharp 0px corners, monospaced text, `text-foreground` directly on `--color-background` looks like terminal input. Caret should appear as the OS default — do not customize.
**Accessibility.** Every input has a visible `<label>` (do not rely on placeholder). Validation errors use `--color-destructive` text below the field. Required fields marked with `aria-required="true"`, never with a bare `*`.

### 5.4 Header — sticky navigation

**Source:** `src/lib/components/layout/Header.svelte`.
**Anatomy.** `border-b border-[var(--color-border)] bg-[var(--color-card)]` outer; inner `nav` is `mx-auto flex max-w-6xl items-center justify-between px-4 py-3`. Left: brand wordmark with `[data-heading]`, "Miskatonic University Registrar" on ≥sm, **"M.U.R." on <sm**. Right (in order): "New" / "+" link, "Investigators" link, auth slot (avatar + sign-out icon, OR sign-in icon), dice-toggle button (`Dices` icon with strikethrough overlay when off), era radiogroup (`BookOpen` / `Monitor`), light/dark toggle (`Sun` / `Moon` SVG inline).

**Classic.** Walnut hairline border, warm-cream wordmark on smoked-olive lifted card. Toggles render with `BookOpen` for the era.
**Modern.** Phosphor wordmark glows (inherits `text-shadow` from `effects.css:166`). Border is a phosphor trace line. `Monitor` icon for the era.
**Accessibility.** `<nav aria-label="Main navigation">`. Era selector is `role="radiogroup"` with `role="radio"` children and `aria-checked`. Mode toggle has `aria-label` that announces the destination state ("Switch to light mode"). Skip-to-content link in `+layout.svelte` (sr-only until focused).

### 5.5 Footer — Chaosium disclaimer (legally required on every page)

**Source:** `src/lib/components/layout/Footer.svelte`.
**Anatomy.** `border-t border-[var(--color-border)] bg-[var(--color-card)] px-4 py-6`; inner `mx-auto max-w-6xl space-y-4`. Two stacked rows:

1. The Chaosium fan-content paragraph (verbatim, `text-xs leading-relaxed text-[var(--color-muted-foreground)]`, link to `www.chaosium.com`).
2. A flex row with "Miskatonic University Registrar — Open Source (GPL-3.0)" on the left and a link to `/licensing` on the right.

**Classic.** Aged-page tan card on warm-cream page (Light) or smoked-olive lift on moss-black (Dark). Faded-ink muted text reads naturally as "fine print."
**Modern.** Same content, monospace renders the disclaimer as a system-printed terms block.
**Accessibility.** External Chaosium link uses `target="_blank" rel="noopener noreferrer"`. Underlined links throughout (already styled in markup).

**This component is non-negotiable.** Every screen Stitch generates MUST render `<Footer />` from `$lib/components/layout/Footer.svelte`. Do not regenerate the disclaimer with paraphrased wording — the verbatim text is required by Chaosium policy (see §10).

### 5.6 Wizard shell — step indicator + progress bar

**Source:** `src/lib/components/wizard/WizardShell.svelte`.
**Anatomy.** Outer `mx-auto max-w-5xl px-4 py-6`. A `<nav aria-label="Character creation progress">` containing an ordered breadcrumb-style `<ol>` of six steps (characteristics, occupation, skills, backstory, equipment, review), separated by `/` glyphs. Below: a 1px-tall progress bar (`h-1 w-full rounded-full bg-[var(--color-muted)]`) with a fill (`bg-[var(--color-primary)]`) sized to `((currentStepIndex + 1) / 6) * 100%`. Sequential lock: a step is accessible only when `i <= currentStep || isComplete`.

- Mobile: shows step number `{i + 1}`; desktop: shows step label.
- Active step: `font-semibold text-[var(--color-primary)]`, plus `aria-current="step"`.
- Complete: `text-foreground`. Locked: `text-muted-foreground opacity-50`.

**Classic.** Teal primary for the active step and progress fill; the breadcrumb `/` separators read like typewritten dividers.
**Modern.** Phosphor-green primary; the breadcrumb reads like a terminal path (`STEP_1 / STEP_2 / ...`).
**Accessibility.** `aria-current="step"`, accessible step labels, sequential lock prevents users from clicking ahead.

### 5.7 Dice roller overlay

**Source:** `src/lib/components/dice/DiceRollOverlay.svelte`, styled in `app.css:83–124`.
**Anatomy.** Fixed-position full-viewport overlay, `z-index: 60`, `pointer-events: none`, fades in/out over 180ms. Background combines a radial primary-tinted glow and a vertical fade to a translucent backdrop. Reduced-motion / animations-off fallback: a centered `--color-card` box with a 2rem heading-font number.

**Classic.** Teal radial glow on smoked-olive backdrop; fallback box has 4px radius and a soft warm shadow.
**Modern.** Phosphor radial glow on near-black; fallback box is sharp-cornered with no shadow.
**Accessibility.** Respects `prefers-reduced-motion` (already wired). User-controllable via the header `Dices` toggle (`Header.svelte:84–103`).

### 5.8 Dialog / modal — **PRESCRIBED**

**Anatomy.** `role="dialog" aria-modal="true"`, focus-trapped, dismiss on Escape and overlay click. Centered card on a `bg-black/40` overlay. Inner card: `max-w-md w-full bg-[var(--color-popover)] border border-[var(--color-border)] rounded-md p-6 space-y-4`. Header `[data-heading]`, body, footer with right-aligned button row (cancel ghost + primary CTA).

**Classic.** Whisper-soft warm shadow on the modal card; gold-rule under header if the dialog is informational rather than transactional.
**Modern.** Flat card, no shadow, sharp corners; phosphor-glow on header text only. Overlay is `bg-[oklch(0.10_0.005_145/0.6)]` (Modern Dark) — reads like a half-opaque CRT.
**Accessibility.** Trap focus, return focus on close, ESC dismisses, first focusable element receives focus on open.

### 5.9 Toast / notification — **PRESCRIBED**

**Anatomy.** Top-right stack, `fixed top-4 right-4 z-50`, items 280–360px wide, `--color-card` background, hairline border, slide-in 200ms. Auto-dismiss after 4–6s; `role="status"` for info, `role="alert"` for destructive.

**Classic.** Mild warm shadow, art-deco ornamental rule above the message body (just one diamond, not a full `<hr>`).
**Modern.** Flat, sharp, phosphor-glow on the title. Brief `>` prefix on the message body (terminal echo aesthetic).
**Accessibility.** Live region; never auto-dismiss destructive toasts faster than 8s; pause on hover.

### 5.10 Tables (skill list, weapons table)

**Anatomy.** Used heavily on `/sheet/[id]`. Two patterns coexist: a *responsive list* for skills (mobile = single column, desktop = multi-column or sortable grid) and a *true table* for weapons (`name | damage | range | attacks`). Hairline `--color-border` cell separators. Header row uses `--color-muted` background.

**Classic.** Resembles a ledger column; right-align numerics; occupation skills get a subtle `•` marker rendered in `--color-gold`.
**Modern.** Resembles a terminal listing — fixed-width monospace makes columns naturally align; occupation marker is `*` instead of `•` (better in monospace).
**Accessibility.** Real `<table><thead>` semantics for the weapons table. Skills can be a CSS grid with `role="list"` if desktop layout would otherwise force semantic-table that's hard to read on mobile.

### 5.11 Badges & tags (draft, era, occupation chips)

**Anatomy.** Small inline-flex span, `text-xs px-2 py-0.5 rounded-md bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]`. Variants: neutral, era ("1920s" / "1980s"), warning (`--color-warning`), draft (italic).

**Classic.** 4px radius, subtle warm tint.
**Modern.** Sharp corners, monospace; an era badge reads `[1980s]` or `[1920s]`.
**Accessibility.** Decorative-only badges should have `aria-hidden="true"` if they duplicate adjacent text; semantic badges (e.g., "Draft") need no special treatment as the text is already accessible.

---

## 6. Screen Surfaces (16 screens)

Catalog of every `+page.svelte` in `src/routes/**`. Use this as the starting list when triaging a new design request — first ask "is the surface I'm about to design already covered here?"

### 6.1 Public surfaces

| Route | File | Purpose | Width | Era notes |
|---|---|---|---|---|
| `/` | `src/routes/+page.svelte` | Hero with brand wordmark, flavor tagline ("The oldest and most important thing in the world is registration."), short description, two CTAs (Create / View Investigators). | `max-w-4xl text-center py-16` | Both eras: same layout, font swap drives the entire vibe shift. |
| `/login` | `src/routes/login/+page.svelte` | Sign-in. Google OAuth button, Discord OAuth button, dev-only credentials fallback when `dev` flag set. Note: "build without sign-in, sign-in required to save." | Centered narrow card | Buttons keep their official brand glyphs in both eras (legal requirement). |
| `/licensing` | `src/routes/licensing/+page.svelte` | Long-form Chaosium policy + GPL-3.0 details, blockquote-formatted legal text. | `max-w-3xl prose` | Classic: gold rule between sections. Modern: `===` separators ASCII-style. |

### 6.2 Library

| Route | File | Purpose | Width | Era notes |
|---|---|---|---|---|
| `/investigators` | `src/routes/investigators/+page.svelte` | Authenticated character library. Grid `1 / sm:2 / lg:3` columns of cards (name, occupation, era badge, optional draft badge, View / Duplicate / Archive). Empty state: dashed-border box with flavor copy + Create CTA. | `max-w-6xl py-8` | Both eras: card grid identical; era badge inside each card distinguishes 1920s vs 1980s investigators. |

### 6.3 Wizard (six steps under `/create/coc7e/`)

All six wrap with `WizardShell` (`src/routes/create/coc7e/+layout.svelte`). Outer width `max-w-5xl`.

| Step | Route | Key UI |
|---|---|---|
| 1 | `/create/coc7e/characteristics` | Roll-method selector (3d6×5 / 2d6+6×5), 8-stat grid with reroll buttons, age + era + generation-method controls. Heavy dice usage — overlay fires per roll. |
| 2 | `/create/coc7e/occupation` | Searchable occupation list with detail panel; income / Credit Rating display; formula choice when applicable. |
| 3 | `/create/coc7e/skills` | Skill allocation engine: occupation points budget + personal interest budget, real-time tracking, category filters, search. Choice-slot selector before spending occupation points. |
| 4 | `/create/coc7e/backstory` | Name, age, gender, pronouns, residence, birthplace, plus 10 backstory text-areas with `[data-flavor]` placeholders. |
| 5 | `/create/coc7e/equipment` | Era-filtered weapons list, common-items picker, custom item entry, finance fields auto-derived from Credit Rating. |
| 6 | `/create/coc7e/review` | Final composed character preview + Save (DB) + JSON / Markdown / PDF export buttons. |

**Era notes for wizard.** The step indicator and progress bar carry the era's primary color. The dice overlay fires across all six steps wherever a roll is made. Form inputs follow §5.3.

### 6.4 Sheet

| Route | File | Purpose | Width | Era notes |
|---|---|---|---|---|
| `/sheet/[id]` | `src/routes/sheet/[id]/+page.svelte` | Read view of a saved investigator. Sections in order: identity header (name, occupation, age, era, residence), export buttons row (JSON / MD / PDF), **play-mode** toggle exposing HP/MP/Sanity/Luck +/− trackers with progress bars + Save, characteristics grid (8 stats with half/fifth derivations), derived attributes block, skills list (sorted desc, occupation marker), backstory expansion, equipment table + finances. | `max-w-6xl py-8` | Both eras: same layout. Classic: gold underline under section headings. Modern: glow on stat numerals (Modern Dark only). |

---

## 7. State Patterns (forward-looking)

### 7.1 Loading

**Classic — "ink-bleed pulse".** Skeleton blocks render in `--color-muted` with a slow (`animation-duration: 2.4s`) opacity pulse from 0.85 → 1.0 → 0.85. Reads like ink spreading on paper.

**Modern — "blinking-cursor stripes".** Skeleton blocks are sharp-cornered `--color-muted` rectangles with a 2px-wide `--color-foreground` "cursor" at the right edge that blinks at 1Hz. Reads like a terminal still loading the row.

**Reduced motion.** Both patterns degrade to a static `--color-muted` block.

### 7.2 Empty states

Pattern already in use on `/investigators`: a dashed-border box (`border-dashed border-[var(--color-border)]`), centered flavor copy with `[data-flavor]`, and a primary CTA. **Extend this to all list surfaces** (saved characters, search results, history, audit logs).

**Classic.** Flavor copy reads as a wistful epigram. Example: *"No investigators are filed under your name. The cabinet awaits its first folder."*
**Modern.** Flavor copy reads as terminal output. Example: *"`SELECT * FROM investigators WHERE user_id = $1; -- 0 rows returned.`"*

### 7.3 Errors

**Anatomy.** A card with `bg-[color-mix(in_oklch,var(--color-destructive)_15%,var(--color-card))]`, `border-l-4 border-l-[var(--color-destructive)]`, body in `--color-foreground`. Heading uses `[data-heading]`. Existing precedent: PDF-export failure on the sheet (`/sheet/[id]`, lines 131–134).

**Classic.** Sealing-wax red border, ink heading.
**Modern.** Bracketed `[ERROR]` prefix on the heading, flat sharp card.
**Rule.** Errors must never block sheet content from rendering — show partial data, surface the error in-line.

### 7.4 Success / save confirmation

Reuse the dice-overlay component idiom (overlay with primary-tinted radial glow) but as a brief 800–1200ms toast (§5.9). Avoid full-screen overlays for save events — they're disruptive.

---

## 8. Layout Principles

### 8.1 Mobile-first, Tailwind v4 breakpoints

The codebase uses default Tailwind breakpoints (`sm 640 / md 768 / lg 1024 / xl 1280`). Designs MUST work down to **375px** width without horizontal scroll. Patterns observed:

- Header collapses brand to "M.U.R." below `sm` (`Header.svelte:26–28`).
- Wizard step indicator shows numbers below `sm`, labels above (`WizardShell.svelte:36–43`).
- Investigator grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.

### 8.2 Touch targets

Enforced globally in `app.css:49–58`: `button, a, select, [role="button"]` get `min-height: 44px; min-width: 44px;` below 768px. Form `<input type="number">` gets a 16px font size minimum to prevent iOS zoom. Stitch outputs MUST NOT override these.

### 8.3 Canonical content widths

| Width | Where | Notes |
|---|---|---|
| `max-w-4xl` | Homepage hero, narrow long-form pages | Centered text |
| `max-w-5xl` | Wizard outer container | Single column, room for stat grids |
| `max-w-6xl` | Header, footer, investigator grid, sheet | App standard |
| `max-w-3xl prose` | Long-form legal/policy text | Single readable column for licensing copy |
| `max-w-md` | Auth and prescribed dialogs | Tight focus |

### 8.4 Spacing rhythm

Use Tailwind's default 4px scale: `1` (4) / `2` (8) / `3` (12) / `4` (16) / `6` (24) / `8` (32) / `12` (48) / `16` (64). Avoid arbitrary values. Standard page padding is `px-4`; sections separated by `space-y-6` or `space-y-8`.

---

## 9. Motion & Reduced Motion

| Element | Default behavior | Reduced motion behavior |
|---|---|---|
| Theme transitions | `transition-colors` 150ms | unchanged (already <300ms; `app.css:31` enforces ≤0.01ms anyway) |
| Dice roll | Crypto-secure RNG resolves first; if 3D enabled and `prefers-reduced-motion` is OFF, run 3D animation; else show fallback box with the actual value | Skip animation; show fallback immediately |
| Atmospheric effects | Paper grain, paper fiber, vignette, scanlines, CRT vignette all render statically (no animation in source) | Hidden entirely — `effects.css` reduced-motion media query removes `body::before/::after` and `html::before` decorations |
| Phosphor glow (Modern Dark) | Static `text-shadow` | Removed — reduced-motion media query clears `text-shadow` |
| Coffee ring stains (Classic) | Static `background-image` on `body` | Stay visible — they are not motion |
| CRT degauss flash (era → Modern) | 700ms `filter`-keyframe animation on `.app-frame` | Suppressed — era transition becomes instantaneous |
| Sepia fade-in (era → Classic) | 600ms `filter`-keyframe animation on `.app-frame` | Suppressed — era transition becomes instantaneous |
| Phosphor flicker (Modern Dark, ambient) | 90s `filter`-keyframe animation on `.app-frame` | Suppressed |
| Eldritch glitch (programmatic) | `filter: url(#eldritch-displacement)` + chromatic-aberration `text-shadow` while `html.eldritch-glitching` | Suppressed — flash class still toggles but the visual is a no-op |
| Progress bar fill | `transition-all duration-300` | Unchanged (≤0.01ms forced) |

**Rule for new motion.** Never animate atmospheric effects (no flickering scanlines, no shimmering grain). Static-only. Functional motion (state transitions, focus, dialog enter/exit) is fine but must respect reduced motion.

---

## 10. Legal Constraints (binding)

These constraints OVERRIDE any aesthetic preference. Stitch must refuse to generate output that violates them.

1. **Chaosium Fan Material Policy disclaimer** — the verbatim paragraph in `Footer.svelte:4–17` must appear on every page. Do not paraphrase, summarize, or shorten. Linked text "www.chaosium.com" is required.
2. **No Chaosium logos or trade dress** — never generate art that mimics official Call of Cthulhu publication covers, the Chaosium Inc. logo, or the official CoC tentacle/sigil.
3. **No verbatim rule text** — game rules content must be paraphrased or in JSON content packs the user has authored, never quoted from official Chaosium publications.
4. **Excluded authors** — do not reference, depict, or generate content based on **Ramsey Campbell** or **Brian Lumley**'s settings, characters, or specific creations. (See project `CLAUDE.md`.)
5. **GPL-3.0 footer line** — "Miskatonic University Registrar — Open Source (GPL-3.0)" with a link to `/licensing` on every page.

For Stitch generation specifically: when prompted to design hero art or backgrounds, prefer abstract atmospheric imagery (fog, lamplight, terminal text) over depictions of named CoC entities.

---

## 11. Stitch Prompt Recipes

Drop-in blocks for the most common asks. Each recipe references **role tokens** (not raw colors) so output picks up the active theme.

### 11.1 New screen — Classic era

```
Atmosphere: Occult-academic, gaslit, parchment-aged. 1920s candlelit study.
Surface metaphor: Aged paper / candlelit oak desk.

DESIGN SYSTEM (REQUIRED):
- Platform: Web, mobile-first, then desktop up to 1280px.
- Palette tokens (use these names, not literal colors):
  - Page surface: var(--color-background)
  - Default text: var(--color-foreground)
  - Lifted panels: var(--color-card)
  - Primary action: var(--color-primary) on var(--color-primary-foreground)
  - Hover wash: var(--color-accent)
  - Hairlines: var(--color-border)
  - Decoration only (this era): var(--color-gold)
- Typography:
  - Headings: 'Playfair Display' serif, with [data-heading] attribute (gets antique ink shadow + h2 gold underline automatically).
  - Flavor copy: 'IM Fell English' italic, with [data-flavor] attribute.
  - Body: 'Inter' sans.
- Geometry: --radius is 0.25rem. Use rounded-md utility, not hardcoded radii.
- Decorative <hr> renders with a center diamond ◆ in gold automatically — emit plain <hr> when a divider is needed.
- Effects already applied at body level: paper grain, photograph vignette, antique ink shadow. Do not reproduce these per-element.

FORBIDDEN: bright neon colors, sharp text glow, monospaced fonts, scanlines, custom radii.

PAGE STRUCTURE:
1. Header: <Header /> from $lib/components/layout/Header.svelte (already provided in +layout.svelte; do not regenerate).
2. <main> with mx-auto max-w-{width} px-4 py-{rhythm}.
3. {describe the screen-specific content here}.
4. Footer: <Footer /> from $lib/components/layout/Footer.svelte (already provided; do not regenerate or paraphrase the Chaosium disclaimer).
```

### 11.2 New screen — Modern era

```
Atmosphere: Hacker-night, glowing CRT, sharp-edged, monospaced, dry. 1980s phosphor terminal.
Surface metaphor: Phosphor-coated cathode-ray tube.

DESIGN SYSTEM (REQUIRED):
- Platform: Web, mobile-first, then desktop up to 1280px.
- Palette tokens (use these names, not literal colors):
  - Page surface: var(--color-background)
  - Default text: var(--color-foreground) — phosphor green on dark, charcoal on light
  - Lifted panels: var(--color-card) — barely-darker / barely-lighter on purpose
  - Primary action: var(--color-primary)
  - Hover wash: var(--color-accent)
  - Hairlines: var(--color-border) — phosphor trace
- Typography:
  - Headings: 'IBM Plex Mono' bold, with [data-heading] (gets phosphor glow on Modern Dark automatically).
  - Flavor copy: 'VT323' monospace, with [data-flavor].
  - Body: 'IBM Plex Mono'.
- Geometry: --radius is 0rem. NEVER use rounded-md / rounded-lg / rounded-full (except for the user-avatar circle which is application-specific). Use rounded-[var(--radius)] if a parameterized radius is unavoidable.
- Effects already applied at body level: CRT scanlines, CRT vignette, static phosphor text-shadow on Modern Dark. Do not reproduce these per-element.

FORBIDDEN: rounded corners, soft shadows, serif fonts, gold accents (--color-gold is undefined here), animated glow, paper-grain effects.

PAGE STRUCTURE:
1. Header: <Header />.
2. <main> with mx-auto max-w-{width} px-4 py-{rhythm}.
3. {describe the screen-specific content here}.
4. Footer: <Footer /> (Chaosium disclaimer non-negotiable).
```

### 11.3 Edit existing screen

```
Constraints:
- Preserve the era of the screen as it currently is (Classic OR Modern). Do not switch typography, radius, or palette.
- Change ONLY the elements specified below; leave all other regions byte-identical.
- Continue using role tokens (var(--color-primary) etc.); do not introduce literal color values.
- Maintain existing accessibility attributes ([data-heading], [data-flavor], aria-labels, role="radiogroup" patterns, focus rings).

Targeted change:
{specify exactly which element(s) to change and the desired new behavior}
```

### 11.4 New empty state

```
Reuse the existing investigators-list pattern:
- Container: dashed border (border-dashed border-[var(--color-border)]), padded card.
- Heading with [data-heading] attribute, single short sentence.
- Flavor copy with [data-flavor], one or two sentences in era voice (Classic = wistful epigram; Modern = terminal output style).
- Primary CTA button, single action (e.g., "Create your first investigator").
- No imagery.
```

---

## 12. Open Questions / Out of Scope

- **Stitch Project ID** — not yet created. Populate the header field after the first `generate_screen_from_text` run; persist the ID in this file (line 3).
- **3D dice asset library** — separate concern; the dice overlay is documented in §5.7 but the 3D mesh / texture work is governed elsewhere.
- **Character portrait generation** — out of scope for this DESIGN.md. Note that any future portrait feature is bound by §10.2 (no Chaosium trade dress) and §10.4 (no Campbell / Lumley).
- **shadcn-svelte adoption** — `src/lib/components/ui/` is currently empty. When components are added, each must be styled to match §5 and gain a Classic + Modern realization in this file.
- **Content-pack-driven theming** — content packs may eventually carry their own visual hints (era-specific occupation cards, etc.). When that lands, this document needs governance for how content packs may extend tokens without overriding them.

---

## 13. Atmospheric Flourishes

The base atmosphere from §1.2 / §1.3 (paper-noise, vignette, scanlines, phosphor glow) is the floor. This section catalogs the **flourish layer** that sits on top — coffee stains, paper fiber, era-transition flashes, ambient flicker, and the on-demand eldritch glitch — and the rules every flourish must obey.

### 13.1 Rules every flourish must obey

1. **Decoration only.** All flourishes sit on `aria-hidden` layers, `pointer-events: none`. They never receive input or block interaction.
2. **Token-scoped.** Colors come from theme tokens or oklch values that are theme-coherent. No literal hex, no asset images.
3. **Reduced-motion respect.** Animated flourishes are suppressed under `prefers-reduced-motion: reduce`. Static decorations (stains, fiber) stay visible — they are not motion.
4. **No new dependencies.** SVG `<filter>` + CSS keyframes only. PixiJS / additional WebGL runtimes are explicitly NOT used here — they would duplicate the Three.js runtime already loaded for dice. See §13.7 for the escalation criterion.
5. **Filtered ancestor isolation.** Any rule that animates `filter` or applies `filter: url(...)` MUST target `.app-frame` (the inner layout wrapper), not `body`. Filters create a containing block for fixed-position descendants — applying them to `body` would re-anchor `DiceRollOverlay` (and any future modals / toasts) and break their viewport positioning.

### 13.2 Coffee ring stains *(Classic only, static)*

**Source:** `src/lib/themes/effects.css` — `.classic-light body { background-image: url("data:image/svg+xml...") }` and `.classic-dark body { ... }`.

Three coffee rings, each implemented as a single SVG (inlined as a data URL on `body { background-image }`, anchored with `background-attachment: fixed; background-size: cover`). The ring shape is **not** a radial-gradient blob — it's a circular stroke. Each stain is built from:

- **Outer dark band** — `<circle stroke-width="0.34" stroke-dasharray="17 100" stroke-linecap="round">`. The dasharray creates one long stroke (~80% of the circumference) with a single gap (the cup-tilt break). This produces a real "incomplete ring" — not a complete circle, not a smooth fade.
- **Inner thinner band** — a second concentric `<circle>` at slightly smaller radius and lower alpha. This recreates the *coffee-ring effect*: solute migrating to the rim during evaporation creates a darker concentrated outer edge.
- **Stray droplets** — one or two small `<ellipse>` elements positioned outside the ring, suggesting splashes the cup made.
- **Per-stain rotation** — each `<g>` is `rotate(35)`, `rotate(-15)`, `rotate(110)` so the cup-tilt gap points in a different direction per stain.

| Theme | Ring base color (rgba) | Outer band alpha | Inner band alpha | Droplet alpha |
|---|---|---|---|---|
| Classic Light | `rgba(120, 80, 40)` (sepia-brown) | 0.16–0.18 | 0.10–0.11 | 0.11–0.14 |
| Classic Dark | `rgba(190, 140, 75)` (warm amber) | 0.11–0.13 | 0.07–0.08 | 0.08–0.10 |

Stains do NOT animate, do NOT randomize per page-load (the same three positions every time), and are absent in Modern themes (no rule applies). When designing new screens, **do not place critical UI directly over the documented stain hotspots** — translate origins are at viewBox coordinates `(15, 14)`, `(80, 9)`, `(47, 49)` on a `0 0 100 56` viewBox, which maps roughly to (15%, 25%), (80%, 16%), (47%, 87%) of the viewport.

To adjust intensity, alpha values are the dial. To reposition a stain, edit the `transform="translate(...)"` of its `<g>` in the data URL. To change the gap-angle (where the cup tilted), edit the `rotate(...)`.

### 13.3 Paper fiber overlay *(Classic only, static)*

**Source:** `src/lib/themes/effects.css` — `.classic-dark::before, .classic-light::before { filter: url(#paper-fiber); }`. Filter defined in `src/app.html`.

A second turbulence layer sits on `html::before` (so it doesn't conflict with `body::before` which carries `paper-noise`). Anchored to the viewport via `position: fixed; inset: 0`, `z-index: 9996`. The `#paper-fiber` SVG filter uses asymmetric `baseFrequency="0.012 0.18"` — low-frequency horizontally, mid-frequency vertically — yielding faint horizontal striations that read as visible paper fibers under the existing high-frequency noise.

Light theme uses `mix-blend-mode: multiply` at opacity 0.09 (darker fibers visibly multiply onto bright paper); Dark theme uses `mix-blend-mode: overlay` at opacity 0.05 (warmer fibers on dim ground).

**Tuning history.** Earlier iterations had the noise+fiber layers at lower opacity with `overlay` blend on Light. On flat-light surfaces overlay is nearly a no-op — the pages read as flat sepia. Switching Light to `multiply` and bumping `body::before` opacity to 0.14 / `html::before` to 0.09 brings the texture forward without drowning content legibility.

### 13.4 `[data-typed]` typewriter font *(Classic-distinctive, opt-in)*

**Source:** `--font-typed` in `src/lib/themes/base.css`; `[data-typed]` rule applies the value.

A new attribute hook joins `[data-heading]` and `[data-flavor]`. In Classic, `--font-typed` is `'Special Elite', 'Courier New', monospace` — Google Fonts loads Special Elite alongside the other Classic fonts. In Modern, the variable resolves to `'IBM Plex Mono', monospace` so the attribute is a no-op (Modern is already monospaced).

**When to use `[data-typed]`.**

- Investigator name as displayed on the sheet
- Form-echo values (the user's typed response shown back to them)
- Stat numbers if the design wants to reinforce the "pencil-and-paper sheet" feeling
- Auto-filled audit entries (e.g., "Skill +20: Occupation")

**When NOT to use it.** Body prose, navigation, button labels — Inter (Classic body) or Plex Mono (Modern body) is right for those.

### 13.5 CRT degauss flash *(Modern, on era transition)*

**Trigger:** `triggerEraTransition('modern-in')` from `src/lib/stores/atmosphere.ts`. The theme store calls this automatically when the user toggles era to Modern (`src/lib/stores/theme.ts`); the initial subscribe emission is deliberately skipped so the effect does not fire on page load.

`<html>` gets `data-era-transitioning="modern-in"` for 700ms; the CSS rule `html[data-era-transitioning='modern-in'] .app-frame { animation: crt-degauss-in 700ms ease-out }` plays the keyframe sequence: blur 8px + saturate 2.4 + hue-rotate 18° + brightness 1.4 → settles to none. A small horizontal jitter (±2px translate3d) reads as electron-beam mis-convergence.

**Sister effect.** Toggling INTO Classic plays `sepia-fade-in` (600ms, less aggressive — sepia 0.45 + brightness 1.08 + contrast 0.92 → settles), so era transitions feel directional in both directions.

### 13.6 Phosphor flicker *(Modern Dark only, ambient)*

**Source:** `effects.css` — `.modern-dark .app-frame { animation: phosphor-flicker 90s linear infinite }`.

90-second cycle, dip happens at 99.0–99.4% of the cycle (~360ms total dip across two stops, brightness 0.88–0.93 + contrast 1.04–1.06). Reads as the very rare CRT electron-beam stutter. The 90-second period was chosen so users don't perceive it as a regular pulse — it feels random in practice. Disabled under `prefers-reduced-motion`.

Modern Light does NOT flicker (a flat-panel office terminal lit by ambient lighting wouldn't visibly stutter the way a Dark CRT would).

### 13.7 Eldritch glitch *(programmatic, both eras)*

**Source:** `triggerEldritchFlash(durationMs = 600)` in `src/lib/stores/atmosphere.ts`. Adds `eldritch-glitching` class to `<html>` for the duration.

CSS applies `filter: url(#eldritch-displacement) hue-rotate(8deg) contrast(1.08)` to `.app-frame`. The `#eldritch-displacement` SVG filter (defined in `src/app.html`) uses an internal `<animate>` element to oscillate `baseFrequency` from `0.018 0.4` → `0.05 0.8` → `0.018 0.4` over 900ms — so the displacement *itself* warps temporally during the flash. Body text and headings simultaneously gain a chromatic-aberration text-shadow (red-orange offset right, cyan offset left).

**Currently no automatic trigger.** The store API is the contract for future hookpoints:

| Future hookpoint | Recommended call | Notes |
|---|---|---|
| Sanity loss in play mode (`/sheet/[id]`) | `triggerEldritchFlash(550)` | The narratively perfect moment — call from the SAN −/-/-N button handler. |
| Roll of 100 on a Cthulhu Mythos check | `triggerEldritchFlash(800)` | Slightly longer for a critically failed Mythos roll. |
| First time a user sees a Mythos skill on the skill list | `triggerEldritchFlash(300)` | One-time, very brief — discovery cue. |
| Manual dev affordance | Call from a header hidden button or browser console | For QA. |

**Do not auto-fire on page navigation or era toggle** — combined with the degauss this would feel like screen damage rather than horror. Keep it rare and narrative.

### 13.8 PixiJS escalation criterion

This atmospheric layer is intentionally CSS + SVG only. Move to a WebGL/PixiJS implementation **only if** all three of these are true at once:

1. The effect requires per-pixel real-time access to the rendered page (e.g., a sanity-loss "the page is breathing" effect that needs to sample and warp the actual rendered DOM).
2. SVG `<feDisplacementMap>` + CSS keyframes have been tried and proven inadequate.
3. The effect has a dedicated container surface — it is NOT applied across the entire viewport (which would conflict with the DOM-on-top architecture and introduce input/accessibility friction).

If those conditions hit, prefer the existing Three.js runtime (already loaded for `@3d-dice/dice-box-threejs`) over adding PixiJS. PixiJS becomes the right answer only if a future feature requires Pixi-specific filters or its `ParticleContainer` performance characteristics. Document that decision in this section when it happens.

### 13.9 Atmosphere store API (`$lib/stores/atmosphere`)

```typescript
import {
    triggerEldritchFlash,    // (durationMs?: number) => void
    triggerEraTransition,    // (direction: 'modern-in' | 'classic-in') => void
    eldritchFlashActive      // Readable<boolean>
} from '$lib/stores/atmosphere';
```

- `triggerEldritchFlash(durationMs = 600)` — fires the eldritch glitch once. Overlapping calls extend the active window.
- `triggerEraTransition(direction)` — fires the appropriate era-toggle keyframe. The theme store calls this automatically on user-initiated era changes; manual callers should be rare.
- `eldritchFlashActive` — `Readable<boolean>`. Useful for UI affordances (e.g., dimming an unrelated pulsing element while the flash is active).

### 13.10 Quick reference — what fires when

| Event | Effect | Source |
|---|---|---|
| Page load (any era) | Static decorations only (stains, fiber, scanlines, vignette, phosphor glow) | All themed CSS |
| Era toggle → Modern | CRT degauss flash, 700ms | Auto via theme store |
| Era toggle → Classic | Sepia fade-in, 600ms | Auto via theme store |
| Mode toggle (light↔dark) | None — instantaneous; existing `transition-colors` smooths the swap | — |
| User on Modern Dark, idle | Rare phosphor flicker every ~90s | Auto via CSS animation |
| Sanity loss / Mythos crit / etc. | Eldritch glitch | Future code calls `triggerEldritchFlash()` |
| Reduced motion preference | Only static decorations remain | `effects.css` media query |
