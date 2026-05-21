# Roadmap: Shitster

## Overview

Shitster is a Spotify-powered party jukebox game. The game loop is broken today due to a Spotify API change — fix that first, then clean up security debt, then complete the custom playlist UX, then polish the play page. Four phases, sequential, all v1 requirements covered.

## Phases

- [x] **Phase 1: Unblock the Game** - Migrate Spotify API + commit pending re-auth changes so the game loop works
- [x] **Phase 2: Security & Cleanup** - Remove dead/dangerous code and DB table so the codebase is clean before UX work (completed 2026-05-20)
- [ ] **Phase 3: Custom Playlist UX + Session** - Complete playlist add/toggle/remove UI and session history management
- [ ] **Phase 4: Play Page Polish** - Inline errors, resilience improvements, TV-friendly layout

## Phase Details

### Phase 1: Unblock the Game
**Goal**: The game loop works — songs play from default HITSTER playlists, and token re-auth is committed and functional
**Depends on**: Nothing (first phase)
**Requirements**: API-01, API-02, AUTH-01
**Success Criteria** (what must be TRUE):
  1. Clicking "NESTE SANG" plays a song from a default HITSTER playlist without error
  2. Playlist metadata (name, track count) resolves correctly from a Spotify URL or URI
  3. When Spotify tokens expire, the app detects it and handles re-auth via the committed SpotifyAuthError flow
**Plans**: 3 plans, 1 wave

**Wave 1** *(all plans independent — execute in parallel)*
- [x] 01-01-PLAN.md — Migrate songs/random to /items endpoint with random offset and 403 detection (API-01)
- [x] 01-02-PLAN.md — Fix tracks.total → items.total in validate and track-counts routes (API-02)
- [x] 01-03-PLAN.md — Commit AUTH-01 re-auth infrastructure (SpotifyAuthError, reauth endpoint) (AUTH-01)

### Phase 2: Security & Cleanup
**Goal**: Dead and dangerous code is gone — no raw token endpoint, no IDOR-vulnerable routes, no dead DB table, clean TypeScript compile
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06
**Success Criteria** (what must be TRUE):
  1. `GET /api/spotify/token` returns 404 — raw Spotify token no longer reachable from browser
  2. `DELETE /playlists`, `/playlist/add`, `/playlist/toggle` routes no longer exist
  3. `SpotifyPlayerService`, `email.ts`, and dead type files are gone from the codebase
  4. `npx tsc --noEmit` passes with no errors after `user_playlists` table is dropped
**Plans**: 2 plans, 2 waves

**Wave 1** *(route deletion — no dependencies)*
- [x] 02-01-PLAN.md — Delete dangerous/dead route files (SEC-01, SEC-02, SEC-03)

**Wave 2** *(depends on Wave 1)*
- [x] 02-02-PLAN.md — Delete dead code files + drop userPlaylists DB table (SEC-04, SEC-05, SEC-06)

### Phase 3: Custom Playlist UX + Session
**Goal**: Users can manage their own playlists and control session history — the core differentiator from physical Hitster is complete
**Depends on**: Phase 2
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06, SESS-01, SESS-02, SESS-03, SESS-04
**Success Criteria** (what must be TRUE):
  1. User can paste a Spotify playlist URL or URI, see the resolved name and track count, and have it saved across page reloads
  2. User can toggle any playlist (default or custom) on/off; only enabled playlists are used when fetching the next song
  3. User can remove a custom playlist they added
  4. User can clear play history; the counter resets and playlist selections are fully preserved
  5. History clear prompts inline confirmation — no `window.confirm()` dialog
**Plans**: 2 plans, 2 waves
**UI hint**: yes

**Wave 1** *(schema module + setup page rewrite)*
- [ ] 03-01-PLAN.md — Create consolidated playlist-state schema with migration + rebuild setup page toggles/persistence (PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05)

**Wave 2** *(depends on Wave 1 — play page consumes schema, setup page gains clear button)*
- [ ] 03-02-PLAN.md — Play page enabled-only filter, songs-played counter, double-press clear on both pages (PLAY-06, SESS-01, SESS-02, SESS-03, SESS-04)

### Phase 4: Play Page Polish
**Goal**: The play page is party-ready — no browser dialogs, inline error handling, URI validation on add, resilience to rate limits and expiring tokens, and a TV-readable layout
**Depends on**: Phase 3
**Requirements**: API-03, API-04, PLAY-07, UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. No `alert()` or `window.confirm()` calls remain — all errors shown inline in the UI
  2. Re-auth prompt appears as an inline banner; user initiates redirect manually
  3. Pasting an invalid Spotify URI shows an immediate validation error (no silent 10-attempt failure)
  4. Spotify 429 rate limit responses show an informative inline message instead of silently looping
  5. Play page text and card are readable from across a room on a TV or large monitor
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Unblock the Game | 3/3 | Complete | 2026-05-21 |
| 2. Security & Cleanup | 2/2 | Complete   | 2026-05-20 |
| 3. Custom Playlist UX + Session | 0/2 | Not started | - |
| 4. Play Page Polish | 0/TBD | Not started | - |
