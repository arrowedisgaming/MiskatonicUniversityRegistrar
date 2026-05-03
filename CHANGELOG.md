# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/releases/tag/v0.1.0
