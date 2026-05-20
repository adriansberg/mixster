---
phase: 02-security-and-cleanup
plan: 01
subsystem: api
tags: [spotify, security, idor, token, routes]

requires:
  - phase: 01-unblock-the-game
    provides: SpotifyAuthError pattern, spotifyFetch wrapper, active route set

provides:
  - Token endpoint deleted — raw Spotify access token no longer reachable via HTTP
  - IDOR-vulnerable playlist DELETE and PATCH routes removed
  - Dead playlist write routes removed
  - Duplicate player/start route removed

affects: [03-ux-polish, 04-polish-and-launch]

tech-stack:
  added: []
  patterns:
    - "Dead route deletion via git rm — intentional, staged immediately for clean commit history"

key-files:
  created: []
  modified: []

key-decisions:
  - "Delete routes rather than patch — all five are dead or dangerous with no active callers; removal is safer than fixing"
  - "email.ts TS errors (RESEND_API_KEY, EMAIL_FROM) treated as pre-existing noise — not introduced by deletions, addressed in plan 02"

patterns-established:
  - "Security surface reduction by deletion — if no caller, delete rather than maintain"

requirements-completed:
  - SEC-01
  - SEC-02
  - SEC-03

duration: 4min
completed: 2026-05-21
---

# Phase 2 Plan 01: Dead Route Deletion Summary

**Deleted five dead or dangerous Spotify API routes: raw token endpoint (SEC-01), two IDOR-vulnerable playlist routes (SEC-02), one dead playlist write route, and a duplicate player start route (SEC-03)**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-21T23:34:00Z
- **Completed:** 2026-05-20T23:38:17Z
- **Tasks:** 1
- **Files modified:** 5 deleted

## Accomplishments

- `token/+server.ts` deleted — browser can no longer exfiltrate raw Spotify access token via HTTP (T-02-01)
- `playlists/+server.ts` and `playlist/toggle/+server.ts` deleted — IDOR vulnerabilities (userId not checked on DELETE/PATCH) eliminated (T-02-02, T-02-03)
- `playlist/add/+server.ts` deleted — writes to dead `userPlaylists` table eliminated (T-02-04)
- `player/start/+server.ts` deleted — duplicate PUT route removed for hygiene (T-02-05)
- Active routes (`track-counts`, `validate`, `player/play`) confirmed present and untouched

## Task Commits

1. **Task 1: Delete dead and dangerous route files** - `2b18f49` (fix)

**Plan metadata:** (pending final docs commit)

## Files Created/Modified

- `src/routes/api/spotify/token/+server.ts` — DELETED (raw token endpoint, SEC-01)
- `src/routes/api/spotify/player/start/+server.ts` — DELETED (duplicate route, SEC-03)
- `src/routes/api/spotify/playlists/+server.ts` — DELETED (IDOR DELETE, SEC-02)
- `src/routes/api/spotify/playlist/add/+server.ts` — DELETED (dead table write)
- `src/routes/api/spotify/playlist/toggle/+server.ts` — DELETED (IDOR PATCH, SEC-02)

## Decisions Made

- Delete rather than patch: all five files had no active callers; deletion eliminates surface entirely rather than leaving patched-but-unused code
- Pre-existing `email.ts` TS errors (`RESEND_API_KEY`, `EMAIL_FROM`) confirmed present on base commit — not introduced by deletions, tracked for plan 02

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Worktree has no `.svelte-kit/tsconfig.json` (no `vite build` run) causing two TS errors unrelated to deletions — confirmed identical on base commit, not introduced by this plan

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02 (email scaffolding removal + DB migration) can proceed — no dependency on deleted routes
- `email.ts` TS errors addressed in plan 02
- Active game loop routes untouched and operational

---
*Phase: 02-security-and-cleanup*
*Completed: 2026-05-21*
