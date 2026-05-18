# Research Summary — Shitster

**Synthesized:** 2026-05-18
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md, CONCERNS.md

---

## Executive Summary

Shitster has a working core and a clear path to polish. The server-side Spotify proxy architecture is correct and must not change. Playlist state in localStorage is the right call for single-device party use. The flip card, play/pause, device selector, and dedup logic are all solid.

**One critical blocker breaks the game today:** Spotify's February 2026 API changes are live. The current `songs/random` endpoint fetches tracks from the 6 default HITSTER playlists using the deprecated `/tracks` endpoint and `.tracks.items` field access. Those playlists are third-party owned, so the new access restriction makes track listing impossible — the game loop is broken for all default playlists. Fix this first.

Beyond the blocker, work splits into: (1) dead code cleanup to close security holes, (2) UX polish to complete custom playlist UI and replace `alert()` calls. No redesign needed — targeted fixes and feature completion.

---

## Critical Blockers (broken today)

### BLOCKER: Spotify API migration — track fetching broken for default playlists

**Impact:** Game cannot fetch songs from any of the 6 default HITSTER playlists.

**Root cause — two concurrent breaking changes:**
1. Endpoint renamed: `/playlists/{id}/tracks` → `/playlists/{id}/items`
2. Access restriction: track listing only returned for playlists the **authenticated user owns**. HITSTER playlists are third-party owned → `items` field absent from response.

**Files affected:**
- `src/routes/api/spotify/songs/random/+server.ts` — fetches `/tracks`, reads `.tracks.items`
- `src/routes/api/spotify/playlists/track-counts/+server.ts` — same endpoint pattern
- `src/lib/server/spotify.ts` — endpoint paths passed through; callers must update

**Fix required:**
- Migrate all `/tracks` → `/items` in URL paths; `.tracks.items` → `.items?.items` in response parsing
- For `songs/random`: cannot fetch full track listing from third-party playlists. Strategy: fetch `items.total` metadata-only (`?fields=id,items.total`), pick random `offset`, fetch single track at `GET /playlists/{id}/items?limit=1&offset={random}`
- Field rename: `items.total` not `tracks.total` for track count

**Do first. Nothing else matters until the game loop works.**

---

## Recommended Stack Decisions

| Decision | Recommendation | Confidence |
|----------|---------------|------------|
| Spotify playlist metadata fetch | `GET /playlists/{id}?fields=id,name,items.total,snapshot_id` | HIGH |
| localStorage validation | Zod `safeParse` at read-time with `version` guard; fallback to defaults on mismatch | HIGH |
| localStorage schema | Single `shitster_playlists` key: `{ version: 1, playlists: StoredPlaylist[] }` | HIGH |
| `StoredPlaylist` shape | `{ id, uri, name, trackCount, enabled, addedAt, isDefault }` | HIGH |
| Svelte 5 localStorage | Raw `$state` + `browser` guard in `.svelte.ts` module — no library | HIGH |
| PWA manifest | `display: "fullscreen"`, `orientation: "landscape"`, `display_override` fallback chain | HIGH |
| Playlist add mutation | `fetch` to `+server.ts` returning `{ name, trackCount }` — not form action | HIGH |
| History clear mutation | Form action with `use:enhance` — no response data needed | HIGH |

---

## Key Features — Prioritized

### Must fix first
1. **Spotify API migration** — `/tracks` → `/items`, random offset strategy for third-party playlists

### Table stakes (incomplete today)
2. **Custom playlist add UI** — paste URL/URI → resolve name + track count → localStorage with `isDefault: false`
3. **Playlist toggle UI** — `enabled` flag on `StoredPlaylist`; `songs/random` filters `enabled: true`
4. **Replace all `alert()` calls** — 3 in `play/+page.svelte` (lines 50, 109, 150); use existing `errorMessage` `$state`
5. **Custom playlist track count in setup** — parity with default playlists

### Differentiators
6. **Songs-played counter** — increment in `getNextSong`, display in header; hosts pace sessions with it
7. **Confirm before clearing history** — inline `showConfirm` state replaces `window.confirm()`
8. **Graceful re-auth UX** — inline banner instead of `alert()` + hard redirect

### Anti-features (do not build)
Per-player scoring, player phone controllers, countdown timers, decade/era filters, dark/light theme toggle, email auth, multiple simultaneous sessions.

---

## Architecture Decisions

### Keep unchanged
- Server-side Spotify proxy — tokens never reach browser
- `SpotifyAuthError` throw pattern — clean propagation
- localStorage as source of truth for playlist selection
- `playedSongs` in DB for dedup

### Dead code cleanup order (before UX work)

Constraint: delete routes before dropping DB table — schema import breaks TypeScript otherwise.

1. Verify no callers: `grep -r "api/spotify/playlists\|api/spotify/playlist/add\|api/spotify/playlist/toggle\|api/spotify/token\|SpotifyPlayerService\|spotify-player" src/`
2. Delete dead routes:
   - `src/routes/api/spotify/token/+server.ts` — exposes raw Spotify token to browser [HIGH security]
   - `src/routes/api/spotify/playlists/+server.ts` — IDOR: no `userId` filter on DELETE
   - `src/routes/api/spotify/playlist/add/+server.ts` — writes dead table
   - `src/routes/api/spotify/playlist/toggle/+server.ts` — IDOR: no `userId` filter on PATCH
   - `src/routes/api/spotify/player/start/+server.ts` — duplicate of `/play`, missing `SpotifyAuthError`
3. Delete dead services: `spotify-player.ts`, `spotify-player.d.ts`, `email.ts`
4. Remove `userPlaylists` from `schema.ts`
5. Generate + run migration: `DROP TABLE IF EXISTS user_playlists`
6. `npx tsc --noEmit` — verify clean compile

**Do NOT delete** `src/routes/api/spotify/playlist/validate/+server.ts` — live caller in `setup/+page.svelte`.

### localStorage consolidation

Current 5 keys → 2 keys:
```
shitster_playlists      → { version: 1, playlists: StoredPlaylist[] }
shitster_session_id     → string (unchanged)
```

`enabled` field: coerce `p.enabled ?? true` at read time — no version bump needed.

---

## Pitfalls to Avoid

### Critical

**URI parsing produces `undefined` playlist ID**
- `split(':')[2]` returns `undefined` for URL-format strings → silent 10-attempt failure
- Fix: `parseSpotifyPlaylistId` (already in `spotify.ts`) at top of POST handler; reject 400 on `null`

**429 burns all retry attempts**
- `spotifyFetch` treats 429 as generic null → all 10 retries fire instantly → 6s latency then dead error
- Fix: detect 429, read `Retry-After`, throw `SpotifyRateLimitError`

**Non-atomic token refresh → mid-game logout**
- Two concurrent requests near expiry both refresh → second overwrites consumed refresh token → 401
- Short-term: widen expiry buffer from 60s to 5 min

**`isPlaying` desyncs from Spotify state**
- Optimistic state not reconciled → pause sent to already-stopped track
- Fix: re-fetch devices on any play failure

### Moderate

**localStorage parse throws**: add `safeLocalJSON(key, fallback)` helper; wrap all reads

**Stale device list → "Playback failed"**: re-fetch devices on play 404

**Private playlist 403 exhausts all attempts**: skip URI after first failure per URI

---

## Roadmap Implications

**Phase 1 — Unblock the game (Spotify API migration)**
Game is broken today; nothing else ships until this works.
Features: migrate `/tracks` → `/items`, random offset strategy for third-party playlists, update all field access.

**Phase 2 — Security + dead code cleanup**
Security holes should not coexist with new feature work.
Deliverable: token endpoint removed, IDOR routes gone, `userPlaylists` table dropped, clean compile.

**Phase 3 — Custom playlist UX + localStorage consolidation**
Core differentiator from physical Hitster; completes the setup page.
Features: consolidated schema with Zod validation, add/toggle/remove custom playlists, `songs/random` filters by `enabled`.

**Phase 4 — Play page polish + resilience**
Eliminates all `alert()` calls and silent failures.
Features: inline error states, songs-played counter, 429 handling, URI validation, token refresh buffer widened.

---

*Synthesis: 2026-05-18*
