# TODO — Miskatonic University Registrar

Issues identified during code review (2026-04-13) that are deferred past v1.

## v1.1 — Code Review Fixes

### High Priority

- [ ] **Age modifiers not applied to characteristics** — The backstory step displays age warnings but never actually deducts points from STR/CON/DEX/APP or runs EDU improvement checks. Needs an interactive sub-step where the user distributes the penalty across STR/CON/DEX. Derived stats (HP, Move Rate) must be recalculated after age is set.
- [ ] **Skills step reads stale wizard snapshot** — `const char = $wizard.character` captures once at mount. If the user navigates back from backstory and changes occupation, the skills step still uses the old occupation data. Replace with `$derived` or read from `$wizard` reactively.
- [ ] **Docker missing database migration step** — First run against a fresh SQLite file will fail because tables don't exist. Add `drizzle-kit push` or a programmatic migration to the Dockerfile entrypoint or app startup.

### Medium Priority

- [ ] **Wealth formula accuracy** — Current implementation scales cash/assets linearly by Credit Rating. Cross-reference against the Investigator Handbook's exact spending level table (p. 96) for fixed-tier values per bracket.
- [ ] **Add `character-migration.ts`** — Planned but not implemented. Needed when `schemaVersion` increments to handle stored characters with older schemas.
- [ ] **Add `character-sheet.ts`** — Planned engine function to compute a full read-only sheet from CharacterData + ContentPack. Currently this logic is scattered across page components.
- [ ] **Add occupation-filter tests** — Engine module `occupation-filter.ts` has no unit tests. Should test era filtering and skill list resolution.
- [ ] **Content loader uses `process.cwd()`** — Fragile in containerized deployments. Consider `import.meta.url` or a SvelteKit-native path resolution approach.

### Low Priority

- [ ] **Tighten `any` types in PDF export** — `pdf-export.ts` uses `type Content = any` and `const docDefinition: any` due to weak pdfmake typings. Expand the `pdfmake.d.ts` declaration.
- [ ] **Deduplicate investigators query** — The page server load (`investigators/+page.server.ts`) and API GET (`api/investigators/+server.ts`) run the same query. The page could use server load exclusively.

## v2 — Deferred Features

- [ ] Pulp Cthulhu support (archetypes, talents, doubled HP, luck recovery)
- [ ] Additional eras (Modern, Gaslight, Down Darker Trails, Regency)
- [ ] 3D dice roller (Three.js + cannon-es)
- [ ] Auth.js integration (Google + Discord OAuth, replace anonymous dev user)
- [ ] Portrait upload
- [ ] Character import from JSON
- [ ] Sanity loss roller integration with dice
- [ ] Keeper view / party management
- [ ] Share links (public character sheets)
