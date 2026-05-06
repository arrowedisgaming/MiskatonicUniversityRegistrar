# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.9.0] - 2026-05-06

### Added
- **Cthulhu by Gaslight era** — a new `gaslight` era (1880–1899, late-Victorian) is now selectable in the wizard alongside 1920s Classic and Modern Day. Era picker, wealth table, equipment list, skill filter, and exports all respond automatically via the existing content-pack data architecture.
- 36 new dedicated Gaslight occupations: Adventuress, Alienist, Antiquarian, Aristocrat, Artist, Blacksmith, Cabbie, Clergy, Consulting Detective, Craftsperson, Criminal (Gonoph) + 7 specialist criminal subtypes (Cracksman, Footpad, Magsman, Macer, Rampsman, Screever, Shofulman, Street Gang), Military Officer, Military Enlisted/NCO, Explorer, Gentleman/Gentlewoman, Inquiry Agent, Journalist, Inventor (Pulp only), Laborer + 3 specialists (Chimney Sweep, Gravedigger/Sexton, Navvy), Physician, Police Constable, Police Detective, Scientist, Servant, Spy. Each carries `socialClass`, CR range, skill-point formula, and 8-skill list from the 4th edition sourcebook.
- 15 existing 1920s occupations extended to also appear in Gaslight (`accountant`, `acrobat`, `actor`, `archaeologist`, `artist`, `author`, `engineer`, `entertainer`, `farmer`, `musician`, `nurse`, `photographer`, `professor`, `sailor`, `student`).
- 6 new Gaslight-era skills: Alienism (01%), Mesmerism (01%, uncommon), Reassure (APP/5), Religion (10%, specialization), Drive Carriage (20%), Pilot — Balloon (01%).
- Drive Auto and Psychoanalysis restricted from the Gaslight era (replaced by Drive Carriage and Alienism respectively); Hypnosis replaced by Mesmerism.
- Victorian wealth table (£ sterling, 6 tiers: Penniless → Super Rich) from *Cthulhu by Gaslight* 4th ed. p.73.
- Victorian common-item list (20 items: pocket watch, gas lamp, walking stick, oilskin, etc.) and 9 Victorian weapons (Webley Revolver, Martini-Henry Rifle, Truncheon, Cavalry Sabre, Derringer, Blackjack, etc.).
- `socialClass` field on `CoCOccupationDefinition` type and Zod schema (optional; `upper | middle | working | criminal | any`).
- Currency symbol parameterised in `calculateStartingWealth` (default `'$'`; Gaslight passes `'£'`), so Equipment step shows £-prefixed cash and assets for Victorian investigators.
- Era names resolved via content-pack metadata in PDF and Markdown exports (e.g. "Gaslight (1880–1899)" instead of the raw id "gaslight").

## [0.8.0] - 2026-05-06

### Added
- New pure engine module `src/lib/engine/backstory.ts` — canonical backstory field order, human-readable labels, and PDF priority lists now live in one place rather than being duplicated across the PDF exporter and the sheet route. Exports `BACKSTORY_FIELDS`, `BACKSTORY_KEYS`, `BACKSTORY_LABEL_BY_KEY`, `PDF_BACKSTORY_PRIORITY_KEYS`, and `PDF_BACKSTORY_PRIMARY_KEYS`.

### Changed
- One-page PDF redesigned:
  - Backstory section replaced with a two-column micro-grid; each field renders as a label (burgundy, 5.6pt) over its value (6.4pt), showing up to 128 characters per field instead of 100. Non-empty fields are prioritised (Personal Description → Ideology → Significant People → Key Connection → Traits) with remaining non-empty fields filling any leftover slots, up to 8 fields total.
  - Combat & Possessions block moved under the Characteristics column so the right column (Attributes + Backstory) is no longer cut short.
  - Weapons and gear items share a single combined table (6 total rows); overflow is reported as "+N weapons, +N items not shown".
  - Blank specialisation fill-in slots (`Firearms(________)` etc.) are no longer printed in the skill list.
  - Section band margins and padding tightened; tracker boxes now use explicit `paddingTop`/`paddingBottom` callbacks for consistent vertical centering; Characteristics corner cell changed from burgundy to black.
- Investigator sheet route now imports `BACKSTORY_KEYS` and `BACKSTORY_LABEL_BY_KEY` from `src/lib/engine/backstory.ts`, removing the locally-duplicated field list and camelCase-split label fallback.

## [0.7.0] - 2026-05-06

### Added
- Edit mode on the investigator sheet (`/sheet/[id]`). An "Edit" button next to Play Mode swaps the read-only sheet for an in-place editor: name, age, era, gender, pronouns, residence, birthplace, portrait URL, all eight characteristics (with +/- steppers and inline numeric input), all skills (sorted by total, with steppers and inline input that flow through the skill audit-trail allocations), and the eleven backstory fields. A sticky toolbar exposes Cancel / Save changes; saving sends the full character JSON to the existing `PUT /api/investigators/:id` endpoint and reloads the page so server-rendered data stays authoritative. Skills allocation reduction follows `experience → personal-interest → occupation` order so the wizard's audit trail is preserved as much as possible. Saves recompute derived stats (HP/MP/Sanity/Luck max, Damage Bonus, Build, Move Rate) from the edited characteristics + age + Cthulhu Mythos, and clamp current values into the new bounds.
- Sheet route loader (`src/routes/sheet/[id]/+page.server.ts`) now exposes the full content pack (`getContentPack()`) so the editor can read `damageBonusBuildTable`, `ageModifiers`, and the era list without a second fetch.

### Changed
- All `<button>` and `<a>` controls in the investigator sheet header (JSON / Markdown / PDF / Edit / Play Mode / Back) now declare `cursor: pointer`, matching the rest of the app.

### Notes
- Edit mode bounds age to **15–89** to match the wizard and the content pack's `ageModifiers` range. Outside that range, `getAgeModifier()` returns `null` and `calculateAllDerived` would silently drop age-driven move-rate and characteristic adjustments.
- The Mode field (Standard / Pulp) is intentionally **not** editable from this form — Pulp creation is still gated in the wizard while Pulp talents/archetypes are unimplemented, and exposing a Mode toggle here would let users persist a state the rest of the app does not honor.
- Stepper +/- buttons and number inputs in edit mode carry per-row `aria-label`s ("Decrease Strength", "Accounting total", etc.) so screen-reader users hear what they're adjusting, in line with the project's WCAG 2.1 AA pass.

## [0.6.1] - 2026-05-06

### Fixed
- One-page PDF: generic specialization fill-in rows (e.g. `Firearms(________)`, `Fighting(________)`) no longer print a misleading regular/half/fifth target. Previously the row reused the first definition's `baseValue`, but Firearms spans 5–25 across its specs and Fighting spans 5–25 — so `Firearms(________)` was printed as 20 (Handgun) and `Fighting(________)` as 25 (Brawl), leading a player who wrote in a different specialization to read the wrong target. The blank row now keeps a concrete value only when every definition in the group shares the same base and none derive from a characteristic (Art/Craft, Science, etc.); for mixed-base groups the value/half/fifth cells render empty so the player writes in the correct number for the specialization they pick. Regression tests added for both branches in `tests/unit/export/pdf-helpers.test.ts`.

## [0.6.0] - 2026-05-06

### Changed
- PDF investigator-sheet export rebuilt as a single Letter page in the period investigator-sheet idiom. Layout: header → characteristics grid + tracker boxes + backstory in a top split row → three-column complete skill list → combat & possessions band → fan-content disclaimer footer. Burgundy banner section headers (`#5C1A1B`) on a parchment-zebra (`#f6f0eb`) skill table. The skill list is era-filtered, computes derived bases for Dodge / Language (Own) from characteristics, collapses specialization groups (Art/Craft, Science, Pilot, Survival, Firearms, Fighting, Language) to allocations plus one fillable blank slot per group, and marks occupation skills from the occupation definition rather than only from per-character allocation flags. Each skill row shows regular / half / fifth values matching the characteristics block. Backstory renders four prioritized fields (Ideology / Significant People / Traits / Key Connection) in the right column under Attributes, with per-field truncation. The Chaosium fan-content disclaimer remains in the page footer. Original layout — no Chaosium logos, trade dress, artwork, or verbatim rule text.
- `generatePDF` signature now `(character, occupationName, skills, occupations)` so the export has the data needed to render the full era-applicable skill list and resolve occupation skill markers. The sheet route loader (`/sheet/[id]/+page.server.ts`) now exposes `skills` from the content pack alongside `occupations`.
- Characteristics table polish: title-case names (`Strength`, not `STRENGTH`), center-aligned in a 90pt name column, with vertical centering achieved via per-cell top-margin compensation (pdfmake has no `vAlign` for cells; each cell's top margin is `(rowHeight − cellHeight) / 2`). Top-left "unused" corner cell shaded burgundy to tie back to the section banner. Font sizes rebalanced to keep the table the same overall height while spreading visual weight more evenly: row name 11pt, regular value 13pt, half/fifth 12pt, column headers 8pt.
- Dev script (`npm run dev`) now also loads `.env.local` via Node's native `--env-file-if-exists` flag, so per-machine dev-only flags (e.g. `AUTH_DEV_AUTOLOGIN=true` for the existing dev-auto-login pass-through) can live in a gitignored file rather than the committed `.env`. Fix targets a real gap: Vite reads `.env` for `import.meta.env` / `$env/dynamic/private` but does not populate `process.env`, which the dev-auto-login handle reads directly. Loading at the Node-process level via `--env-file-if-exists` puts the flag in `process.env` before Vite starts. The flag is `if-exists`, so a fresh clone with no `.env.local` runs `vite dev` cleanly.

### Added
- New pure module `src/lib/export/pdf-helpers.ts` (`buildSkillRows`, `computeDerivedBase`, `filterSkillsForEra`, `findOccupation`, `getOccupationSkillIds`, `formatSkillName`, `truncate`, `distributeIntoColumns`) and a pure `buildDocDefinition` exported from `src/lib/export/pdf-export.ts`. Together they make the previously untestable PDF pipeline assertable in Vitest without loading pdfmake. 31 new unit tests cover era filtering, derived-base parsing (`edu`, `dex/2`, fallbacks), specialization-group collapse, occupation marker resolution from the occupation definition, name formatting with `customName` overrides, truncation edges, column-distribution clamping (no trailing empty columns), and doc-definition shape (Letter page size, no explicit page break, disclaimer present, all section banners present, era filtering applied, occupation marker present).

### Fixed
- `distributeIntoColumns` no longer emits trailing zero-row columns when the input has fewer items than `columnCount`. Latent issue: a near-empty skill list would produce empty pdfmake table nodes. Unreachable in practice with the current ~50-row era-filtered skill list, but cheap to make defensible.
- CHANGELOG comparison links restored — `[Unreleased]` was still pointing at `v0.1.4...HEAD`, and the intermediate `[0.2.0]` through `[0.5.0]` link references had never been added.

## [0.5.0] - 2026-05-05

### Added
- Play-mode dice rolling on the investigator sheet. Tap any characteristic or skill in the sheet's play mode to roll a d100, evaluate the result against CoC 7e thresholds (critical / extreme / hard / regular / failure, plus fumble detection), and append the outcome to a per-character roll log. Each entry records the raw roll, the target / half / fifth values rolled against, the resolved outcome, and the timestamp. Bumps `CHARACTER_SCHEMA_VERSION` to 3; `migrateCharacterData` defaults the new `playRollHistory` field to `[]` for existing characters so they continue to load.
- New pure engine `src/lib/engine/coc-percentile-check.ts` (`evaluateCoC7ePercentileCheck`) with full unit-test coverage of the rule edges: critical on 01, extreme/hard/regular boundaries, fumble band 96–99 (skill < 50) vs no-fumble at skill ≥ 50, fumble on 100, and 100-always-fails even when skill ≥ 100.
- Dev-only auto-login pass-through. Local dev sessions can skip the `/login` screen entirely and load any page already authenticated as a fixed `dev@local` / `Dev User` row in SQLite. Activated by copying `src/lib/server/dev-auto-login.example.ts` to `src/lib/server/dev-auto-login.ts` (gitignored — never reaches GitHub) and setting `AUTH_DEV_AUTOLOGIN=true` in `.env`. Requires `NODE_ENV=development`. Off by default. Defense-in-depth: the live bypass file is gitignored so it can't accidentally ship to Cloudflare; even if it did, the env-flag, `NODE_ENV`, and loopback-hostname checks short-circuit it; `hooks.server.ts` discovers the module via `import.meta.glob` so production builds simply produce an empty loader map and no-op. Implementation mints an Auth.js-compatible JWT signed with the *same secret resolution chain* the production `authHandle` uses (`getEnv('AUTH_SECRET') ?? DEV_AUTH_SECRET`) and injects it into both the response cookie and the in-flight request headers, so the downstream `authHandle` reads it as a normal session — no divergent auth code path.

### Fixed
- CoC 7e rule: a roll of 100 is now correctly classified as `failure` (and a fumble) at every skill rating, including pulp / boosted skills with `target ≥ 100`. Previously `outcomeFromRoll` would short-circuit to `regular` when `roll <= target`, missing the "100 always fails" rule for high-skill characters.
- `playRollHistory` is now capped at 500 entries client-side before persistence. Without the cap, a heavily-rolled character would eventually hit the schema's 10,000-entry maximum and `persistInvestigator` would silently fail saves.
- HP/MP/Sanity/Luck progress bars in play mode no longer render `Infinity%` widths when a tracker `max` is 0 (e.g. before characteristics are filled in). Output is clamped to `[0, 100]`.

### Changed
- Investigator sheet `+page.svelte` now uses the canonical Svelte 5 runes pattern: typed `$props()` from `./$types`, `$derived` for `char`, `occupation`, and `sortedSkills`, and `untrack()` around the in-play tracker initializers to mark them as deliberate one-shot snapshots. Removes the previous `page.data as { ... }` cast that bypassed the generated types.

## [0.4.0] - 2026-05-03

### Added
- Restrained-eerie wizard motion. New `src/lib/transitions/eerie.ts` module exposes `ledgerPage`, `inkBleed`, and `dossierFiling` — Svelte transitions tuned to the existing atmosphere layer's 220–320ms settle durations. Each honors both `prefers-reduced-motion` and the project-level `data-reduce-effects` toggle and resolves to a no-op when either is active.
- Wizard step transitions: `WizardShell.svelte` now wraps `{@render children()}` in `{#key currentPath}` + `in:ledgerPage`, so each step fades in like a filed page rather than swapping instantly.
- Characteristics page reveal: the eight characteristic rows stagger in (60ms apart) when values first appear; Luck and Derived Attributes panels follow at 540ms / 620ms, mirroring the order a 1920s registrar would tabulate them.
- Review page dossier cascade: warnings → header → characteristics → derived attributes → skills → backstory → equipment fly in top-to-bottom (120ms apart). A single `triggerEldritchFlash(450)` fires at 700ms after mount, timed to land as the Sanity row settles — "the dossier compiles itself; sanity arrives late and wrong."

### Notes
- All wizard transitions use the `|global` modifier (`in:inkBleed|global`, `in:dossierFiling|global`, `in:ledgerPage|global`). Without it, items inside `{#each}` blocks only animate when added/removed individually, not on initial each-mount, so the characteristic-row stagger silently no-ops on the first roll. `|global` also makes the wizard-shell page fade fire on first mount, not only on subsequent in-app navigations.

### Fixed
- Skills allocation: typing into the Personal Points or Occupation Points field for a skill that hadn't yet been touched did not update the running totals at the top of the page (and Total/Half/Fifth on the row stayed stale). Root cause: `setOccPoints`/`setPersonalPoints` (`src/routes/create/coc7e/skills/+page.svelte`) read via `getAlloc()`, which falls back to a fresh `{occupation:0, personal:0}` object when the skill has no entry yet. Mutating that fallback never wrote into the `pointAllocations` map, and the reassignment trigger had nothing to react to. Replaced with proper immutable updates so first-touch and subsequent edits both flow through the reactive graph.
- Eldritch flash on the review page now respects reduced-motion. The `html.eldritch-glitching .app-frame` reduced-motion / `data-reduce-effects` suppressors in `src/lib/themes/effects.css` only zeroed out the `.app-frame` text-shadow, leaving the matching `[data-heading]` chromatic shadow active when `triggerEldritchFlash()` fires. Added `[data-heading]` to both suppressor selectors so users opted out of motion no longer see chromatic aberration on headings during the sanity-reveal flash.

### Changed
- Skills wizard step: the Occupation Points / Personal Interest Points budget panel is now `position: sticky` so it stays visible while the long skill list scrolls. Its top offset is the runtime-measured height of the Alpha banner (a second `ResizeObserver` on `.alpha-banner`) rather than a hardcoded 61px — so the budget block stays pinned correctly when the banner wraps to two lines on narrow viewports or with larger text settings. Backdrop-blur opaque background prevents the table rows from bleeding through.
- Skills wizard step: category filter pills + search input are folded into the same sticky block as the budget totals, so the player can re-filter or search without scrolling back to the top of the page. The combined block measures itself via `ResizeObserver` and exposes its height to the table; the table `<thead>` then sticks directly below at the measured offset, keeping the column labels (Skill / Base / Occ. Pts / Pers. Pts / Total / Half / Fifth) visible while scrolling the 80-row list.
- Skills wizard step: the proceed button now distinguishes hard blockers (overspending, single skill > 99, ineligible-skill points, missing required choice-slot picks) from soft warnings (unspent points, Credit Rating outside occupation range). Hard blockers keep the button disabled in a red error panel ("Resolve before continuing"). Soft warnings show in an amber panel ("You can continue, but…") and recolor the proceed button to amber ("Continue anyway →"), letting the player advance with the trade-off acknowledged. Skill points cannot be added later, only earned through play, so the warning explicitly says so.
- Skills wizard step: per-pool input lockout. Once a pool (Occupation or Personal Interest) reaches zero remaining, the corresponding column's input on every *unallocated* row is disabled with a tooltip ("No occupation/personal interest points remaining — reduce another skill to free points"). Rows that already have an allocation in that pool stay editable so the player can decrease them; reducing any row immediately re-enables the previously locked inputs because `remainingOcc` / `remainingPersonal` flip back above zero through the reactive graph. Each input also enforces a dynamic `max` attribute (`min(99, current + remaining)`) and snaps back to authoritative state inside `oninput` if the requested increase would exceed the budget — so the displayed value never drifts from the data model.
- Skills wizard step: removed the `overflow-x-auto` wrapper around the skills table. Any ancestor with `overflow: auto/scroll/hidden` becomes the containing block for `position: sticky` descendants — the thead was effectively trying to stick within the wrapper's tiny scroll area instead of the viewport, which is why the column-header row appeared mid-page over the skill rows instead of pinned directly below the budget+filters block. The table fits within the wizard's `max-w-5xl` container at all desktop widths; truly narrow viewports rely on page-level horizontal scroll, which doesn't break sticky.

## [0.3.0] - 2026-05-03

### Added
- `<LiveAnnouncer>` component (`src/lib/components/a11y/LiveAnnouncer.svelte`) and `announcer` store (`src/lib/stores/announcer.ts`) — single source of truth for `aria-live` announcements. Wired into wizard step changes (announces "Step N of 6: Label") and dice rolls ("Rolled X, Y, Z. Total N.").
- Skills page point-budget panel now exposes itself as `role="status" aria-live="polite"`, so screen-reader users hear remaining occupation/personal interest points update as they're spent.
- "Reduce theme effects" toggle in the Header (Sparkles icon). Persists to `localStorage` (`theme-reduce-effects`) and applies `data-reduce-effects` on `<html>` to disable grain, scanlines, vignettes, phosphor glow, and chromatic aberration — independent of the OS `prefers-reduced-motion` setting.
- `A11Y-AUDIT.md` at the project root — comprehensive WCAG 2.1 AA audit report with contrast tables for all four themes and a prioritized fix list.

### Changed
- **Contrast (WCAG 2.1 AA):** `--color-muted-foreground` darkened/brightened across all four themes so muted-on-muted text passes 4.5:1. `modern-light` `--color-primary` darkened (oklch L 0.55 → 0.42) so off-white CTA labels on amber buttons clear AA. `--color-ring` updated to match.
- Wizard step pages now use a single `<h1>` per page (e.g. "Characteristics", "Skills"); former `<h3>` sub-headings promoted to `<h2>` to maintain hierarchy. The classic-era gold ornamental underline now applies to both `h1[data-heading]` and `h2[data-heading]` so promoted page titles keep their decoration.
- All disabled "Proceed"/"Save Investigator" buttons now have a visible hint sibling and `aria-describedby` so SR users hear *why* the button is disabled (e.g., "Spend or refund all occupation points.").
- PDF export (`src/lib/export/pdf-export.ts`) tokenizes color constants at the top of the file. The previous `#888888` failed AA on white paper (2.85:1); replaced with `#3a3a3a`/`#444444`/`#555555` (all ≥ AA, footer at AAA).
- Sheet "In-Play Tracking" panel wrapped as `<section aria-labelledby>` so it forms a proper landmark for screen-reader navigation.
- 33 `<button>` elements across the wizard, sheet, dice, and header now have explicit `type="button"` (latent submit-on-Enter bug if a wrapping `<form>` is ever added).
- Mobile 44px touch-target rule (`src/app.css`) now excludes inline links inside `<p>`/`<li>`/`<span>`/`[data-flavor]` so prose line-height isn't stretched.
- Scrollbar styling extended with Firefox `scrollbar-width`/`scrollbar-color` so non-WebKit browsers track theme tokens.
- Smoke test for the characteristics wizard updated to match the new `<h1>` heading.

### Fixed
- `announce()` (`src/lib/stores/announcer.ts`) now uses `setTimeout(50)` between the clear and the new value rather than `queueMicrotask`. Svelte may batch microtask-scheduled store updates into a single DOM write, which silently suppresses re-announcements of identical strings in NVDA/JAWS. The 50ms gap guarantees a real render frame between empty and the new value.

## [0.2.2] - 2026-05-03

### Added
- Persistent eldritch-flavored alpha warning banner (`src/lib/components/layout/AlphaBanner.svelte`) at the top of every route, signaling that the character JSON schema is unstable and data loss may occur during alpha. Sticky positioning keeps it pinned to the viewport while scrolling. Themed with inline tentacle SVG glyphs and the existing oklch palette; uses `role="status"` + `aria-live="polite"` for screen-reader announcement.

### Changed
- Footer simplified to a single line: meta-line on the left, GitHub + Licensing & Legal links on the right. The Chaosium Fan Material Policy disclaimer was removed from the footer; it remains in full on `/licensing`, which is still linked from every page.
- E2E smoke test rewritten to verify the disclaimer on `/licensing` and the footer link from every page, replacing the prior every-page-footer assertion.

## [0.2.1] - 2026-05-03

### Fixed
- `trustHost` now defaults to **on** unless `AUTH_TRUST_HOST` is explicitly set to `false`/`0`/`no`/`off`. The 0.2.0 opt-in semantic broke OAuth in any environment that didn't set the variable — including the CI E2E gate and the Cloudflare Pages deploy. This restores the 0.1.4 default behavior while preserving an opt-out path for deployments behind untrusted proxies.
- CI E2E pre-deploy gate (`landing page`, `licensing page`, `characteristics wizard`, etc.) now boots successfully without explicit `AUTH_TRUST_HOST` configuration.

### Changed
- 0.2.0's CHANGELOG entry under `### Migration` no longer applies — production deploys do **not** need to add `AUTH_TRUST_HOST=true` to the Cloudflare Pages environment. Add it only if you want to explicitly turn trustHost off via `AUTH_TRUST_HOST=false`.

## [0.2.0] - 2026-05-02

### Added
- Zod schemas for content-pack JSON (`src/lib/schemas/content-pack.schema.ts`) — index/skills/occupations/equipment now parsed at server boot rather than `as`-cast.
- Server-side game-rule validator (`src/lib/server/validation/investigator.ts`) — final saves (`isDraft: false`) must pass occupation skill-point budget, Credit Rating range, and engine-derived HP/MP/Sanity/Build/Move Rate upper bounds before persistence. Eligible-occupation set includes the player's chosen interpersonal/combat/science/any slot picks (skills marked `isOccupation: true` in the submission). Drafts skip these checks so the wizard can save partial state.
- Injectable RNG in `src/lib/engine/dice.ts` — exposes `Rng` type, `cryptoRng` default, and `sequenceRng` for deterministic tests; all dice helpers accept an optional `rng` parameter.
- OAuth account binding via the existing `accounts` table — new `findOrLinkOAuthAccount(db, ...)` looks up by `(provider, providerAccountId)` first, only merges into an existing user via email when the provider reports the email verified, and persists the account row for subsequent sign-ins.
- `+page.server.ts` for `/login` exposing `devLoginEnabled` so the dev credentials form only renders when the Credentials provider is actually registered.
- Test coverage: content-pack integrity, occupation-filter engine, investigator final-save validation (including chosen-slot eligibility and NaN-bypass guard), OAuth account-takeover prevention, deterministic dice via `sequenceRng`. Unit suite now 105 tests across 12 files.

### Changed
- `personalChoiceCount` is now present on every occupation in `static/content-packs/coc7e/occupations.json`. The 36 occupations that previously omitted the field default to `0` ("no any-skill picks"); these should be reconciled against the CoC 7e Investigator Handbook on the next content-pack pass.
- `cocCharacterDataSchema` now uses a strict `z.object` for `characteristics.values` / `baseValues` (all eight characteristics required) and a `characteristicId` enum for `formulaChoices` values, closing a NaN-bypass path through the budget validator.
- All user-controlled strings and arrays in `cocCharacterDataSchema` are now bounded (names ≤200, backstory fields ≤5000, skills array ≤200, equipment items ≤200, weapons ≤50, etc.) to prevent oversized JSON blob persistence.
- API routes `POST /api/investigators` and `PUT /api/investigators/:id` wrap `event.request.json()` in try/catch — malformed bodies return controlled 400 instead of unhandled 500.
- `trustHost` in `src/lib/server/auth.ts` is now opt-in via `AUTH_TRUST_HOST` (accepts `1`/`true`/`yes`/`on`, case-insensitive; still on automatically when `NODE_ENV=development`), removing the unconditional always-on behaviour behind untrusted proxies.
- Dev credentials provider is now opt-in via `AUTH_DEV_LOGIN` in addition to `NODE_ENV=development`, preventing accidental dev-login exposure if a deployment leaks `NODE_ENV=development`. The login page UI is gated on the same flag.
- `graphify-out/` (local analysis output with machine-specific paths) is gitignored.

### Security
- OAuth identity linking no longer merges by email alone. An attacker controlling a different provider's account that happens to share an email with an existing user can no longer be auto-linked unless the new provider reports `email_verified: true` (Google) / `verified: true` (Discord). Unverified-email signups are persisted with `email: null` to prevent UNIQUE-index-driven silent merges. Covered by an explicit takeover-prevention test.
- Server-side game-rule validator runs on every non-draft `POST`/`PUT /api/investigators`, rejecting payloads that overspend the occupation skill-point budget, exceed the credit-rating range, or claim derived stats above engine-computed upper bounds.

### Migration
- **Production deploy requires `AUTH_TRUST_HOST=true`** in the Cloudflare Pages environment. Previously the value was hard-coded; now it must be set explicitly or OAuth callbacks behind the Cloudflare proxy will fail. Existing local `.env` files already set this value; production env vars need to be reviewed before this version is deployed.
- Local dev workflows that relied on the implicit dev-credentials login should add `AUTH_DEV_LOGIN=true` to `.env`. The committed example file documents the new convention.

## [0.1.4] - 2026-05-01

### Added
- Footer now links to the GitHub repository and displays the app version from `package.json`.

## [0.1.3] - 2026-04-30

### Added
- Controlling design document at `.stitch/DESIGN.md` codifying the dual-era visual system (Classic 1920s and Modern 1980s, each with light/dark variants), all theme tokens verbatim from `src/lib/themes/*.css`, component patterns, screen surfaces, forward-looking state patterns, and Stitch prompt recipes for generating new screens that honour the existing visual language and Chaosium fan-content constraints.
- Atmospheric flourishes (Classic era): three irregularly-placed coffee ring stains rendered via `body { background-image }` in both Classic Dark and Classic Light, sized and tinted to read as old coffee on aged paper.
- Atmospheric flourishes (Classic era): low-frequency horizontal-biased paper-fiber overlay layered on `html::before` via a new `#paper-fiber` SVG `feTurbulence` filter, giving Classic themes a visible second-tier paper grain under the existing high-frequency `paper-noise` speckle.
- Atmospheric flourishes (Classic era): new `[data-typed]` attribute hook backed by a `--font-typed` CSS variable that resolves to `Special Elite` (Google Fonts) on Classic and to the body monospace on Modern, giving "values typed onto the paper form" a typewriter face only in Classic.
- Atmospheric flourishes (Modern era): CRT degauss flash (700ms) plays once when the user toggles era INTO Modern — blur, saturate, hue-rotate, and horizontal jitter that settle to clean.
- Atmospheric flourishes (Classic era): sepia fade-in (600ms) plays once when the user toggles era INTO Classic.
- Atmospheric flourishes (Modern Dark): rare ambient phosphor flicker on a 90-second cycle, briefly dimming `.app-frame` via `filter` for ~360ms.
- Atmospheric flourishes (eldritch): `triggerEldritchFlash()` API in `src/lib/stores/atmosphere.ts` applies a temporally-animated SVG displacement filter plus chromatic-aberration text-shadow to `.app-frame` for the configured duration. Reserved for narrative moments (Sanity loss, Mythos crits) — no automatic ambient firing.
- New `.app-frame` wrapper class on the layout body div so atmospheric `filter` effects target an inner container, leaving `DiceRollOverlay`'s `position: fixed` anchored to the viewport (filtered ancestors otherwise establish a containing block for fixed-position descendants).
- All animated atmospheric effects respect `prefers-reduced-motion: reduce` — era transitions become instantaneous, the phosphor flicker is suppressed, and the eldritch glitch becomes a no-op while static decorations (coffee stains, paper grain, scanlines) remain visible.
- Cinzel as a new Classic display face (`--font-display`), automatically applied to h1 and any element with `[data-display]` — engraved-Roman caps reads as a 1920s academic nameplate.
- EB Garamond as the Classic body face (`--font-body`), replacing Inter — period book typography for the highest-volume on-screen text. Inter remains in the Google Fonts request as a fallback.
- `body { line-height: 1.55 }` for both eras so the new serif body face and the existing Modern monospace both read with comfortable leading.

### Changed
- Coffee ring stains rewritten from soft `radial-gradient` blobs (which read as out-of-focus smudges) to real partial-circle SVG strokes inlined as a data URL on `body { background-image }`. Each ring is built from a thicker outer band + thinner darker inner band (the physical coffee-ring effect) with `stroke-dasharray` creating a single ~20% gap (the cup-tilt break) plus stray droplet ellipses.
- Classic Light paper texture made visibly present: `body::before` paper-noise switched from `mix-blend-mode: overlay` (a near no-op on flat-light surfaces) to `multiply`, opacity raised from 0.08 to 0.14, and the `html::before` paper-fiber overlay opacity raised from 0.04 to 0.09 — Light pages now read as printed paper rather than flat sepia.

## [0.1.2] - 2026-04-29

### Fixed
- Reduced-motion and animations-off dice roll fallback now displays the actual user-facing roll values (e.g. a 73 on a d100 shows as `73`, not `70 / 3`).
- Auth user identity is now a single stable database row id across providers; previously OAuth and dev-credentials sign-ins produced different id schemes that only stayed consistent through an email-fallback lookup.
- `ensureUser` and the dev credentials provider now survive concurrent first-sign-in races for the same email — backed by a real `users.email` unique index plus a re-read on insert conflict, so two parallel OAuth callbacks can no longer create duplicate user rows.
- `ensureUser` keeps an email-based fallback so users who already hold a JWT issued before the identity unification do not get logged out until their token rotates.
- Missing `AUTH_SECRET` in production now throws an explicit configuration error at request time instead of failing silently inside Auth.js.
- Dice toggle preference no longer writes to `localStorage` on every page boot, only when the user actually changes it.

### Changed
- Added a unique index on `users.email` (migration `0001_majestic_doctor_spectrum.sql`). Run `npx drizzle-kit push` (local SQLite) or apply the migration to your D1 database before deploying.

### Migration
- v0.1.0 anonymous investigators were stored under the literal user id `local-dev-user`. After upgrading, sign in with your account and reassign them with `node scripts/migrate-anonymous-investigators.mjs --email you@example.com` (local SQLite) or run the equivalent `UPDATE investigators SET user_id = ? WHERE user_id = 'local-dev-user'` against your D1 database.

## [0.1.1] - 2026-04-29

### Added
- App-wide 3D dice roll overlay for dice rolls in the investigator creation flow.
- Header dice animation toggle, enabled by default and persisted locally for users who prefer instant rolls.
- Reduced-motion and disabled-animation fallbacks that reveal roll results without waiting.
- Auth.js sign-in flow with Google, Discord, and local development credentials.
- Session-aware header controls with profile display, sign-in, and sign-out actions.
- Standard investigator age-adjustment engine with audit entries, EDU improvement checks, physical characteristic deductions, and youth Luck handling.
- Era-aware investigator creation for 1920s and Modern Day, including era selection, era-filtered equipment, and era-specific wealth tables.
- Optional standard characteristic generation method metadata for roll in place, arrange rolls, point buy, quick fire, low-roll modifier, and human-potential bonus support.
- Personal description backstory field across the wizard, character sheet, exports, and schema migration.
- Character schema v2 migration defaults that preserve existing saved cash and assets values.

### Changed
- Dice roll results now reveal after the visual roll settles when animations are enabled.
- Investigator dashboard, sheet, save, duplicate, archive, and export flows now require an authenticated user session.
- Characteristics step now captures era, mode, age, and generation method before occupation and skill allocation.
- Finances now distinguish living standard, daily spending level, cash, assets, and display labels.
- Skills allocation now requires explicit occupation choice-slot selections before occupation points can be spent on choice skills.
- Pulp mode is now clearly gated as unsupported until a complete Pulp rules implementation is added.
- Character sheet, review screen, Markdown export, JSON export, and PDF export now use corrected finance and backstory fields.

### Fixed
- Corrected Move Rate so equality with SIZ resolves to MOV 8 rather than MOV 9.
- Corrected 1920s and Modern Day wealth calculations from Credit Rating.
- Enforced occupation-point eligibility, Credit Rating ranges, overspending validation, and the standard Cthulhu Mythos personal-interest restriction.
- Recalculate derived stats and skill budgets from age-adjusted characteristics.

## [0.1.0] - 2026-04-15

First public release.

### Added
- Project scaffold: SvelteKit 5, TypeScript, Tailwind CSS v4
- App shell with header, navigation, and footer
- Chaosium Fan Material Policy disclaimer in footer (required on every page)
- Landing page with Lovecraftian typography (Cinzel, IM Fell English, Inter)
- Skip-to-content accessibility link
- Content pack: CoC 7e game data in JSON (57+ skills, 93 occupations, equipment, weapons)
- Content pack loader with singleton caching
- Engine layer: pure functions for characteristics, derived stats, skills, occupations, finances
- Unit tests: 60 tests covering all engine functions (dice, characteristics, derived stats, skills, finances)
- Wizard store with localStorage persistence and step tracking
- Wizard shell with step navigation and progress bar
- Characteristics step: roll methods (3D6×5 / 2D6+6×5) with reroll support
- Occupation step: searchable list with detail panel, formula choices, skill point calculation
- Derived stats auto-calculation: HP, MP, Sanity, Luck, Damage Bonus, Build, Move Rate
- 2D animated dice roller component
- Skills step: occupation vs personal interest point allocation with real-time budget tracking, category filters, search
- Backstory step: name, age, gender, pronouns, residence, birthplace fields; 10 backstory text areas with Lovecraftian placeholders; age modifier warnings
- Equipment step: weapons from reference list, common 1920s item picker, custom item entry, finances auto-calculated from Credit Rating
- Review step: full investigator sheet preview with characteristics, derived stats, skills, backstory, equipment; validation warnings; saves to database and redirects to character sheet
- Database schema with Drizzle ORM (Auth.js tables + investigators table)
- Database integration: SQLite via Drizzle ORM with auto-created local dev user
- REST API: CRUD endpoints for investigators (create, read, update, delete/archive, duplicate)
- Investigators dashboard: card grid with name, occupation, era; duplicate and archive actions
- Character sheet view: full investigator display with characteristics, derived stats, skills, backstory, equipment
- In-play mode: HP, MP, Sanity, Luck tracking with increment/decrement buttons, progress bars, and save to DB
- JSON export: complete character data with schema version, importable format
- Markdown export: Obsidian-optimized with YAML frontmatter, Dataview-compatible tags, characteristics table, skills, backstory, equipment
- PDF export: two-page investigator sheet via pdfmake (client-side generation), characteristics, derived stats, skills, backstory, equipment, Chaosium disclaimer
- Export buttons on character sheet (JSON, Markdown via API; PDF via client-side generation)
- Dual-era theme system: Classic (1920s newspaper/parchment) and Modern (1980s CRT terminal), each with light and dark modes (4 total themes: Classic Dark, Classic Light, Modern Dark, Modern Light)
- Modern Dark theme: green phosphor text on black background with CRT glow effects
- Modern Light theme: amber accents on light gray with sharp terminal aesthetic
- CRT atmospheric effects: scanlines overlay, screen vignette, phosphor text glow (Modern era)
- Paper grain texture overlay via SVG feTurbulence filter (Classic era)
- Era toggle (BookOpen/Monitor icons) and mode toggle (Sun/Moon) as separate header controls
- Modern era typography: IBM Plex Mono (body/headings) and VT323 (flavor text), loaded on demand
- Tailwind custom variants for era-specific styling: `classic:`, `modern:`, plus per-theme variants
- Theme toggle with localStorage persistence
- Skills: added Animal Handling (Uncommon), Diving (Uncommon), Computer Use (Modern)
- Skills: added 12 new specializations from Foundry VTT cross-reference — Demolitions, Read Lips, Fighting (Chainsaw/Flail/Spear), Firearms (Machine Gun/Submachine Gun), Science (Cryptography/Engineering), Survival (Alpine/Sea), Lore (Other)
- Occupations: added Computer Programmer/Technician/Hacker (Modern), Deprogrammer (Modern), White-collar Worker
- Occupations: added 8 new from Foundry VTT cross-reference — Carpenter, Chauffeur, Millwright, Miner, Stonemason, Photojournalist, Actor (Film Star), Actor (Stage and Radio)
- Occupations: added Journalist sub-variants — Investigative Journalist, Reporter (per Keeper Rulebook p.82)
- Docker deployment: Dockerfile (multi-stage) + docker-compose.yml with SQLite volume
- Cloudflare Pages deployment: adapter-cloudflare support via ADAPTER env var
- Health check endpoint: GET /api/health
- Licensing page with Chaosium Fan Material Policy details and GPL-3.0 info
- Accessibility: reduced motion support, keyboard-only focus rings, ARIA labels on navigation and theme toggle
- Mobile: responsive header (M.U.R. abbreviation on small screens), 44px touch targets, iOS zoom prevention on inputs
- Scrollbar styling matching theme colors
- Playwright config with E2E smoke tests (6 tests)
- `.env.example`, `.dockerignore`, `LICENSE` (GPL-3.0)
- Project `CLAUDE.md` with architecture and conventions

### Changed
- Theme system refactored from single-axis (2 themes) to dual-axis (era × mode, 4 themes)
- Theme store split into independent `era` and `mode` stores with derived `theme`
- Renamed Eldritch Dark → Classic Dark, Aged Parchment → Classic Light
- localStorage migration from old `theme` key to new `theme-era` / `theme-mode` keys
- Content pack: expanded occupation list from 27 to 93 occupations, matching the full Investigator Handbook
- Characteristics step: removed Quick-Fire Arrays method (Investigator Handbook only); roll-only now
- Occupation list: removed credit rating subheading from each occupation button for cleaner UI
- Updated all occupation suggested contacts text to match Investigator Handbook verbatim
- Occupations: renamed 6 entries to match PDF exactly (Journalist, Laborer, Cowboy/girl, Clergy Member of the, Waitress/Waiter, Mechanic and Skilled Trades)
- Occupations: merged split variants into single entries (Gangster, Sailor, Police Detective/Officer)
- Occupations: split all 13 combined entries into individual occupations (e.g., Butler/Valet/Maid → Butler, Valet, Maid; Soldier/Marine → Soldier, Marine; etc.)
- Occupations and skills lists sorted alphabetically
- Renamed Survival to Survival (Other) for consistency with other customizable specializations

### Fixed
- PDF export button stuck on "Exporting..." — pdfmake 0.3.x uses Promise-based API, not callbacks
- Skills step: replaced fragile onMount redirect with synchronous guard to fix "Allocate Skills" navigation
- Occupation step: made proceed() async to properly await goto navigation

### Removed
- Occupations: removed Reporter (alias of Journalist), Clerk/Executive, Middle/Senior Manager (replaced by White-collar Worker)

[Unreleased]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/releases/tag/v0.1.0
