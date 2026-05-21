# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [To Do]
### Feedback from Reddit 
- I'd like an option to roll every stat one by one from the beginning, to emulate the table top, I can't read 24 dice at once.

- Click again during rolling to skip the dice animation, for when you want to just go fast.

- Age choice should probably be after characteristics, right before Age adjustments. That way it follow the order of the book and you don't have to go up and down when you are doing the age adjustments and decide to change the age.

- You should be able to input the EDU checks manually, for use flexibility.

- The way Age Adjustments are phrased right now make it seem like a bonus instead of a drawback.

- Right now EDU checks resets if you change the age at all. Ideally it stays the same until you cross a threshold, then it adds other check or removes the extra check, depending on the age, without resetting.

- Small bug: if you change the age to cross the a threshold (e.g. 39 to 40), the first EDU roll shows 3 dice instead of 2 (1 10s die, 2 units die).

- Depending on your Occupation, the "Occupation Skill Choices" + warnings take enough space that you can see the skill list while using the search and filters at all in a 1080p screen (though you can see some in a 4k screen). The search and filters do move with you, but a first time user will think that the search is not working for a minute.

- When the warnings change they move the skill list up or down, so if you were adjusting a number the button runs away from the cursor.

- Option to add custom weapons during creation/wizard

- The whole layout jumps around when you because of the "Rolling..." roll and the last roll just stays there forever.

- remove green faded circle when you roll.

- Make the dice roll faster.

- Edu improvement and luck rolls should roll automatically. There's no choice to be made there, they can be rolled simultaneously with the characteristic rolls.

- Disable scrolling affecting the up/down arrows.

- Maximum skill should not be 99.

- Add rolling for backstory entries.

- Add section for assets.

- Are you considering adding in random name (certainly), and possibly backstory generation?

- I like the dice rolling, and the over all look and functionality currently mind you.

- I signed in with Google saved and investigator, sign out and back in and it wasn't there anymore.

## [Unreleased]

## [0.19.0] - 2026-05-21

### Added
- **Admin dashboard at `/admin`.** Single-operator read-only view of all users and investigators with usage analytics: total counts, 30-day login/creation/PDF sparklines, Google vs Discord provider donut, and per-user pagination + search. Admin can also open any user's investigator sheet for support (writes still 404 — read-only). The sheet view hides JSON / Markdown / PDF / Edit / Play Mode / Share buttons when an admin is viewing another user's character, leaving only a Back link to `/admin/investigators`.
- **Lightweight analytics events.** New `analytics_events` table backs the dashboard. Login events are emitted from the Auth.js jwt callback (where the local users.id is known) with provider info; investigator creation pings on the POST handler; PDF exports fire-and-forget from `PDFExportButton` to a new `/api/events/pdf` endpoint that always returns 204. Analytics writes are best-effort and never block the user flow.

### Security
- Admin access is gated by an `ADMIN_EMAILS` env allowlist that is re-read on every request, so rotating the var kicks live sessions out immediately. A 15-minute step-up window enforces that the admin's JWT was issued recently — stale or unreadable tokens fail closed and are bounced to `/login?stepUp=1`. The cross-user sheet override on `/sheet/[id]` is gated by the same step-up check, so it can't bypass the freshness requirement that protects `/admin` itself. Every admin-elevated request appends a row to a new `admin_audit_log` table with the actor's email snapshotted (forensic history survives later user deletion via `ON DELETE SET NULL`). `X-Robots-Tag: noindex` + `Cache-Control: no-store` are applied at the hooks layer for all `/admin/*` responses so the headers also cover 403s and redirects. Stricter rate-limit buckets cap `/api/admin/*` at 30/min and `/api/events/pdf` at 5/min. Admin search inputs escape SQLite `LIKE` wildcards (`%`, `_`, `\`) before querying.

### Configuration
- New env vars: `ADMIN_EMAILS` (comma-separated allowlist; empty disables /admin entirely) and `ADMIN_STEP_UP_WINDOW_SECONDS` (default 900). See `.env.example`. In production set `ADMIN_EMAILS` as a Cloudflare Pages secret — never bake it into `wrangler.toml`.

### Migration
- Drizzle migration `0002_acoustic_anthem.sql` creates the `analytics_events` and `admin_audit_log` tables. Both use `ON DELETE SET NULL` on the user FK so historical events / audit rows survive account deletion. CI applies it to the remote `miskatonic-db` automatically on deploy.

## [0.18.1] - 2026-05-16

### Fixed
- Restored the sheet **Edit** button. After v0.18.0's Play Mode work, clicking Edit silently no-op'd because `cloneCharacter` ran `structuredClone` over the live overlay — which embeds Svelte 5 `$state` cells whose Proxy-wrapped arrays aren't cloneable in the browser. Seeding the edit buffer now goes through `$state.snapshot`, which unwraps the proxies into plain, cloneable JSON.

## [0.18.0] - 2026-05-16

### Added
- Play Mode now supports Keeper-style skill development marks, manual mark toggles, development phase rolls, the 2D6 SAN reward on first crossing 90%, SAN checks, SAN loss tools with daily one-fifth threshold tracking, manual insanity flags (Temporary / Indefinite / Bout of Madness as toggle buttons), and a tray-style free dice roller that writes to the Play Mode roll log.
- Skill lists in Play Mode, the wizard review step, and the read-only sheet now have sort controls (alphabetical / rating × ascending / descending) with per-surface localStorage persistence.
- Persistent last-roll banner in the In-Play Tracking card with a dismiss button; the banner stays visible until the next roll or until the user clears it.

### Changed
- Play-mode skill list defaults to rating descending instead of alphabetical ascending.
- Current Luck is now capped at 99 (rulebook cap) rather than at starting Luck. Starting Luck remains stored as provenance only.
- Development improvements append a dated `experience` allocation per roll rather than collapsing all dev gains into a single entry, preserving per-roll provenance.
- Free dice roller is now a tray: click polygonal die icons (d3 – d100) to add them, adjust a shared modifier with ±, then roll the whole tray with one button. Mixed-die rolls produce a single roll-log entry such as `2d6 + 1d20+2 · [3,5] + [14] = 24`.
- Read-only sheet skill grid now flows column-first (top-to-bottom in each column) so sorted order reads naturally.
- Era-aware corner radius across new components — Classic keeps the 4px soft radius, Modern renders sharp 0px terminal corners — plus thicker Classic ink stroke + drop shadow on dice silhouettes.
- Daily SAN threshold warning uses the project's left-bar callout pattern (DESIGN.md §7.3) instead of a flat tinted card.
- Manual SAN loss control replaced its native number spinner with the same ±/value compact widget the dice modifier uses.

### Fixed
- Saved skill totals can persist development increases above 100 (schema and server validation no longer reject them).
- The 2D6 SAN reward for crossing 90% via development is now awarded once per skill — a re-cross after a dip below 90 does not re-trigger the reward.
- Entering edit mode after Play Mode adjustments no longer overwrites those adjustments with the page-load snapshot. The edit form (and the PDF export) now start from the live in-memory state — current HP/MP/SAN/Luck, developed skill totals, marks, milestones, SAN tracking, play roll history.
- SAN loss formulas reject flat values above 100 and dice formulas whose maximum roll would exceed 100 (e.g. `0/2D100`, `0/20D6`) at parse time, instead of accepting them locally and silently failing on save.
- Daily SAN loss tracker (one-fifth indefinite-insanity threshold) now sums only positive losses since the day reset; SAN rewards no longer offset cumulative daily loss.
- The sheet surfaces persist failures as a transient banner so unsavable state is visible instead of leaving the "Save" pill silently stuck.
- Insanity-flag toggles no longer briefly flash the "Save" pill; persistence is silent on success and only marks the sheet dirty on failure.
- Allocation cap raised from 20 to 200 entries per skill so per-roll dev provenance does not start failing saves on long-running investigators.
- In-Play Tracking card no longer reflows height while a dice roll is in progress — the rolling indicator now reserves the same footprint as the resolved banner.
- Characteristics card spans full width in Play Mode (with 8-up stat strip on `lg` screens) instead of leaving a half-empty gap where the Derived Attributes block used to sit.

### Migration
- Character `schemaVersion` bumped from 5 → 6. `migrateCharacterData` adds the new Play Mode fields (`skillDevelopmentMarks`, `skillDevelopmentMilestones`, `playTracking` with `dailySanStart` / `dailySanResetAt` / `insanity`) on load with sensible defaults. Existing investigators upgrade transparently on first read.

## [0.17.2] - 2026-05-12

### Added
- Dedicated `/privacy` page documenting Google and Discord sign-in data handling (scopes, usage, sharing, storage, retention, deletion) for Google OAuth verification compliance. Also discloses the Google Fonts CDN as a sub-processor and clarifies that the in-app character-removal action is archive (with full deletion via email request).
- Footer link to the new Privacy page alongside the existing Licensing & Legal link.

## [0.17.1] - 2026-05-11

### Added
- Ko-fi support links now appear in the README badge row and the app footer.

## [0.17.0] - 2026-05-10

### Added
- **Dice rolls popover** from the header dice icon: **3D dice** vs **No dice** (skips the 3D overlay), plus surface pattern and face tint when 3D is on. **Save** / **Cancel** commit or discard changes so you stay on the same page. Preferences persist in `localStorage`. Static **`/assets/dice-three/`** assets from `@3d-dice/dice-box-threejs` are shipped under `static/`. Old URL `/settings/dice` redirects home. Playwright smoke covers the popover (`tests/e2e/smoke.spec.ts`); see `tests/manual/dice-appearance.md` if browsers are not installed locally.

### Changed
- **Dice look presets:** Face tints are now **Nautical ink**, **Parchment bone**, and **Arcade neon** (replacing the old purple jewel). Surface patterns are **Polished stone**, **Woodgrain**, and **Starfield** (replacing metal) so the three textures read more differently in motion; starfield uses the engine's non-metallic dice shading. Stored `metal` / `midnight` values migrate to **stars** / **neon**.
- **Surface pattern descriptions** in the popover are now terse one-liners (e.g. "Cool, marbled veins.") so the radio cards stay scannable.

### Fixed
- **Keyboard focus is now trapped in the dice settings dialog.** The popover declares `aria-modal="true"`, so focus now moves into the dialog on open, cycles between Save / Cancel / radios on Tab, and restores to the dice icon on close. Previously Tab leaked through to the page controls behind the backdrop.
- **Updated the dice-animation-toggle E2E** (`tests/e2e/dice-roll.spec.ts`) for the new popover flow now that the header dice button opens a dialog instead of toggling directly.

## [0.16.1] - 2026-05-10

### Changed
- **PDF skill list now reads alphabetically across categories.** The one-page investigator-sheet PDF previously sorted skills by category-then-name, which meant a player scanning for "Spot Hidden" mid-game had to know which category it lived in (mental? practical?) before they could find it. The skill table now sorts strictly by displayed name (case-insensitive), so columns read A→Z top-to-bottom, left-to-right regardless of category. Specialization blank fill-in slots still follow their resolved-name allocations within the alphabetical sequence.

## [0.16.0] - 2026-05-09

### Added
- **Skill search box in saved-investigator Play Mode.** The same alphabetical filter that already shipped in the wizard's "Try Play Mode" preview now lives on the saved-investigator sheet. Toggle Play Mode on, type into the search box next to the Skills heading, and the live skill list filters by display name (and `customName` for resolved "(Any)" specialisations) so a player can find a roll target quickly during play. The search resets when leaving Play Mode and is independent of the edit-mode add-skill picker search.
- **"(Any)" specialization resolver on the skills page.** When an occupation lists a customizable skill (e.g. Dilettante's "Art/Craft (Any)", "Firearms (Any)", "Language (Any)"), the skills page now opens with a dedicated **Specialization Choices** panel — alongside the existing Interpersonal / Combat / Science / Additional choice pickers — that requires the player to resolve each "(Any)" slot to either an existing specialization (e.g. for Firearms: Handgun, Rifle, Shotgun, Submachine Gun, Machine Gun) or a new homebrew specialization they name themselves ("Custom…" → type "Sculpture" → Add). The customizable placeholder skills no longer appear in the allocation table — points go straight to whichever specialization the player resolved to. Saved characters carry the resolutions as `OccupationData.customizableResolutions: Record<string, string>` so reopening the wizard restores the picks. Proceed is blocked until every slot is resolved, with a per-slot error list.
- **Explicit wizard reset & resume.** Visiting `/create/coc7e` now lands on a "Resume or Start Over" decision screen when an in-progress draft exists, showing the investigator's name and current step with two clearly-labelled buttons. A persistent **Start over** link in the wizard header (visible from every step) lets users discard a draft mid-flow with a confirmation dialog. Both behaviours are identical for anonymous and signed-in users.
- **Deep-link guard.** A direct visit to a wizard step URL with no active draft now starts a fresh wizard and lands on the first step, rather than rendering against an uninitialised state.
- **Quick Fire UI.** New segmented method panel with a value-pool chip strip and per-stat selects. The Quick Fire tab now opens with all eight stats blank — the pool chip strip shows every value still available, and each per-stat dropdown only lists pool values that are still available (plus the stat's own current pick, so it stays visible/changeable). Once 80 is assigned to one stat, 80 disappears from every other stat's dropdown; once both 60s are placed, 60 disappears from the rest. **Auto-assign** fills the canonical CoC 7e order (STR=40, CON=50, DEX=50, INT=50, POW=60, APP=60, SIZ=70, EDU=80) in one click; **Clear all** zeros every stat back to blank.
- **Point Buy UI.** Per-characteristic ±5 steppers (matching the play-mode stepper visual language), live `Spent / 460` budget, hard 15–90 clamping, soft "INT/SIZ rec ≥ 40" warnings, and a **Reset to defaults** action. Plus (+) buttons are tinted in the primary green; minus (−) buttons in destructive red, so direction is readable at a glance. The native browser number-input spinner arrows are hidden inside steppers to avoid duplicating the ± controls.
- **"Confirm Allocation" gate for Point Buy and Quick Fire.** Luck rolls, EDU improvement checks, and age modifiers are now deferred in both methods until the player explicitly clicks **Confirm Allocation** at the bottom of the panel. Previously every stepper click (Point Buy) or pool pick (Quick Fire) re-rolled Luck and EDU on the fly, which was disorienting while still rearranging values. The button is enabled only when the method's allocation is valid (Point Buy: 460-point budget satisfied and all values 15–90; Quick Fire: each pool value used exactly once); any subsequent change to the allocation invalidates the confirmation and hides the downstream age/Luck/derived-stats sections until the player re-confirms. The Roll method is unaffected — explicit dice rolls have always been a deliberate action.
- **Roll UI.** Third tab in the segmented method control. **Roll All** rolls all eight characteristics at once (3D6×5 / (2D6+6)×5 per the rulebook), **Roll Next** rolls one stat at a time in a fixed order, and a per-stat **Reroll** button lets the player re-roll any single value after the fact. **Clear** wipes all rolled values to start fresh.

### Changed
- **Wizard exposes Point Buy, Quick Fire, and Roll** for characteristic generation. Composite/optional methods (`arrange-rolls`, `low-roll-modifier`, `human-potential`) have been removed from the wizard UI; the underlying dice engine remains for in-play rolls (Luck, EDU improvement checks, skill rolls, weapon damage).

### Fixed
- **Save → sheet redirect actually lands on the sheet.** Previously, clicking **Save Investigator** in the Review step ran `wizard.completeStep` → `wizard.reset()` → `goto('/sheet/[id]')`, but the synchronous `wizard.reset()` flipped `$wizard.active` to false *before* the navigation completed, and the `WizardShell` deep-link guard (an `$effect` that watches "on a step route while not active" and self-corrects to `/characteristics`) immediately yanked the user back to the start of the wizard. The order is now navigate-first-then-reset: `await goto('/sheet/[id]')` so we leave the wizard layout entirely before `wizard.reset()` runs, with no guard mounted to react.
- **Start over now actually clears the current step's local state.** Clicking **Start over** while on the characteristics page would clear the wizard store but the page-local `$state` (Point Buy allocations, Quick Fire picks, rolled values) stuck around because navigating from `/characteristics` to `/characteristics` is a SvelteKit no-op and the +page.svelte component instance was never unmounted. The wizard state now carries a monotonic `nonce` that bumps on every `reset()` and `start()`, and `WizardShell` keys its step content on `currentPath + nonce` so the +page.svelte remounts and reinitialises from the freshly-blank store.
- **Customizable specialization labels now read "(Any)" instead of "(Other)"** in `static/content-packs/coc7e/skills.json` for all seven groups (Art/Craft, Fighting, Firearms, Language, Lore, Science, Survival), matching the rulebook's wording. "Art/Craft (Other)" → "Art/Craft (Any)", etc.
- **Method tab order now leads with Roll** (Roll → Point Buy → Quick Fire), the most common starting choice. New blank characters default to the Roll method so the leftmost tab is the active one on first open. The default values are zeroed and the player explicitly rolls.
- **Confirm Allocation button stays right-anchored.** Previously the footer used `flex flex-wrap items-center justify-between`, which let the button shift left when the status text shortened on validity. Now the footer uses a fixed `grid-cols-[1fr_auto]` so the button occupies a static right-aligned slot regardless of message length.
- **Point Buy value input now accepts free typing.** Clamping to `[POINT_BUY_MIN, POINT_BUY_MAX]` happened on every keystroke, so highlighting "50" and typing "8" snapped to 15 (the min) before the player could finish typing 80. The clamp now runs on `blur` only; live `oninput` only does the basic round/parse, letting the standard text-field workflow (highlight + type) work normally.
- **Quick Fire status copy.** "Use each pool value exactly once before confirming" was wrong — the pool itself contains duplicates (three 50s, two 60s). Updated to "Allocate each pool value before confirming."
- **Luck no longer auto-rerolls on allocation/age changes.** Previously every reconcile pass would re-roll Luck whenever the player tweaked an allocation that triggered a new EDU improvement check, even if Luck had already been rolled. Now Luck is rolled exactly once automatically (the first time the player reaches a settled state), and any subsequent change to Luck must come from the explicit **Reroll Luck** button. `resetAgeStateForCharacteristicChange()` no longer wipes the `luck` state, and `handleAgeChanged()` no longer transitions Luck on age boundaries; the youth-Luck-twice rule applies only at the moment Luck is first rolled.
- **Wizard-state v2 drafts are no longer silently deleted on upgrade.** The previous WIZARD_STATE_VERSION bump (2 → 3) caused `loadFromStorage()` to wipe any in-flight v2 draft on first load — exactly the data-loss path the new resume/start-over UX was meant to protect. Now `loadFromStorage()` runs `migrateWizardState()`, which promotes a v2 draft in place: the on-disk shape didn't actually change, only the supported method-id set, so the user's name, age, allocations, and current step are preserved. Only truly malformed JSON or unrecoverable shapes (no `character` field, unknown version older than v2) are discarded.
- **Legacy characteristic methods are no longer silently relabelled as `point-buy`.** Saved investigators created under `arrange-rolls`, `low-roll-modifier`, or `human-potential` previously had their method id rewritten to `point-buy` during JSON migration, while their original values, rolls, and derived stats stayed untouched — corrupting generation provenance. Now the method id is preserved verbatim (`StoredCharacteristicMethodId` widens the type union to include legacy ids), and the wizard resolves to a wizard-editable proxy via `editableCharacteristicMethod()` only when opening the wizard for editing — an explicit conversion path. Read views (sheet/PDF/JSON exports) display the original method label.
- **Re-entrancy hole in the allocation-confirmation flow.** Previously a player could click **Confirm Allocation**, change a value mid-animation, and have the in-flight Luck/EDU sequence write a stale Luck value back after `invalidateAllocationConfirmation()` had cleared it — the next confirm would short-circuit on `luck.max > 0` and accept the stale roll. Fixed by (a) a monotonic `reconcileGen` token that increments on every allocation/method/age change; `reconcileAutomaticRolls()` snapshots the token at entry and after each await and bails before writing if the gen has advanced; and (b) locking the +/- steppers, the input field, the Quick Fire selects, the Auto-assign / Reset / Clear / method-tab controls, and the age input while `autoRolling || diceRolling` is true.
- **Layout no longer silently wipes progress.** The previous `+layout.svelte:onMount` auto-`wizard.start()` (which replaced in-memory state and re-persisted, effectively destroying mid-wizard work on every revisit to `/create/coc7e`) has been removed. Routing is now handled by the new landing page and the deep-link guard inside `WizardShell.svelte`.
- **Play Mode "In-Play Tracking" panel — tighter, larger.** HP / MP / Sanity / Luck numerals bumped from `text-2xl` to `text-4xl` (with `leading-none`) so the at-a-glance values read at full strength across the table. Stepper buttons enlarged from 32 px to 36 px and progress bars from 6 px tall × 80 px max to 8 px tall × 140 px max so each tracker visually fills its column. Section padding reduced (`p-4` → `p-3`, `space-y-4` → `space-y-3`) and the empty roll-banner slot no longer reserves 64 px of vertical space when no banner is showing — eliminating the "four lonely widgets in a sea of beige" feel reported on wide screens.

## [0.15.1] - 2026-05-09

### Changed
- **Mobile UX overhaul (under 640 px).** Targeted fixes for issues exposed after the v0.15.0 typography refresh and 112.5 % root font-size bump.
  - **Skills wizard:** on mobile the 7-column allocation table is replaced with stacked cards (skill name + total on top, Base/Half/Fifth caption, Occupation/Personal number inputs below). Desktop table preserved at 640 px and up. Sticky budget block collapses to a single column with reduced padding. Category filter pills shrink to "All" + "Occupation" only on mobile (Occupation is the high-value filter for point allocation; the rest reappear at desktop widths).
  - **Header:** secondary controls (3D-dice toggle, era selector, theme-effects toggle, light/dark toggle) tuck into a single "settings" disclosure popover on mobile, leaving only logo / quick-create / avatar / sign-in-out / settings gear in the top bar. "Investigators" link hides on mobile since the avatar already navigates there. Era selector buttons bumped to a larger tap-target.
  - **Occupation wizard:** list height capped at `40vh` on mobile (was a fixed 500 px) so the preview panel is visible without scrolling past a tall list. Tapping an occupation now smooth-scrolls the preview into view, and the tapped item within the list, on mobile and tablet.
  - **ScrollHint button:** respects iOS safe area at the bottom of the viewport, and hides itself while the on-screen keyboard is open so it doesn't sit over a focused input.
  - **ShareDialog:** on mobile renders as a centered fixed card instead of a button-anchored popover — no more clipping past the right viewport edge.
  - **Characteristics wizard:** dice-result cell no longer wraps mid-roll (`5, 4, 5` stays on one line). Age-deduction inputs switch from a wrapping flex row to a 2-up grid on mobile and 4-up on desktop for cleaner placement.
  - **Alpha banner:** decorative tentacle ornaments hide on mobile so the warning text stays on a single line.
  - **Button sizing:** global mobile touch-target floor lowered from 44 px to 38 px (still above WCAG AA's 24 px minimum, closer to Material Design's 36 dp guidance) — the previous 44 px floor was inflating dense action rows like the draft banner with hollow vertical padding. Wizard navigation buttons trimmed in proportion.

## [0.15.0] - 2026-05-08

### Added
- **Floating "scroll down" affordance on long wizard steps.** A circular gold-bordered double-chevron button at the bottom-center of the viewport appears whenever a wizard step has more than ~80 px of content below the fold, and auto-hides as the user nears the bottom (so it disappears once the Next button is visible). Click smooth-scrolls 85 % of a viewport down. Self-managing via `ResizeObserver` + scroll listener; renders on no other route. Animation respects both `prefers-reduced-motion` and the existing "reduce theme effects" toggle.
- New `[data-dropcap]` attribute renders the first letter of an opted-in paragraph in Amarante (gold, floated, 4.25 rem) — for opening prose on home, licensing, and backstory display.
- New `DecoCorner.svelte` component (`src/lib/components/decoration/`) — small SVG bracket with a stepped ziggurat tick, four positions, `currentColor` for tinting. Available for opt-in card decoration.
- `--font-deco-alt` token (Amarante) added to the Classic theme stack.
- Design synthesis at `.stitch/ART_DECO_REFRESH.md` documents the new typography contract, decorative motifs, and per-surface application rules — supersedes §1.2 and §13 of `.stitch/DESIGN.md` for the Classic era.

### Changed
- **Classic era typography is now period-correct Art Deco (1925).** Cinzel / Playfair Display / EB Garamond / IM Fell English are replaced by **Limelight** (theatre-marquee display caps), **Federo** (heading), **Cormorant Garamond** (body), **Pompiere** (flavor script), and **Amarante** (drop-cap / pull-quote). `Special Elite` is unchanged. Modern era (CRT / phosphor monospace) is untouched. The new stack pushes away from Renaissance / Victorian-revival cues toward jazz-age investigator's casefile.
- **Classic era root font-size bumped to 112.5 %** (~18 px assuming the user default of 16 px), with body line-height bumped to 1.6, to compensate for Cormorant Garamond's smaller x-height. All rem-based Tailwind `text-*` classes scale proportionally; Modern era stays at 16 px / 1.55. Browser font-size accessibility settings still respected.
- **Heading underlines and `<hr>` ornament refreshed for Art Deco.** `h1` / `h2[data-heading]` now sit over a paired thin / thick gold double-rule (stacked linear-gradient hairlines). `<hr>` is now a stepped chevron lozenge — broken side rules flanking a centered rotated diamond — replacing the prior single-rule + ◆ glyph.
- **Container widths standardized.** `max-w-6xl` is gone. Header, footer, and alpha banner now cap at `max-w-5xl`. Login and the wizard layout drop to `max-w-4xl` (prose-tight). Data-dense pages (investigators list, sheet, share, draft) keep `max-w-5xl`.
- **`justify-between` page-header rows are now `gap-4` + `ml-auto`.** Header, footer, investigators page header, draft banner / footer rows, character-sheet header, and shared-sheet header no longer fling title and actions to opposite viewport edges on wide screens. Inner card-row label / value pairs (which legitimately want `justify-between`) are unchanged.
- **Wizard step indicator and skills grid use fluid gaps.** Wizard step gap is now `clamp(0.25rem, 1.5vw, 0.75rem)`. The read-only skills grid extends to `2xl:grid-cols-4` with `clamp(0.5rem, 2vw, 1.5rem)` column gaps so values don't drift on ultra-wide viewports.
- Characteristics grid on the read-only sheet now collapses to 2 columns on mobile (was a fixed 4-column grid that crowded narrow screens).
- **Skills wizard: "Occupation Skill Choices" moved above the sticky budget / filters block** and now defaults to expanded. The choices are a one-time setup decision and naturally belong before point allocation begins; placing them above the sticky block also gets them out of the way once the user starts allocating points.

## [0.14.1] - 2026-05-08

### Added
- Dice rolls can now be skipped by clicking/tapping the overlay or pressing Enter, Space, or Escape — keyboard-accessible via a focusable skip button covering the overlay.
- Characteristics can be rolled one at a time in tabletop order ("Roll Next: STR" → "Roll Next: CON" → …), with Luck and age-dependent EDU improvement checks rolling automatically once the prerequisite inputs are known.
- Equipment step adds inline custom weapons (editable name/damage/range/attacks) and an itemized assets list (name, value, type, description), both round-tripped through PDF, Markdown, JSON exports, and the read-only sheet.
- Content packs now have optional `names.json` and `backstory-tables.json` extension points. The backstory step exposes Random Name, per-field Roll, and "Fill all empty" controls when table data is present; ships empty by default for legal/content reasons.

### Changed
- Skills creation now caps ordinary skills at 90 (Cthulhu Mythos exempt). Post-creation sheet edits keep the play-mode 99 cap; the validator takes a `phase: 'creation' | 'play'` option.
- The skills step keeps budget/search/filter controls sticky while moving Occupation Skill Choices into a compact collapsible panel and reserving space for the warning area, so number-input buttons no longer move under the cursor.
- The age input moves below the characteristics table to match the rule book's order; characteristic rerolls and base-value edits no longer wipe age-derived state unconditionally — EDU checks and Luck are reconciled to the new bracket instead of reset.
- Dice animation is faster (settle ~1.0–1.3s on 1080p), the green radial roll glow has been removed, the dice surface is now mahogany with marble-textured cosmic dice, and the dice fade out cleanly on completion.
- Number inputs across the wizard and sheet no longer change value from mouse-wheel scrolling while focused.
- Play-mode roll banners reserve layout space and auto-clear after 3.5s to keep controls from jumping while rolling.
- PDF skill list uses bold for occupation skills and a Roboto-supported bullet for all rows, replacing geometric-circle glyphs that rendered as missing-glyph "tofu".
- PDF and Markdown exports now use the era-specific currency symbol consistently for cash, spending level, and asset values.

### Fixed
- OAuth re-entry now always resolves the local user id through the account-linking path, preventing investigator ownership from drifting to a provider/token id when signing out and back in with the same Google or Discord account.
- Wizard layout server-load now forwards `names` and `backstoryTables` to the page so advancing past occupation/skills no longer crashes the backstory step.
- Successful EDU improvement checks roll the d100 check and improvement d10 as clearly separate dice phases, fixing the "3 dice" visual confusion at age-bracket transitions.
- Finalizing an investigator now rejects blank-name custom weapon rows with a clear remove-or-name message instead of persisting empty rows.
- Skipping a dice roll while another is queued no longer flickers the overlay closed over the next roll — `runRoll` now bails on every async checkpoint when a newer roll has taken over.

### Migration
- Character data `schemaVersion` bumps 4 → 5. Existing characters auto-migrate with an empty `equipment.assetsList`. No data loss; migration is idempotent.

## [0.14.0] - 2026-05-08

### Added
- **PDF export from wizard review — no sign-in required.** The "Export PDF" button now appears on the Review step alongside "Save Investigator", generating a PDF from the in-progress character in localStorage without requiring authentication.
- **Era filter chips on occupation picker.** Era labels (1920s, Gaslight, Modern, etc.) now appear as clickable chips above the occupation list, letting players browse occupations across eras. The chip for the character's own era is pre-selected; switching eras deselects any occupation that isn't available in the new era.
- **Custom occupations.** A "Custom Occupation" entry at the bottom of the occupation list lets players enter a name, point budget, and optionally tag which content-pack skills belong to the occupation. Tagged skills are the only ones eligible for occupation points (like a normal occupation); leaving the tag list empty allows any skill. Custom occupation data is stored in the character, not the content pack.
- **Custom skills.** An "+ Add Custom Skill" button on the skills step lets players define homebrew or supplement skills (name + base value). An "Occupation Skill" toggle button marks the new skill as eligible for occupation points. Custom skills appear inline with a "custom" badge, can receive occupation and personal interest points like any other skill, and can be removed at will. Works for any occupation, not just custom ones.
- **Alphabetical skill ordering.** Skills are now sorted alphabetically on the Review page, Play Mode sheet, and Draft play mode — replacing the previous ad-hoc ordering.
- **Draft play mode — no sign-in required.** A "Try Play Mode" link on the Review step opens a full play-mode page (`/create/coc7e/draft`) sourcing data from localStorage. Includes stat trackers (HP/MP/Sanity/Luck with +/- controls), clickable characteristics and skills for percentile rolls, roll history, PDF export, and "Edit" links back to each wizard step. Stat changes and roll history persist back to the wizard state. Only "Save" and "Share" require signing in.

### Changed
- `SheetReadOnly` now resolves custom skill names from `character.customSkillDefs` via `resolveSkillDisplayName`.

### Technical
- `CoCCharacterData` gains a `customSkillDefs: CustomSkillDef[]` field (schema version bumped 3 → 4; migration adds `[]` for existing characters).
- `OccupationData` gains optional `customName`, `customSkillPoints`, and `customOccupationSkills` fields for custom occupations.
- `CustomSkillDef` gains optional `isOccupation` flag so the player's choice at add-time is the authoritative record; server validation uses this field rather than the allocation-level flag to prevent crafted payloads from bypassing occupation-point budgets.
- New engine utilities in `occupation-filter.ts`: `isCustomOccupation()`, `resolveSkillDisplayName()`.
- New wrapper `calculateOccupationPoints()` in `skills.ts` handles custom occupation point budgets alongside formula-based calculations.

## [0.13.0] - 2026-05-08

### Added
- **Play Mode now shows all skills.** Previously only skills with non-base allocations appeared in Play Mode; uninvested skills (e.g. Climb 20%) were invisible. Play Mode now displays every era-appropriate skill — allocated ones at their current value, unallocated ones at their base value. Unallocated specializations (Art/Craft, Other Language, etc.) are still omitted since they require a player-named specialty before there is a meaningful roll target. Applies to all eras: 1920s Classic, Gaslight, and Pulp.
- Read-only sheet view now shows a note beneath the skills list explaining that only non-base skills appear there, with a prompt to enter Play Mode to see and roll all skills.

### Changed
- Characteristics wizard era dropdown now shows only 1920s Classic and Gaslight — Modern is hidden until that era is supported.
- Characteristics wizard generation method dropdown now shows only Roll — other methods (Point Buy, Arrange Rolls, etc.) are hidden until they are fully supported.

## [0.12.0] - 2026-05-06

### Added
- **Public share links for finished investigators.** A new "Share" button on the sheet header opens a dialog with a toggle: enabling sharing mints a 16-char unguessable token, sets `isPublic = true`, and copies the public URL (`/s/<shareId>`) to the clipboard automatically (with a select-text fallback for browsers that block the Clipboard API). Anyone with the link can open it without signing in and see a read-only view of the sheet — no edit, no play mode, no rolls, no JSON/Markdown export. PDF export remains available on the public page since it is generated client-side from the same character data. Toggling sharing OFF rotates the token: the previous URL stops resolving immediately, and re-enabling generates a fresh URL. Drafts cannot be shared (server returns 409). The owner's primary investigator id is never exposed in the shared URL — only the token.
- New API endpoints `POST` and `DELETE` at `/api/investigators/[id]/share`, both owner-gated via `ensureUser` and ownership filter, returning JSON `{ shareId, shareUrl }` on enable and 204 on disable.
- New public route `/s/[shareId]/+page.server.ts` + `+page.svelte` that loads by `shareId` + `isPublic = true` + `isArchived = false` (defense in depth — soft-deleted investigators stop resolving on their old public URLs even if sharing was never explicitly disabled) without ever calling `ensureUser`. The load payload is `{ character, contentPack, occupations, skills }` only — no `userId`, no internal primary `id`. The page also emits `<meta name="robots" content="noindex, nofollow">` so unlisted links stay unlisted.
- New pure server module `src/lib/server/investigator/share.ts` with `enableInvestigatorShare`, `disableInvestigatorShare`, `loadSharedInvestigator`, and `SHARE_ID_LENGTH = 16`. The route handlers are thin wrappers; all behavior is unit-testable against an in-memory SQLite. 14 new tests cover token mint length, token rotation invalidating the old URL, draft refusal (409), non-owner refusal (404), idempotent disable, archived-row exclusion from public lookup, and verifying the shared payload never contains `userId`.
- New shared components under `src/lib/components/investigator/`:
  - `SheetReadOnly.svelte` — pure-display rendering of characteristics, derived attributes, skills, equipment, and backstory. Used by both the owner's sheet (default mode) and the public share page so a single source of truth drives the read view.
  - `PDFExportButton.svelte` — wraps `generatePDF` with `pdfExporting` / `pdfError` state and is reused by both routes.
  - `ShareDialog.svelte` — owner-only toggle UI with switch, URL display, Copy button (calls `navigator.clipboard.writeText`, falls back to selecting the readonly input after `tick()` so the input is mounted), and inline draft-blocked / error states.

### Changed
- `src/routes/sheet/[id]/+page.svelte` no longer inlines its default (non-edit, non-play) read markup; it delegates to `<SheetReadOnly />`. Each section (Characteristics & Derived, Skills, Equipment, Backstory) now renders inline only in edit or play modes; the shared component renders the same data the same way for the default branch and for the public share page.
- `src/routes/sheet/[id]/+page.server.ts` now also returns `shareId` and `isPublic` from the investigator row so the share dialog can render the current share state on first paint.

## [0.11.0] - 2026-05-06

### Added
- **Play-mode weapon damage rolls** on the investigator sheet. Each weapon row in Play Mode shows a "Roll damage" button per damage segment (shotgun-style multi-band weapons like `4D6/2D6/1D6` get one button per band). Clicking rolls the dice via the existing 3D dice overlay, substitutes `DB` from the investigator's derived damage bonus, supports flat modifiers (`1D10+2`), negative dice, and pushes the result into the play-roll history with a per-roll breakdown (e.g. `2D6: [4,3] → 7 · DB +1D4: [3] → 3 = 10`).
- New pure engine module `src/lib/engine/weapon-damage-roll.ts` with `splitDamageSegments`, `parseDamageBonusForRoll`, `planWeaponDamageRoll`, `getWeaponDamageDiceLimitError`, `getWeaponDamageSegmentValidationError`, `isWeaponDamageFormulaSupported`, and `describeWeaponDiceLimitViolations`. Strict dice caps prevent pathological formulas from allocating large arrays (`MAX_WEAPON_DAMAGE_DICE_PER_TOKEN = 24`, `MAX_WEAPON_DAMAGE_DICE_PER_SEGMENT = 48`). 16 unit tests cover segment splitting, DB parsing, dice-limit boundaries (per-token, per-segment, DB-substituted), unsupported die types, and label truncation.
- d3 added to `DICE_SIDES` in the dice protocol so weapons that roll d3 (e.g. brass knuckles) animate correctly in the 3D overlay.
- Server-side enforcement: `validateFinalInvestigator` now calls `describeWeaponDiceLimitViolations` so a malformed weapon damage string is rejected by the API save path with a per-weapon error message, not just by the client.
- `PlayRollHistoryWeaponDamageEntry` type and matching Zod schema. The existing `PlayRollHistoryEntry` is now a discriminated union (`PlayRollHistoryPercentileEntry | PlayRollHistoryWeaponDamageEntry`) so the play-mode roll log can mix d100 checks and weapon damage rolls. Old saved characters load unchanged — `playRollHistory` defaults to `[]` and the new arm is purely additive (no `schemaVersion` bump).

### Changed
- `parseDamageBonusForRoll` now returns `null` for unrecognised DB strings (e.g. compound `+1D4+2`) instead of silently dropping the term and returning `{ flat: 0, dice: [] }`. The 9 standard CoC DB values from `damageBonusBuildTable` are unaffected; this is a defensive contract change so future content packs or hand-edited derived stats fail loudly. Caller error messages updated to "Damage bonus is unrecognised or exceeds dice limits".

## [0.10.0] - 2026-05-06

### Added
- Investigator sheet edit mode: **searchable add-skill picker** (content-pack names, token search, first 15 matches). **Hide uncommon & restricted skills** checkbox (default on) filters out `uncommon` and `noPointAllocation` defs; unchecking reveals skills such as Demolitions and Cthulhu Mythos. Customizable specialization skills (Other Language, Art/Craft, etc.) require a label before the row is appended and may be added multiple times with different labels (e.g. two languages).
- Engine helpers in `src/lib/engine/investigator-sheet-skills.ts` for sheet visibility and add-picker filtering, with unit tests.

### Fixed
- Skills at pure base with no allocations now stay visible when added from sheet edit (and occupation rows unchanged), instead of disappearing from the Skills block.

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

[Unreleased]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.14.0...HEAD
[0.14.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.8.0...v0.9.0
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
