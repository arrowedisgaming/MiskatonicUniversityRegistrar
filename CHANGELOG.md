# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Project scaffold: SvelteKit 5, TypeScript, Tailwind CSS v4
- Lovecraftian theme system: Eldritch Dark (default) and Aged Parchment (light)
- App shell with header, navigation, and footer
- Chaosium Fan Material Policy disclaimer in footer (required on every page)
- Landing page with Lovecraftian typography (Cinzel, IM Fell English, Inter)
- Database schema with Drizzle ORM (Auth.js tables + investigators table)
- Theme toggle with localStorage persistence
- Skip-to-content accessibility link
- Project CLAUDE.md with architecture and conventions
- Content pack: CoC 7e game data in JSON (57 skills, 27 occupations, equipment, weapons)
- Engine layer: pure functions for characteristics, derived stats, skills, occupations, finances
- Unit tests: 60 tests covering all engine functions (dice, characteristics, derived stats, skills, finances)
- Wizard store with localStorage persistence and step tracking
- Wizard shell with step navigation and progress bar
- Characteristics step: roll (3D6×5/2D6+6×5) and quick-fire array methods with reroll support
- Occupation step: searchable list with detail panel, formula choices, skill point calculation
- Derived stats auto-calculation: HP, MP, Sanity, Luck, Damage Bonus, Build, Move Rate
- 2D animated dice roller component
- Content pack loader with singleton caching
- Skills step: occupation vs personal interest point allocation with real-time budget tracking, category filters, search
- Backstory step: name, age, gender, pronouns, residence, birthplace fields; 10 backstory text areas with Lovecraftian placeholders; age modifier warnings
- Equipment step: weapons from reference list, common 1920s item picker, custom item entry, finances auto-calculated from Credit Rating
- Review step: full investigator sheet preview with characteristics, derived stats, skills, backstory, equipment; validation warnings
- Database integration: SQLite via Drizzle ORM with auto-created local dev user
- REST API: CRUD endpoints for investigators (create, read, update, delete/archive, duplicate)
- Investigators dashboard: card grid with name, occupation, era; duplicate and archive actions
- Character sheet view: full investigator display with characteristics, derived stats, skills, backstory, equipment
- In-play mode: HP, MP, Sanity, Luck tracking with increment/decrement buttons, progress bars, and save to DB
- Review step now saves to database and redirects to character sheet
- JSON export: complete character data with schema version, importable format
- Markdown export: Obsidian-optimized with YAML frontmatter, Dataview-compatible tags, characteristics table, skills, backstory, equipment
- PDF export: two-page investigator sheet via pdfmake (client-side generation), characteristics, derived stats, skills, backstory, equipment, Chaosium disclaimer
- Export buttons on character sheet (JSON, Markdown via API; PDF via client-side generation)
- Docker deployment: Dockerfile (multi-stage) + docker-compose.yml with SQLite volume
- Cloudflare Pages deployment: adapter-cloudflare support via ADAPTER env var
- Health check endpoint: GET /api/health
- Licensing page with Chaosium Fan Material Policy details and GPL-3.0 info
- Accessibility: reduced motion support, keyboard-only focus rings, ARIA labels on navigation and theme toggle
- Mobile: responsive header (M.U.R. abbreviation on small screens), 44px touch targets, iOS zoom prevention on inputs
- Scrollbar styling matching theme colors
- Playwright config with E2E smoke tests (6 tests)
- .env.example, .dockerignore, LICENSE (GPL-3.0)
