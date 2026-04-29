# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Standard investigator age-adjustment engine with audit entries, EDU improvement checks, physical characteristic deductions, and youth Luck handling.
- Era-aware investigator creation for 1920s and Modern Day, including era selection, era-filtered equipment, and era-specific wealth tables.
- Optional standard characteristic generation method metadata for roll in place, arrange rolls, point buy, quick fire, low-roll modifier, and human-potential bonus support.
- Personal description backstory field across the wizard, character sheet, exports, and schema migration.
- Character schema v2 migration defaults that preserve existing saved cash and assets values.

### Changed
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

[Unreleased]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar/releases/tag/v0.1.0
