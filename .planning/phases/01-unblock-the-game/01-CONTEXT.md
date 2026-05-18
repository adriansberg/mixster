# Phase 1: Unblock the Game - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate `songs/random` from the deprecated Spotify `/tracks` endpoint to `/items`, implement a random offset strategy so all tracks in large HITSTER playlists are reachable, commit the pending SpotifyAuthError re-auth infrastructure, and update playlist metadata field references from `tracks.total` to `items.total` where needed.

**In scope:**
- `/playlists/{id}/tracks` → `/playlists/{id}/items` migration in `songs/random`
- Random offset strategy for playlists with >100 tracks
- Collapse 2-call pattern (items + tracks/{id}) into 1-call with `album(release_date,images)` in fields
- Fix URI parsing to use `parseSpotifyPlaylistId` instead of positional `.split(':')[2]`
- Update `playlist/validate` and `track-counts` field params: `tracks.total` → `items.total`
- Commit all pending AUTH-01 changes (SpotifyAuthError, deleteSpotifyTokens, reauth endpoint, spotify-player.d.ts)

**Out of scope:**
- alert() → inline error replacement (Phase 4, UI-01)
- Re-auth banner UX (Phase 4, UI-02)
- Dead code removal / DB cleanup (Phase 2)
- Token refresh singleton / race condition fix (v2, RES-03)

</domain>

<decisions>
## Implementation Decisions

### Random Offset Strategy (API-01)

- **D-01:** Use full 100-window approach. Random offset in `[0, total − 100]` (or `[0, 0]` for playlists with ≤100 tracks). Fetch 100 items from that offset. Filter nulls and played tracks from the window, pick a random unplayed track from what remains. If the window is exhausted (all played or null), retry with a new random offset.
- **D-02:** Use `parseSpotifyPlaylistId()` (already in `spotify.ts:182`) for all URI parsing — replace the positional `.split(':')[2]` at `songs/random` line 65.
- **D-03:** Include `album(release_date,images)` in the `/items` fields query. Filter out tracks without `album.release_date` at selection time (not after). This eliminates the separate `/tracks/{id}` call — 1 Spotify API call per attempt instead of 2.

### Fields Query Change (API-02)

- **D-04 (Claude's discretion):** `playlist/validate` uses `?fields=name,id,uri,tracks.total` — change to `?fields=id,name,uri,items.total` and update the TypeScript type and accessor. CLAUDE.md flags this as "live caller" meaning be surgical, not that it's frozen — the Spotify API broke this field for third-party playlists. Same fix for `track-counts` route: `?fields=tracks.total` → `?fields=items.total`.

### Auth Infrastructure (AUTH-01)

- **D-05 (Claude's discretion):** Commit the following as-is (they are complete): `src/lib/server/spotify.ts`, `src/routes/api/spotify/devices/+server.ts`, `src/routes/api/spotify/player/play/+server.ts`, `src/routes/api/auth/reauth/+server.ts`, `src/lib/types/spotify-player.d.ts`. The `play/+page.svelte` alert() calls for reauth stay — that's Phase 4 UX work.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, requirement IDs (API-01, API-02, AUTH-01)
- `.planning/REQUIREMENTS.md` — Full requirement definitions with acceptance criteria

### Primary Files to Modify
- `src/routes/api/spotify/songs/random/+server.ts` — Main migration target: endpoint, offset strategy, fields, URI parsing
- `src/routes/api/spotify/playlist/validate/+server.ts` — API-02: `tracks.total` → `items.total` (surgical change, live caller)
- `src/routes/api/spotify/playlists/track-counts/+server.ts` — API-02: same field change

### Auth Infrastructure (commit as-is)
- `src/lib/server/spotify.ts` — SpotifyAuthError, deleteSpotifyTokens, parseSpotifyPlaylistId — COMPLETE, commit only
- `src/routes/api/spotify/devices/+server.ts` — SpotifyAuthError catch — COMPLETE, commit only
- `src/routes/api/spotify/player/play/+server.ts` — SpotifyAuthError catch — COMPLETE, commit only
- `src/routes/api/auth/reauth/+server.ts` — New reauth endpoint — COMPLETE, commit only
- `src/lib/types/spotify-player.d.ts` — New type file — COMPLETE, commit only

### Supporting References
- `src/lib/config/playlists.ts` — Default HITSTER playlist URIs (these are the broken playlists)
- `src/lib/server/db/schema.ts` — `playedSongs` table (dedup source, read in `songs/random`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseSpotifyPlaylistId(input)` at `src/lib/server/spotify.ts:182` — handles Spotify URIs, open.spotify.com URLs, and bare IDs. Already imported in `playlist/validate` but NOT used in `songs/random` (uses `.split(':')[2]` instead — fix this).
- `spotifyFetch<T>(userId, endpoint, options)` — all Spotify calls go through this. Throws `SpotifyAuthError` on 401. Returns `null` on other errors.
- `SpotifyAuthError` class — already caught in `songs/random`, `devices`, `player/play`. Pattern: `catch (error) { if (error instanceof SpotifyAuthError) return json({..., requiresReauth: true}, {status: 401}); }`.

### Established Patterns
- Dedup: `playedSongs` table, 7-day window, loaded in-memory before retry loop. Dedup check: `!playedTrackIds.includes(item.track.id)`.
- Retry loop: `while (attempts < maxAttempts)` (max 10). Each iteration: pick random playlist, fetch tracks, filter played, pick track. With the new offset strategy, each iteration also picks a new random offset.
- TypeScript interface for Spotify responses is inline in each route file — no shared types file for API responses.

### Integration Points
- `play/+page.svelte` calls `POST /api/spotify/songs/random` with `{ sessionId, selectedDefaultPlaylists, customPlaylistUris }` — interface unchanged
- Setup page calls `POST /api/spotify/playlist/validate` — interface unchanged (only internal Spotify fields param changes)
- `play/+page.svelte` still has `alert()` for reauth at lines 50, 109, 150 — leave these for Phase 4

### Known Issues in Modified Files
- `songs/random` line 65: `.split(':')[2]` — positional split, breaks on URL format. Fix: use `parseSpotifyPlaylistId`.
- `songs/random` line 70: `/playlists/${playlistId}/tracks?limit=100` — deprecated endpoint, no random offset.
- `songs/random` line 100: Separate `/tracks/${randomTrack.id}` call — eliminated by including `album(release_date,images)` in the `/items` fields.
- `playlist/validate` line 37: `?fields=name,id,uri,tracks.total` → `?fields=id,name,uri,items.total`.
- `track-counts` line 28: `{ tracks: { total: number } }` type and `?fields=tracks.total` → `items.total`.

</code_context>

<specifics>
## Specific Ideas

- The `/items` endpoint fields query should be: `items(track(id,name,artists,album(release_date,images))),total` — this gets name, artists, release year, and album art in one call (album art used on the flip card front).
- Random offset formula: `Math.floor(Math.random() * Math.max(1, total - 100))` — gives a valid start position even when total is exactly 100.

</specifics>

<deferred>
## Deferred Ideas

- Token refresh singleton (concurrent refresh race) → v2, RES-03
- `alert()` → inline error states → Phase 4, UI-01
- Re-auth inline banner → Phase 4, UI-02
- Rate limit (429) handling → Phase 4, API-04

</deferred>

---

*Phase: 1-Unblock-the-Game*
*Context gathered: 2026-05-19*
