# Phase 1: Unblock the Game - Research

**Researched:** 2026-05-21
**Domain:** Spotify Web API playlist items migration, SvelteKit server routes, auth error propagation
**Confidence:** HIGH (API behavior verified via official docs + community; codebase read directly)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Random offset: `Math.floor(Math.random() * Math.max(1, total - 100))`. Fetch 100 items from that offset. Filter nulls and played tracks. Pick random unplayed. Retry with new offset if window exhausted. Max 10 attempts.
- **D-02:** Use `parseSpotifyPlaylistId()` (at `spotify.ts:182`) for all URI parsing — replace `.split(':')[2]` at `songs/random` line 65.
- **D-03:** Include `album(release_date,images)` in `/items` fields query. Filter out tracks without `album.release_date` at selection time. Eliminates separate `/tracks/{id}` call.
- **D-04:** `playlist/validate`: `?fields=name,id,uri,tracks.total` → `?fields=id,name,uri,items.total`. Update TypeScript type and accessor. Same fix for `track-counts`.
- **D-05:** Commit as-is (complete): `src/lib/server/spotify.ts`, `src/routes/api/spotify/devices/+server.ts`, `src/routes/api/spotify/player/play/+server.ts`, `src/routes/api/auth/reauth/+server.ts`, `src/lib/types/spotify-player.d.ts`.

### Claude's Discretion
- D-04 and D-05 are listed as "Claude's Discretion" in CONTEXT.md.

### Deferred Ideas (OUT OF SCOPE)
- Token refresh singleton (concurrent refresh race) → v2, RES-03
- `alert()` → inline error states → Phase 4, UI-01
- Re-auth inline banner → Phase 4, UI-02
- Rate limit (429) handling → Phase 4, API-04
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | Random song selection works for default HITSTER playlists (third-party owned) using `/items` endpoint with random offset strategy | CRITICAL: `/items` returns 403 for third-party playlists. HITSTER playlists are owned by HITSTER, not the user. See Critical Blocker section. |
| API-02 | Playlist metadata (name, track count) resolves from Spotify URL/URI using `?fields=id,name,items.total` | CRITICAL: `items.total` is also restricted to owned/collaborative playlists. `tracks.total` (on `GET /playlists/{id}` not `/items`) may be the correct field. Needs clarification. |
| AUTH-01 | Uncommitted re-auth changes committed (SpotifyAuthError, deleteSpotifyTokens, reauth endpoint, spotify-player.d.ts) | All files are complete and verified in working tree. Commit-only work. |
</phase_requirements>

---

## Summary

Phase 1's goal is to unblock the game loop by migrating from the deprecated Spotify `/playlists/{id}/tracks` endpoint to `/playlists/{id}/items`. The migration itself (endpoint rename, fields query, random offset strategy, URI parsing fix) is straightforward and fully specified in CONTEXT.md.

**Critical finding:** The Spotify February 2026 API change does more than rename the endpoint. `GET /playlists/{id}/items` returns HTTP **403 Forbidden** for playlists the authenticated user does not own or collaborate on. The six default HITSTER playlists in `src/lib/config/playlists.ts` are owned by the HITSTER company — users merely follow them. This means the `/items` endpoint migration alone does NOT unblock the game for default playlists. [VERIFIED: developer.spotify.com/documentation/web-api/reference/get-playlists-items]

**Secondary finding on API-02:** The `items.total` field (from `GET /playlists/{id}`) is also only available for owned/collaborative playlists. The `validate` and `track-counts` routes may need to use `tracks(total)` as a field on `GET /playlists/{id}` (the legacy `tracks` object on the metadata endpoint — distinct from the deprecated `/tracks` sub-endpoint). This needs verification by testing against the actual HITSTER playlist IDs.

**AUTH-01 is clean:** All five AUTH-01 files are complete in the working tree. Confirmed by reading each file. Commit only.

**Primary recommendation:** Before planning `songs/random` implementation, the planner MUST flag the third-party playlist 403 issue as a blocking decision for the user. If the game is for personal use with the user's own Spotify account, the workaround is to have the user copy HITSTER playlists to their own Spotify library — then the API works. Alternatively, the app could detect 403 and surface a "Copy this playlist to your library" message.

---

## Critical Blocker: Third-Party Playlist Access (API-01)

### What the Feb 2026 Spotify API Change Actually Does

The change has TWO parts — the CONTEXT.md session captured only Part 1:

**Part 1 (captured):** Endpoint renamed `/playlists/{id}/tracks` → `/playlists/{id}/items`. Response field `tracks` → `items`, nested `tracks.total` → `items.total`.

**Part 2 (NOT captured in CONTEXT.md):** `GET /playlists/{id}/items` is now restricted to playlists the authenticated user **owns or is a collaborator of**. Third-party public playlists return `403 Forbidden` with no items. [VERIFIED: developer.spotify.com/documentation/web-api/reference/get-playlists-items]

Official docs quote: *"This endpoint is only accessible for playlists owned by the current user or playlists the user is a collaborator of. A 403 Forbidden status code will be returned if the user is neither the owner nor a collaborator of the playlist."*

### HITSTER Playlist Ownership

All six playlists in `src/lib/config/playlists.ts` are owned by the HITSTER company (e.g., `spotify:playlist:0aPlDZsvBsCBBvrWym09Lf`). Users follow these playlists but are not owners or collaborators. Any call to `/playlists/{id}/items` against these URIs returns 403. [VERIFIED: developer.spotify.com/documentation/web-api/reference/get-playlists-items]

### What the API Returns for Third-Party Playlists (GET /playlists/{id})

The metadata-only endpoint (`GET /playlists/{id}`) still returns:
- `name`, `id`, `uri`, `description`, `images`, `owner`, `public`
- The `tracks` object on the metadata response (distinct from the deprecated sub-endpoint) — includes `total` count. [CITED: developer.spotify.com/documentation/web-api/reference/get-playlist]
- The `items` object is absent or null.

**Key distinction:** The `tracks.total` field on `GET /playlists/{id}?fields=tracks(total)` (metadata endpoint) may still work for third-party playlists even though the `/items` sub-resource does not. This is because `tracks` on the metadata endpoint is a legacy embedded summary, not the full items resource. **This needs testing — it is [ASSUMED].**

### Workaround Options (for planner to present to user)

1. **User copies playlists** — User goes to Spotify, copies each HITSTER playlist to their own library. App works as-is after migration. Zero code change beyond the migration.
2. **Detect 403, surface copy instructions** — `songs/random` catches 403 from `/items` (distinct from 401 auth error) and returns a specific error message directing the user to copy the playlist. Requires a new error state.
3. **Remove hardcoded HITSTER playlists** — App becomes custom-playlist-only. HITSTER playlists are dropped from config. This is a product decision.

Option 1 is the path of least resistance for a personal-use app.

**The planner must surface this to the user as a decision gate before coding songs/random.**

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spotify API calls | API / Backend (server route) | — | Tokens never in browser — CLAUDE.md requirement |
| Random offset math | API / Backend (server route) | — | Lives in songs/random POST handler |
| URI parsing | API / Backend (shared lib) | — | `parseSpotifyPlaylistId` in spotify.ts |
| Playlist 403 detection | API / Backend (server route) | Frontend (error display) | songs/random returns specific error; play page shows it |
| Auth error propagation | API / Backend (server route) | Frontend (alert/redirect) | SpotifyAuthError → 401 + requiresReauth flag |
| Session invalidation | API / Backend (/api/auth/reauth) | — | Clears sessions + Spotify tokens |

---

## Standard Stack

No new packages needed. All work is TypeScript changes within existing SvelteKit server routes.

### Existing Libraries in Use

| Library | Purpose | Location |
|---------|---------|----------|
| `@sveltejs/kit` | Server routes, `json()` response helper | All route files |
| `drizzle-orm` | `playedSongs` query for dedup | songs/random |
| `$lib/server/spotify` | `spotifyFetch`, `SpotifyAuthError`, `parseSpotifyPlaylistId` | songs/random, validate, track-counts |
| `$lib/config/playlists` | Default HITSTER URIs | songs/random |

**Installation:** No new packages. No package legitimacy audit required.

---

## Package Legitimacy Audit

Not applicable — phase installs no external packages.

---

## Architecture Patterns

### System Architecture: songs/random Request Flow

```
POST /api/spotify/songs/random
  │
  ├── Auth check (locals.user)
  ├── Parse request body (sessionId, selectedDefaultPlaylists, customPlaylistUris)
  ├── Build allPlaylistUris (defaults resolved via defaultPlaylists config + custom)
  │
  ├── DB: load playedTrackIds (7-day window)
  │
  └── Retry loop (max 10):
        ├── Pick random playlist URI
        ├── parseSpotifyPlaylistId(uri)             ← D-02: fix .split(':')[2]
        ├── Compute random offset                   ← D-01: Math.floor(Math.random() * Math.max(1, total - 100))
        ├── GET /playlists/{id}/items?offset=N&limit=100&fields=...  ← D-03: /items endpoint
        │     ├── 403 → playlist not owned → new error: "copy to library"  ← BLOCKER
        │     ├── null → attempts++, continue
        │     └── items array
        ├── Filter: item.track != null && !playedTrackIds.includes(id) && album.release_date exists
        ├── Pick random track from filtered window
        │     └── no unplayed → retry with new offset
        ├── DB: insert playedSongs
        └── return { track: { id, name, artists, releaseYear, albumArt } }
```

### Pattern: Fields Query for /items

```typescript
// Source: developer.spotify.com/documentation/web-api/reference/get-playlists-items
// Fields param syntax: parentheses for nested, dot for non-repeating
const fields = 'items(track(id,name,artists(name),album(release_date,images(url)))),total';
const endpoint = `/playlists/${playlistId}/items?offset=${offset}&limit=100&fields=${encodeURIComponent(fields)}`;
```

The `total` at the top level is needed to compute the random offset on first fetch. [CITED: developer.spotify.com/documentation/web-api/reference/get-playlists-items]

### Pattern: Random Offset Strategy (D-01)

```typescript
// Source: CONTEXT.md D-01
// total comes from playlistData.total (top-level field in /items response)
const maxOffset = Math.max(1, total - 100);
const offset = Math.floor(Math.random() * maxOffset);
```

Edge cases:
- `total <= 100`: `Math.max(1, 0) = 1`, offset is always 0. Correct — fetches from start.
- `total = 101`: offset in [0, 1]. Either fetches 0–99 or 1–100. Both cover all tracks. [ASSUMED — formula from CONTEXT.md, not independently verified]
- `total = 0`: handled by the `if (!playlistData || playlistData.items.length === 0)` guard.

Note: To compute the offset, `total` must be fetched first. The `/items` response includes `total` at the top level when accessible. For third-party playlists, this is moot (403). For owned playlists, `total` is in the response.

**Two-pass vs one-pass:** If we need `total` before picking offset, we need the first fetch to return it. Including `total` in the `fields` param ensures it's returned alongside `items`. This is a one-pass approach — no pre-fetch needed. [VERIFIED: total is a top-level field in the /items response per official docs]

### Pattern: 403 vs 401 Distinction

```typescript
// spotifyFetch returns null on non-401 errors (including 403)
// The current spotifyFetch only throws SpotifyAuthError on 401
// A 403 returns null — indistinguishable from "no tracks found" at current logic

// To surface 403 distinctly, spotifyFetch needs to either:
// Option A: Return null (current) — songs/random treats as "skip playlist"
// Option B: throw a new PlaylistAccessError — songs/random catches and returns specific message
```

**Current behavior:** 403 → `spotifyFetch` returns `null` → `!playlistData` guard fires → `attempts++` → eventually exhausts all 10 attempts → generic "Could not find unplayed song" error. User gets no feedback that the playlist is inaccessible.

**Recommended behavior (if planner adopts workaround option 2):** Add 403 detection in `spotifyFetch` or inline in `songs/random` to return `{ error: '...', playlistInaccessible: true }`.

### Pattern: TypeScript Interface for /items Response

```typescript
// Update SpotifyPlaylistResponse in songs/random to reflect new endpoint
interface SpotifyPlaylistTrackItem {
  track: {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: {
      release_date: string;
      images: Array<{ url: string }>;
    };
  } | null; // local files have track = null
}

interface SpotifyPlaylistResponse {
  items: SpotifyPlaylistTrackItem[];
  total: number;
}
```

Note: `track` can be `null` for local files in a playlist — filter these out. The existing code already has `.filter((item) => item.track && ...)` which handles this. [CITED: developer.spotify.com/documentation/web-api/reference/get-playlists-items]

### Pattern: validate and track-counts Fields Fix (D-04)

```typescript
// playlist/validate — current (broken for third-party):
`/playlists/${playlistId}?fields=name,id,uri,tracks.total`
// and TypeScript type: { tracks: { total: number } }
// and accessor: playlist.tracks?.total

// After fix — but ONLY if items.total works for third-party metadata:
`/playlists/${playlistId}?fields=id,name,uri,items.total`
// TypeScript type: { items: { total: number } }
// accessor: playlist.items?.total

// Alternative if items.total is also blocked for third-party:
`/playlists/${playlistId}?fields=id,name,uri,tracks(total)`
// TypeScript type: { tracks: { total: number } }  ← same as current, just correct field syntax
```

The correct fix for D-04 depends on whether `items.total` (from `GET /playlists/{id}`) works for third-party playlists. This is [ASSUMED] to work, because the `items` restriction documented is specifically for `GET /playlists/{id}/items` — the metadata endpoint's embedded `items` summary object may be different.

### Anti-Patterns to Avoid

- **Positional URI split:** `.split(':')[2]` breaks on URL format. Use `parseSpotifyPlaylistId()`.
- **Separate /tracks/{id} call for release date:** Eliminated by including `album(release_date,images)` in the `/items` fields query. Two Spotify API calls per track selection → one.
- **Assuming /items works for all playlists:** It does not. Third-party owned playlists return 403.
- **Treating 403 the same as "no tracks":** Silent failure — user gets exhausted-attempts error with no actionable message.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spotify URI parsing | Custom regex | `parseSpotifyPlaylistId()` at `spotify.ts:182` | Already handles URI, URL, bare ID — already imported in validate |
| Auth error detection | Custom token check | `SpotifyAuthError` thrown by `spotifyFetch` | Already in place, already caught in songs/random |
| Playlist ID from URI | `.split(':')[2]` | `parseSpotifyPlaylistId()` | Position-dependent, breaks on URL format |

---

## Common Pitfalls

### Pitfall 1: Assuming /items fixes third-party access

**What goes wrong:** Migrating `/tracks` → `/items` gets a 403 for HITSTER playlists. Game still broken.
**Why it happens:** The Feb 2026 change restricts items to owned/collaborative playlists — not just renames the endpoint.
**How to avoid:** Detect 403 separately from 401. Surface actionable message to user (copy playlist to library).
**Warning signs:** `spotifyFetch` returns `null` for every HITSTER playlist URI; attempts exhaust; generic 404 returned to client.

### Pitfall 2: items.total vs tracks.total in metadata endpoint

**What goes wrong:** Changing `?fields=tracks.total` → `?fields=items.total` on `GET /playlists/{id}` breaks track count display if `items.total` is not available for third-party playlists.
**Why it happens:** The restriction documented for `/items` sub-resource may also apply to the embedded `items` object on the metadata endpoint.
**How to avoid:** Test `items.total` against an actual HITSTER playlist URI before deploying. Fallback: use `tracks(total)` syntax which returns a summary object.
**Warning signs:** `playlist.items` is null/undefined for HITSTER playlists; `trackCount` shows 0.

### Pitfall 3: fields param not URL-encoded

**What goes wrong:** Parentheses `(` `)` in the fields string break if not encoded.
**Why it happens:** Raw `(` in query strings is technically invalid.
**How to avoid:** Use `encodeURIComponent(fields)` when building the endpoint URL, or confirm that `spotifyFetch` passes the URL directly (which it does — and the Spotify API appears to accept unencoded parens in practice). Low risk but worth noting.

### Pitfall 4: total = 0 or undefined before offset computation

**What goes wrong:** `total` is undefined if `/items` returns 403 (null from spotifyFetch); offset math crashes.
**Why it happens:** `playlistData.total` accessed without null-check.
**How to avoid:** Guard on `!playlistData` fires before offset math — ensure the guard happens before any property access on `playlistData`.

### Pitfall 5: SpotifyAuthError catch gap in songs/random

**What goes wrong:** The pending diff wraps only part of the handler in `try/catch`. The current working tree has the `try` starting AFTER the `allPlaylistUris` block — the JSON parse and URI building happen outside the try block at indentation level.
**Why it happens:** Looking at the diff: the original code did not have try/catch; the pending change adds it, but the indentation/structure in the file shows the `try {` starts inside the outer `try` that wraps the whole function body now. Confirmed by reading the file — lines 18-151 are all inside `try`.
**How to avoid:** No action needed — confirmed the working tree file has the complete try/catch wrapping everything.

---

## Code Examples

### Complete /items endpoint call pattern

```typescript
// Source: developer.spotify.com/documentation/web-api/reference/get-playlists-items
const fields = 'items(track(id,name,artists(name),album(release_date,images(url)))),total';
const playlistData = await spotifyFetch<SpotifyPlaylistResponse>(
  user.id,
  `/playlists/${playlistId}/items?offset=${offset}&limit=100&fields=${encodeURIComponent(fields)}`
);

// playlistData is null on ANY non-200/204 response (including 403)
// total is at playlistData.total (top level, not playlistData.items.total)
```

### Random offset formula

```typescript
// Source: CONTEXT.md D-01 / specifics section
if (!playlistData || !playlistData.total) {
  attempts++;
  continue;
}
const total = playlistData.total;
const maxOffset = Math.max(1, total - 100);
const offset = Math.floor(Math.random() * maxOffset);
// Re-fetch with this offset, OR fetch once with total=true and offset in same call
// (total is returned even on first call at offset=0 — no pre-fetch needed)
```

Note: `total` is always returned in the `/items` response regardless of offset. The first call can use `offset=0`, get `total`, compute the random offset, then make the real fetch. Or: fetch once at random offset — `total` is included in that response too. The CONTEXT.md approach implies a single fetch per attempt (pick offset before fetch, using `total` from a previous attempt or defaulting to 0 then retrying). Simplest implementation: fetch at `offset=0` on first attempt to get `total`, then use random offsets on subsequent attempts. [ASSUMED — implementation detail not locked in CONTEXT.md]

### parseSpotifyPlaylistId usage

```typescript
// Source: src/lib/server/spotify.ts:182 (read directly)
// Already handles: spotify:playlist:ID, https://open.spotify.com/playlist/ID, bare ID
import { parseSpotifyPlaylistId } from '$lib/server/spotify';

const playlistId = parseSpotifyPlaylistId(randomPlaylistUri);
if (!playlistId) {
  attempts++;
  continue;
}
```

### validate endpoint fix (D-04)

```typescript
// Change in src/routes/api/spotify/playlist/validate/+server.ts
// Current: /playlists/${playlistId}?fields=name,id,uri,tracks.total
// After: /playlists/${playlistId}?fields=id,name,uri,items.total
// TypeScript type: { name: string; id: string; uri: string; items: { total: number } }
// Accessor: playlist.items?.total || 0
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `GET /playlists/{id}/tracks` | `GET /playlists/{id}/items` | Feb 11, 2026 | Endpoint returns 404/403 if old path used |
| `playlist.tracks.total` (metadata) | `playlist.items.total` (metadata) | Feb 11, 2026 | Field rename in response |
| Separate `GET /tracks/{id}` for release date | Include `album(release_date,images)` in items fields | Best practice (always possible) | Saves one API call per song |
| All public playlists accessible | Only owned/collaborative playlists for items | Feb 11, 2026 | Third-party playlists return 403 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `items.total` on `GET /playlists/{id}` (metadata endpoint) works for third-party playlists | validate/track-counts fix, Pitfall 2 | D-04 fix breaks track count display; need to fall back to `tracks(total)` |
| A2 | `total` field is returned in `/items` response at any offset (not just offset=0) | Code Examples | Need pre-fetch at offset=0 to get total before computing random offset |
| A3 | Random offset formula `Math.max(1, total - 100)` correctly handles total=100 case | Architecture Patterns | Off-by-one: offset always 0 for exactly-100-track playlists (correct behavior, but test it) |
| A4 | `tracks(total)` field syntax works on metadata endpoint as fallback for third-party playlists | Common Pitfalls | If also blocked, track count display needs a different approach |

---

## Open Questions

1. **Does `/items` return 403 for HITSTER playlists in practice, or is the Spotify docs wording overstated?**
   - What we know: Official docs say 403 for non-owner/non-collaborator playlists. Community confirms this behavior since Feb 11.
   - What's unclear: Whether HITSTER playlists were granted any special collaborative access, or if "following" a playlist grants any special status.
   - Recommendation: User must decide: copy HITSTER playlists to their Spotify account, or the app detects 403 and prompts them to do so.

2. **Does `items.total` work on `GET /playlists/{id}` for third-party playlists (D-04)?**
   - What we know: `items` object on metadata endpoint is documented as restricted. But the restriction docs refer to the sub-resource endpoint primarily.
   - What's unclear: Whether the embedded `items: { total }` in the metadata response is subject to the same restriction.
   - Recommendation: Test against a HITSTER playlist URI; if null, use `tracks(total)` syntax instead.

3. **How does `songs/random` handle offset strategy when it cannot know `total` for a 403 playlist?**
   - What we know: If playlist returns 403, `playlistData` is null — no `total` available.
   - What's unclear: This is moot if the 403 issue is resolved by user copying playlists, but if we want to support third-party playlists via some other means, we cannot use the random offset strategy.
   - Recommendation: Defer — resolve the ownership issue first.

---

## Environment Availability

Phase 2.6: SKIPPED — this phase modifies existing SvelteKit server-side TypeScript files only. No external CLI tools, databases beyond existing PostgreSQL, or new runtimes needed. Existing dev environment assumed functional (confirmed by working tree having modified files already).

---

## Project Constraints (from CLAUDE.md)

- All Spotify API calls server-side only — browser never holds tokens. Enforced by `spotifyFetch` in `spotify.ts`.
- `spotifyFetch<T>()` is the one authenticated fetch wrapper — do not bypass it.
- `SpotifyAuthError` caught at API route boundary → `{ requiresReauth: true, status: 401 }`. Existing pattern in all modified routes.
- `playlist/validate` is a "live caller" — changes must be surgical. Interface unchanged; only internal Spotify fields param changes.
- `src/lib/server/db/` schema changes require Drizzle migration — Phase 1 touches no schema.
- `src/hooks.server.ts` — do not touch.
- Svelte 5 runes only — `play/+page.svelte` uses `$state`, `$derived`, `$effect`. No Svelte stores.

---

## Sources

### Primary (HIGH confidence)
- [developer.spotify.com/documentation/web-api/reference/get-playlists-items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items) — fields param syntax, response schema, 403 restriction confirmed
- [developer.spotify.com/documentation/web-api/references/changes/february-2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) — Feb 2026 changes: endpoint rename and ownership restriction
- [developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) — migration guide: field renames confirmed
- [developer.spotify.com/documentation/web-api/reference/get-playlist](https://developer.spotify.com/documentation/web-api/reference/get-playlist) — metadata endpoint fields, items.total availability
- Direct codebase read: all six source files read in full — current state of working tree confirmed

### Secondary (MEDIUM confidence)
- [github.com/music-assistant/support/issues/5114](https://github.com/music-assistant/support/issues/5114) — real-world 403 behavior for third-party playlists confirmed
- [community.spotify.com/t5/Spotify-for-Developers/403-Forbidden-on-all-playlist-track-requests-even-with-new-app/td-p/7367439](https://community.spotify.com/t5/Spotify-for-Developers/403-Forbidden-on-all-playlist-track-requests-even-with-new-app/td-p/7367439) — community confirmation of 403 for all non-owned playlists

### Tertiary (LOW confidence)
- dplatz.de HITSTER clone blog — confirms /tracks → /items rename breaks Hitster clone; no detail on ownership issue

---

## Metadata

**Confidence breakdown:**
- Third-party 403 issue: HIGH — official docs explicit, community confirmed
- fields query syntax: HIGH — official docs + working examples
- items.total on metadata endpoint for third-party: LOW — underdocumented, [ASSUMED] works
- Random offset formula: HIGH — from CONTEXT.md D-01, trivially correct
- Auth files (AUTH-01): HIGH — read all files directly, all complete

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (Spotify API stable, but check for further access changes)
