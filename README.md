# Miskatonic University Registrar

A Call of Cthulhu 7th Edition investigator creator. Roll up a 1920s occult investigator or a 1980s computer hacker, allocate skills under auditable rules, and export the result as a PDF, JSON blob, or Obsidian-flavoured Markdown file.

[![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](./LICENSE)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00.svg)](https://kit.svelte.dev/)
[![Svelte 5](https://img.shields.io/badge/Svelte-5-FF3E00.svg)](https://svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](https://www.typescriptlang.org/)

> **Unofficial Fan Content.** Not approved or endorsed by Chaosium. Call of Cthulhu is a registered trademark of Chaosium Inc. See [Legal](#legal) below.

## About

The Registrar is a step-by-step wizard that walks you through the full CoC 7e investigator creation process — characteristics, occupation, skills, backstory, equipment — and produces a clean, printable character sheet. Every skill point allocation records its source (occupation vs. personal interest, or a specific named skill choice) so a keeper can audit any sheet and see *why* the investigator has the scores they do.

It is built content-pack first: the game rules live in JSON files under `static/content-packs/coc7e/`, not in the application code. Swapping in a house-ruled content pack or a new era supplement is a file-replace away.

## Features

- **Six-step wizard** — characteristics → occupation → skills → backstory → equipment → review, with localStorage auto-save between steps
- **93 occupations** matching the Investigator Handbook, with correct skill lists, credit rating ranges, and suggested contacts
- **60+ skills** including Modern-era additions (Computer Use, Demolitions, Cryptography, etc.) and Foundry-VTT-cross-referenced specializations
- **Dual-era theme system** — four themes across two eras:
  - *Classic 1920s* — newspaper (light) and eldritch (dark), with paper-grain SVG texture
  - *Modern 1980s* — CRT terminal aesthetic with green phosphor (dark) and amber-on-light (light), scanline overlays, and text glow
- **Auditable skill allocation** — every point records `source` and `sourceLabel`, so you can see at a glance whether a skill came from occupation, personal interest, or a "choose N from this list" bundle
- **Three export formats**
  - PDF (client-side via pdfmake) — two-page investigator sheet with disclaimer footer
  - JSON — round-trips losslessly for backup or re-import
  - Markdown — Obsidian-optimised with YAML frontmatter and Dataview-compatible tags
- **In-play tracker** — HP / MP / Sanity / Luck with increment and decrement controls, saved to the database
- **Saved investigators dashboard** — duplicate, archive, and open past characters
- **OAuth authentication** via Google and Discord (Auth.js)
- **Mobile-friendly** — responsive header, 44px touch targets, iOS zoom prevention on number inputs
- **Accessible** — skip-to-content link, reduced-motion support, keyboard-only focus rings, ARIA labels throughout

## Tech Stack

- [SvelteKit 2](https://kit.svelte.dev/) with [Svelte 5 runes](https://svelte.dev/docs/svelte/what-are-runes)
- [TypeScript](https://www.typescriptlang.org/) (strict mode)
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn-svelte](https://shadcn-svelte.com/) (bits-ui)
- [Drizzle ORM](https://orm.drizzle.team/) + SQLite (local) / [Cloudflare D1](https://developers.cloudflare.com/d1/) (production)
- [Auth.js](https://authjs.dev/) for Google + Discord OAuth
- [Zod](https://zod.dev/) for content-pack validation
- [pdfmake](http://pdfmake.org/) for client-side PDF export
- [Vitest](https://vitest.dev/) (unit) + [Playwright](https://playwright.dev/) (E2E)

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+ (or pnpm / yarn)

### Install & run

```bash
git clone https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar.git
cd MiskatonicUniversityRegistrar
npm install
cp .env.example .env            # fill in AUTH_SECRET and OAuth IDs if you want sign-in
npm run db:push                 # creates local.db with schema
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and start rolling.

### Environment variables

See [`.env.example`](.env.example). The app runs without OAuth configured — it uses an auto-created local dev user, so you can skip the `AUTH_*` variables for local development.

## Commands

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Start the SvelteKit dev server |
| `npm run build` | Production build (adapter chosen via `ADAPTER` env var: `auto`, `node`, or `cloudflare`) |
| `npm run preview` | Preview the production build locally |
| `npm run check` | TypeScript + Svelte type check |
| `npm run test` | Run Vitest unit tests (engine layer) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Run Playwright E2E smoke tests |
| `npm run db:push` | Apply Drizzle schema to `local.db` |
| `npm run db:generate` | Generate Drizzle migrations |

## Deployment

### Docker

```bash
docker compose up --build
```

The included [`Dockerfile`](Dockerfile) is multi-stage; [`docker-compose.yml`](docker-compose.yml) mounts a volume for the SQLite database.

### Cloudflare Pages / Workers

Set `ADAPTER=cloudflare` at build time and point Auth.js at a Cloudflare D1 database. The project already includes `@sveltejs/adapter-cloudflare`.

### Node / anywhere else

Set `ADAPTER=node` and deploy the `build/` directory behind any Node 20+ runtime. A `GET /api/health` endpoint is provided for uptime checks.

## Architecture

Three layers, strictly separated:

- **Content packs** (`static/content-packs/coc7e/`) — all CoC 7e rules data as JSON. No game rules are hardcoded in TypeScript.
- **Engine** (`src/lib/engine/`) — pure, stateless functions for dice rolls, characteristic generation, derived stats, skill allocation, finances, and occupation filtering. No UI imports, no DB imports. Unit-tested with Vitest.
- **App** (`src/routes/`) — SvelteKit pages, the wizard flow, and API routes. UI and persistence only; calls into the engine for any rules-relevant calculation.

Characters are stored as a single JSON blob per row in SQLite, with a `schemaVersion` field to support future migrations without breaking saved data.

## Contributing

Issues and pull requests welcome. Please check [`CHANGELOG.md`](./CHANGELOG.md) before opening a PR — the project uses [Keep a Changelog](https://keepachangelog.com/) format and [Semantic Versioning](https://semver.org/). Add your change under `[Unreleased]`.

When cutting a release, update `package.json` and `package-lock.json` to the same version as the new changelog entry. The site footer reads its displayed version from `package.json`.

## Legal

### Chaosium Fan Material Policy

This application operates under [Chaosium's Fan Material Policy](https://www.chaosium.com/fan-material-policy/).

> This is unofficial Fan Content and is not approved/endorsed by Chaosium. Call of Cthulhu is a registered trademark of Chaosium Inc. For more information about Chaosium Inc.'s products, please visit [www.chaosium.com](https://www.chaosium.com). The creator of this content is expressly prohibited from charging you to use or access this content. This content is not published, endorsed, or specifically approved by Chaosium Inc.

Specifically:

- This app is **free to use** and will never charge for access or features.
- No Chaosium logos, artwork, or trade dress are used.
- No verbatim rule text from Chaosium publications is reproduced.
- Game mechanics are implemented from public knowledge of the CoC 7e rules.
- No content authored by Ramsey Campbell or Brian Lumley is included (per the Fan Material Policy's named-author exclusions).

Call of Cthulhu is a tabletop role-playing game created by Sandy Petersen and published by [Chaosium Inc](https://www.chaosium.com). The game is based on the works of H.P. Lovecraft and the Cthulhu Mythos.

### Software License

The Miskatonic University Registrar source code is released under the [GNU General Public License v3.0 or later](./LICENSE).

## Credits

Built by **Arrowed**. With thanks to Chaosium for thirty-five years of CoC, and to H.P. Lovecraft for the nightmares.
