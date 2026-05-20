---
phase: 02-security-and-cleanup
plan: "02"
subsystem: database
tags: [drizzle, postgresql, typescript, cleanup, schema]

requires:
  - phase: 02-01
    provides: Dead API routes deleted — DB table no longer referenced by any route

provides:
  - userPlaylists table removed from schema.ts and dropped from Neon DB
  - Dead Web Playback SDK type file deleted
  - Dead email scaffolding deleted
  - First Drizzle migration established in drizzle/
  - TypeScript compiles clean (zero errors)

affects: [03-playlist-ui, 04-ux-polish]

tech-stack:
  added: []
  patterns:
    - "Drizzle migrations in drizzle/ directory — generate with drizzle-kit generate, apply manually for existing DB"

key-files:
  created:
    - drizzle/0000_right_celestials.sql
    - drizzle/meta/_journal.json
    - drizzle/meta/0000_snapshot.json
  modified:
    - src/lib/server/db/schema.ts
  deleted:
    - src/lib/types/spotify-player.d.ts
    - src/lib/server/email.ts

key-decisions:
  - "Applied DROP TABLE directly via Node script (not drizzle-kit migrate) because DB had no migration journal and existing tables caused CREATE TABLE conflicts"
  - "Replaced generated CREATE TABLE migration SQL with DROP TABLE to accurately document what was applied"
  - "Removed boolean import from schema.ts (only used by deleted userPlaylists)"

patterns-established:
  - "Migration baseline: DB already existed without Drizzle journal — future migrations should use drizzle-kit generate/migrate normally now that 0000 is recorded"

requirements-completed:
  - SEC-04
  - SEC-05
  - SEC-06

duration: 3min
completed: 2026-05-21
---

# Phase 2 Plan 02: Dead Code + Schema Cleanup Summary

**Deleted Web Playback SDK types and email scaffolding, dropped `user_playlists` from Neon DB, TypeScript now compiles clean**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-21T01:40:38Z
- **Completed:** 2026-05-21T01:42:47Z
- **Tasks:** 2
- **Files modified:** 1 modified, 2 deleted, 3 created

## Accomplishments

- Deleted `src/lib/types/spotify-player.d.ts` (Web Playback SDK globals — app uses Connect API, not SDK)
- Deleted `src/lib/server/email.ts` (dead RESEND_API_KEY/EMAIL_FROM scaffold causing TS errors)
- Removed `userPlaylists` table block from `schema.ts` — only users, sessions, oauthAccounts, spotifyTokens, playedSongs remain
- Dropped `user_playlists` table from Neon DB — verified 5 active tables intact
- Established first Drizzle migration baseline in `drizzle/`
- `npx tsc --noEmit` exits 0

## Task Commits

1. **Task 1: Delete dead type file and email scaffolding** - `8795747` (fix)
2. **Task 2: Remove userPlaylists from schema, apply DROP TABLE migration** - `125ff5f` (fix)

## Files Created/Modified

- `src/lib/server/db/schema.ts` — removed userPlaylists block, removed boolean import
- `drizzle/0000_right_celestials.sql` — DROP TABLE user_playlists migration
- `drizzle/meta/_journal.json` — Drizzle migration journal (baseline)
- `drizzle/meta/0000_snapshot.json` — Drizzle schema snapshot
- `src/lib/types/spotify-player.d.ts` — DELETED
- `src/lib/server/email.ts` — DELETED

## Decisions Made

- Applied DROP TABLE directly via Node/postgres-js script rather than `drizzle-kit migrate` — the DB had existing tables (from manual setup) but no migration journal, causing `drizzle-kit migrate` to fail on `CREATE TABLE ... already exists`. Direct SQL drop was the correct approach for this one-time state reconciliation.
- Replaced generated migration SQL (CREATE TABLE statements for all active tables) with the actual DROP TABLE statement applied, so the migration file accurately reflects what changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drizzle migration approach adjusted for existing DB**
- **Found during:** Task 2 (Remove userPlaylists from schema and apply Drizzle migration)
- **Issue:** `drizzle-kit migrate` failed with `relation "oauth_accounts" already exists` — DB had tables but no migration journal. Generated migration was a CREATE TABLE baseline, not DROP TABLE.
- **Fix:** Applied DROP TABLE directly via Node script; replaced migration SQL with DROP TABLE statement; Drizzle journal now established for future incremental migrations.
- **Files modified:** drizzle/0000_right_celestials.sql
- **Verification:** DB shows 5 active tables, user_playlists absent; migration file contains correct DROP TABLE
- **Committed in:** 125ff5f

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in migration approach)
**Impact on plan:** Migration goal achieved (table dropped, schema clean). No scope creep.

## Issues Encountered

- `npx tsc --noEmit` initially failed with `Cannot read file '.svelte-kit/tsconfig.json'` — resolved by running `npx svelte-kit sync` first to generate the SvelteKit-managed tsconfig. Standard SvelteKit dev step.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Schema is clean: only active tables remain in schema.ts and DB
- TypeScript compiles clean — zero errors
- Drizzle migration baseline established — future schema changes can use normal `drizzle-kit generate/migrate` flow
- Phase 3 (playlist UI) can proceed without DB/TS blockers

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. This plan only deleted code and dropped a table.

---
*Phase: 02-security-and-cleanup*
*Completed: 2026-05-21*
