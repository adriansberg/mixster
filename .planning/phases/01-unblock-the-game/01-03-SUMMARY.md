---
phase: 01-unblock-the-game
plan: "03"
subsystem: auth
tags: [spotify, oauth, session, error-handling]

requires: []
provides:
  - SpotifyAuthError class exported from spotify.ts — thrown on 401 or missing token
  - deleteSpotifyTokens(userId) — removes DB tokens to force re-auth
  - parseSpotifyPlaylistId(input) — parses Spotify URI/URL/bare-ID formats
  - spotifyFetch throws SpotifyAuthError instead of returning null on auth failure
  - devices and player/play routes catch SpotifyAuthError → { requiresReauth: true } 401
  - POST /api/auth/reauth — clears sessions + Spotify tokens + cookie
  - Spotify Web Playback SDK type declarations (Window.Spotify, Spotify namespace, SpotifyPlayer/SpotifyPlayerState/SpotifyTrack)
affects: [play-page, game-loop, any future Spotify API route]

tech-stack:
  added: []
  patterns:
    - "SpotifyAuthError propagates from spotifyFetch to route boundary — catch and return { requiresReauth: true, status: 401 }"
    - "Reauth endpoint invalidates all sessions + tokens atomically before clearing cookie"

key-files:
  created:
    - src/routes/api/auth/reauth/+server.ts
    - src/lib/types/spotify-player.d.ts
  modified:
    - src/lib/server/spotify.ts
    - src/routes/api/spotify/devices/+server.ts
    - src/routes/api/spotify/player/play/+server.ts

key-decisions:
  - "SpotifyAuthError thrown (not returned null) so auth failures propagate through async call stacks to the route boundary"
  - "Reauth clears all sessions (not just current) to prevent stale session confusion after token expiry"
  - "Files committed by parallel agent 01-01/01-02 in commit 3d670f7 — no duplicate commit needed"

requirements-completed: [AUTH-01]

duration: 5min
completed: 2026-05-21
---

# Phase 1 Plan 03: AUTH-01 SpotifyAuthError Infrastructure Summary

**SpotifyAuthError class + reauth endpoint enabling expired-token recovery without page reload**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-21T00:00:00Z
- **Completed:** 2026-05-21T00:05:00Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- All 5 AUTH-01 files verified present and correct in working tree
- Files already committed by parallel agent (API-01/02 plan) in commit `3d670f7`
- SpotifyAuthError propagation pattern active across devices and player/play routes
- POST /api/auth/reauth live — guards unauthenticated callers, clears all user sessions + tokens
- Spotify Web Playback SDK fully typed via spotify-player.d.ts

## Task Commits

1. **Task 1: Verify AUTH-01 files and commit** - `3d670f7` (feat — committed by parallel agent 01-01/02)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `src/lib/server/spotify.ts` — SpotifyAuthError class, deleteSpotifyTokens, parseSpotifyPlaylistId, spotifyFetch throws on 401
- `src/routes/api/spotify/devices/+server.ts` — SpotifyAuthError catch → { requiresReauth: true } 401
- `src/routes/api/spotify/player/play/+server.ts` — SpotifyAuthError catch → { requiresReauth: true } 401
- `src/routes/api/auth/reauth/+server.ts` — POST handler: guards auth, invalidates sessions + tokens + cookie
- `src/lib/types/spotify-player.d.ts` — Window.Spotify, Spotify namespace, SpotifyPlayer/SpotifyPlayerState/SpotifyTrack interfaces

## Decisions Made

- SpotifyAuthError thrown (not null returned) so failures propagate through async stacks to route boundary
- Reauth invalidates ALL user sessions, not just current — prevents stale session confusion after token expiry
- Files were already committed by the parallel API-01/02 agent — no duplicate commit created

## Deviations from Plan

### Auto-handled: Files already committed by parallel agent

Files were staged and committed as part of commit `3d670f7` by the parallel API-01/02 executor that ran simultaneously. Verification confirmed all 5 files present in HEAD with correct content. No additional commit needed — creating a duplicate commit would be incorrect.

**Total deviations:** 0 rule-triggered / 1 situational (parallel agent committed first)
**Impact:** No impact — all AUTH-01 artifacts verified in git history.

## Issues Encountered

Pre-existing TypeScript errors in `src/lib/server/email.ts` (RESEND_API_KEY and EMAIL_FROM missing from env type). Unrelated to AUTH-01 files. Deferred — out of scope for this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SpotifyAuthError infrastructure complete — play page can detect and handle token expiry
- Reauth endpoint ready — clients can call POST /api/auth/reauth to clear state and redirect to login
- Remaining in-flight: token endpoint, play page, songs/random (handled by parallel agents)

---
*Phase: 01-unblock-the-game*
*Completed: 2026-05-21*
