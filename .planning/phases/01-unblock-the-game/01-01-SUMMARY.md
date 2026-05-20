---
phase: 01-unblock-the-game
plan: 01
subsystem: api
tags: [spotify, svelte-kit, typescript]

requires: []
provides:
  - POST /api/spotify/songs/random migrated from deprecated /tracks to /items endpoint
  - 403 detection returns actionable playlistInaccessible error immediately
  - Random offset strategy covering all tracks in large playlists
  - Release year + album art extracted inline from /items (no separate /tracks call)
  - parseSpotifyPlaylistId used for all URI parsing
affects: [play-page, phase-2, phase-3]

tech-stack:
  added: []
  patterns:
    - "Raw fetch + getSpotifyAccessToken for status-inspectable Spotify calls (vs spotifyFetch which swallows non-401 errors)"
    - "Two-call total-then-window pattern: cheap limit=1 call for total, then full window at random offset"

key-files:
  created: []
  modified:
    - src/routes/api/spotify/songs/random/+server.ts

key-decisions:
  - "Use raw fetch instead of spotifyFetch so 403 can be detected and returned as playlistInaccessible — spotifyFetch returns null for all non-2xx, making 403 indistinguishable from other failures"
  - "Random offset = Math.floor(Math.random() * Math.max(1, total - 100)) — ensures all tracks reachable, capped to avoid tiny windows at end of playlist"
  - "Album data embedded in /items fields query — eliminates separate /tracks/{id} call per song"

patterns-established:
  - "Raw fetch with Authorization Bearer header used when HTTP status discrimination is required"
  - "parseSpotifyPlaylistId() used for all URI/URL/ID parsing — handles all three formats"

requirements-completed: [API-01]

duration: 8min
completed: 2026-05-21
---

# Phase 1 Plan 01: songs/random API-01 Migration Summary

**Spotify /playlists/{id}/items migration with random offset strategy, inline 403 detection, and album data collapse eliminating the separate /tracks call**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-21T00:00:00Z
- **Completed:** 2026-05-21T00:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Migrated `/playlists/{id}/tracks` → `/playlists/{id}/items` (deprecated endpoint gone)
- Added 403 detection: inaccessible playlists return `{ error: 'playlistInaccessible' }` immediately, no 10-attempt silent retry storm
- Collapsed 2-call pattern (playlist tracks + track details) into 1: album fields embedded in /items query
- Random offset strategy ensures all tracks in large playlists are reachable, not just first 100
- Replaced `.split(':')[2]` URI parsing with `parseSpotifyPlaylistId()` handling all input formats
- Tracks without `release_date` silently skipped (filter, not attempt increment)

## Task Commits

1. **Task 1: Rewrite songs/random with /items endpoint, random offset, and 403 detection** - `29a1890` (fix)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `src/routes/api/spotify/songs/random/+server.ts` — Rewritten: /items endpoint, raw fetch for status inspection, random offset strategy, inline 403 detection, album fields embedded

## Decisions Made

- Raw fetch instead of `spotifyFetch` — `spotifyFetch` absorbs all non-401 errors as null, making 403 invisible. Raw fetch lets us distinguish 403 (inaccessible) from other failures.
- Two-call approach (total first, then window) — cheap: first call uses `limit=1&fields=total` to get count, second fetches 100 items at the computed offset.
- `Math.max(1, total - 100)` offset cap — prevents offset landing beyond the last full 100-track window at playlist end.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `src/lib/server/email.ts` (missing `RESEND_API_KEY`/`EMAIL_FROM` env keys) — unrelated to this task, out of scope, not touched.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Core game loop unblocked: songs/random now works for owned/copied playlists
- HITSTER (third-party) playlists surface actionable error to UI
- Play page (`src/routes/play/+page.svelte`) reads `error.error` for `playlistInaccessible` — UI handling is downstream work
- Phase 1 remaining plans: other API fixes (devices, player, token endpoints)

---
*Phase: 01-unblock-the-game*
*Completed: 2026-05-21*
