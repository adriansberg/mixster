---
phase: 01-unblock-the-game
plan: 02
subsystem: api
tags: [spotify, playlist, typescript]

requires: []
provides:
  - "POST /api/spotify/playlist/validate returns trackCount from items.total"
  - "POST /api/spotify/playlists/track-counts returns track counts from items.total"
  - "track-counts uses parseSpotifyPlaylistId for robust URI parsing"
affects: [setup-page, playlist-management]

tech-stack:
  added: []
  patterns:
    - "Spotify playlist metadata accessed via items.total (not tracks.total) post-Feb-2026 API change"
    - "parseSpotifyPlaylistId used for all URI → ID extraction (no positional .split(':').pop())"

key-files:
  created: []
  modified:
    - src/routes/api/spotify/playlist/validate/+server.ts
    - src/routes/api/spotify/playlists/track-counts/+server.ts

key-decisions:
  - "items.total replaces tracks.total for playlists the user does not own (Spotify Feb 2026 API change)"
  - "parseSpotifyPlaylistId preferred over uri.split(':').pop() — handles both URI and URL inputs"

patterns-established:
  - "spotifyFetch<{ items: { total: number } }> with ?fields=items.total for playlist track count queries"

requirements-completed: [API-02]

duration: 5min
completed: 2026-05-21
---

# Phase 1 Plan 02: Playlist Metadata Field Migration Summary

**Migrated both playlist metadata routes from deprecated tracks.total to items.total, and hardened URI parsing in track-counts with parseSpotifyPlaylistId**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-21T00:00:00Z
- **Completed:** 2026-05-21T00:05:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `validate` endpoint: 3 surgical changes — type, fields param, accessor all use `items.total`
- `track-counts` endpoint: 5 changes — import, URI parsing, type, fields param, accessor
- `track-counts` now uses `parseSpotifyPlaylistId` instead of fragile `.split(':').pop()`
- TypeScript compiles (pre-existing `email.ts` env errors unrelated to this plan)

## Task Commits

1. **Task 1: Fix validate endpoint** - `3d670f7` (fix)
2. **Task 2: Fix track-counts endpoint** - `52e9fca` (fix)

**Plan metadata:** (committed below)

## Files Created/Modified
- `src/routes/api/spotify/playlist/validate/+server.ts` — `tracks` → `items` in type, fields, accessor
- `src/routes/api/spotify/playlists/track-counts/+server.ts` — same + parseSpotifyPlaylistId import + URI parsing

## Decisions Made
- Used exact field order `id,name,uri,items.total` in validate (matches API-02 decision D-04)
- Kept existing null guard `if (!playlistId) return;` in track-counts — still valid with parseSpotifyPlaylistId

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Task 1 commit swept in sibling plan files that were already staged (parallel agent environment without worktree isolation). All files belong to valid plan work. validate change is correct within the commit.
- Plan verification command `grep -c 'items\.total'` expects >= 2 but gets 1 per file — regex doesn't match `items?.total` accessor (optional chaining). Actual changes are correct; verification command has a false-negative for optional-chained accessors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both playlist metadata routes now return correct track counts for playlists the user does not own
- Setup page validate caller unblocked
- Ready for plan 03 (random song / items endpoint migration)

---
*Phase: 01-unblock-the-game*
*Completed: 2026-05-21*
