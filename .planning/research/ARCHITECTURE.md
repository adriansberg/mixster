# Architecture Patterns

**Domain:** Spotify party jukebox (SvelteKit 2 + Svelte 5, Drizzle/Postgres, Vercel)
**Researched:** 2026-05-18
**Confidence:** HIGH — analysis from direct codebase inspection

---

## Recommended Architecture

Current architecture is sound. Work is cleanup, not redesign. The server-side Spotify proxy pattern is correct and must be preserved. Cleanup removes confusion and security risk without changing the working flow.

```
Browser (localStorage: playlist state, session_id)
  └─ fetch() ──► SvelteKit API routes (/api/spotify/*, /api/auth/*)
                      └─ spotifyFetch() ──► Spotify Web API
                      └─ db (Drizzle) ──► playedSongs, sessions, spotifyTokens
```

### Component Boundaries (post-cleanup target)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `hooks.server.ts` | Session hydration → `event.locals` | `lib/server/auth` |
| `lib/server/spotify.ts` | Token get/refresh, Spotify proxy, SpotifyAuthError | DB, Spotify API |
| `/api/spotify/songs/random` | Track selection, dedup filter, playedSongs insert | spotify.ts, DB |
| `/api/spotify/player/{play,pause}` | Playback control proxy | spotify.ts |
| `/api/spotify/devices` | Device list proxy | spotify.ts |
| `/api/spotify/playlist/validate` | Playlist URI validation + metadata | spotify.ts |
| `/api/spotify/playlists/track-counts` | Bulk track count fetch | spotify.ts |
| `/api/spotify/history/clear` | Delete user's playedSongs rows | DB only |
| `/api/auth/reauth` | Invalidate sessions + Spotify tokens | auth, spotify.ts |
| `setup/+page.svelte` | Playlist selection UI, localStorage writes | API routes |
| `play/+page.svelte` | Game loop UI, localStorage reads | API routes |

### Dead Components to Remove (all safe — no live callers)

| Component | Reason Dead | Safe to Delete |
|-----------|-------------|----------------|
| `src/lib/services/spotify-player.ts` | Not called anywhere in play flow | YES |
| `src/lib/types/spotify-player.d.ts` | Types only used by dead service | YES |
| `/api/spotify/token` | Only purpose: feed dead SpotifyPlayerService | YES |
| `/api/spotify/playlists` (GET+DELETE) | Reads/writes dead userPlaylists table | YES |
| `/api/spotify/playlist/add` | Writes dead userPlaylists table | YES |
| `/api/spotify/playlist/toggle` | Mutates dead userPlaylists table | YES |
| `/api/spotify/player/start` | Duplicate of /player/play, no SpotifyAuthError handling | YES |
| `src/lib/server/email.ts` | No email flows; Spotify-only OAuth | YES |
| `userPlaylists` DB table | Playlists in localStorage; table has IDOR bugs | YES (after route removal) |

---

## Cleanup Order — Dead DB Routes

**Constraint:** Remove routes before dropping the DB table. Dropping the table first breaks TypeScript compilation (schema import).

### Step 1 — Verify no callers (git grep)
```bash
grep -r "api/spotify/playlists\|api/spotify/playlist/add\|api/spotify/playlist/toggle\|api/spotify/token\|SpotifyPlayerService\|spotify-player" src/
```
Confirm zero hits in `.svelte` or `+page.server.ts` files (routes themselves will match — ignore those).

### Step 2 — Delete dead route files (order within step is arbitrary)
```
src/routes/api/spotify/token/+server.ts
src/routes/api/spotify/playlists/+server.ts          (GET + DELETE)
src/routes/api/spotify/playlist/add/+server.ts
src/routes/api/spotify/playlist/toggle/+server.ts
src/routes/api/spotify/player/start/+server.ts
```
Empty directories left behind (`playlists/`, `playlist/add/`, etc.) must be removed — SvelteKit treats empty route dirs as 404 stubs without +server.ts, but they create routing noise.

### Step 3 — Delete dead service + types
```
src/lib/services/spotify-player.ts
src/lib/types/spotify-player.d.ts
src/lib/server/email.ts
```

### Step 4 — Remove userPlaylists from schema.ts
Delete the `userPlaylists` export block (lines 47–63 in current schema.ts). Also remove any `userPlaylists` import from `lib/server/db/index.ts` if re-exported there.

### Step 5 — DB migration: drop table
```sql
-- migrations/XXXX_drop_user_playlists.sql
DROP TABLE IF EXISTS user_playlists;
```
Run via `drizzle-kit generate` + `drizzle-kit migrate`. The `IF EXISTS` guard makes it idempotent.

### Step 6 — Validate compilation
```bash
npx tsc --noEmit
```
No errors = safe.

**Risk assessment for each step:**
- Steps 2–4: Zero risk. Routes are unreachable from any live page. IDOR bugs mean these routes should not be called; removing them closes the attack surface.
- Step 5: Irreversible data loss for `user_playlists` rows, but the table is functionally empty in any real deployment (playlists are in localStorage). Back up if paranoid: `pg_dump --table=user_playlists`.
- Step 6 (validate endpoint): `/api/spotify/playlist/validate` is KEPT — it is called by `setup/+page.svelte:addCustomPlaylist()`. Do not delete it.

---

## localStorage Schema Versioning

### Current Schema (all keys prefixed `shitster_`)

| Key | Written by | Read by | Type |
|-----|-----------|---------|------|
| `shitster_session_id` | setup (startGame) | play (onMount) | string (nanoid) |
| `shitster_selected_defaults` | setup (startGame) | play (onMount) | `string[]` (playlist IDs) |
| `shitster_custom_playlists` | setup (addCustomPlaylist, removePlaylist, startGame) | play (getNextSong) | `Array<{id,name,uri,trackCount}>` |
| `shitster_default_track_counts` | setup (onMount, cache write) | setup (onMount, cache read) | `Record<string, number>` |
| `shitster_default_track_counts_timestamp` | setup (onMount) | setup (onMount) | string (ms timestamp) |

`shitster_custom_playlists` is the only key shared across two pages and likely to be affected by schema changes.

### Schema Change Risks

**`shitster_custom_playlists` object shape:** Current shape is `{id, name, uri, trackCount}`. If a future field is added (e.g., `isEnabled: boolean` for playlist toggle UI), old localStorage values won't have it. `play/+page.svelte` maps directly with `p.uri` — missing fields silently produce `undefined`, which may cause runtime errors downstream.

**`shitster_selected_defaults` array:** Contains playlist IDs from `src/lib/config/playlists.ts`. If the hard-coded default playlist list changes (playlist removed from Spotify, ID updated), stale IDs are sent to `/api/spotify/songs/random`, which will silently fail that playlist's fetch.

### Recommended Approach: Defensive Read with Version Guard

Use a version key rather than field-by-field migration:

```typescript
// src/lib/localStorage.ts
const SCHEMA_VERSION = 1;

export function readCustomPlaylists(): CustomPlaylist[] {
  const version = parseInt(localStorage.getItem('shitster_schema_version') || '0');
  if (version < SCHEMA_VERSION) {
    // Nuke stale keys on schema bump
    localStorage.removeItem('shitster_custom_playlists');
    localStorage.removeItem('shitster_selected_defaults');
    localStorage.setItem('shitster_schema_version', String(SCHEMA_VERSION));
    return [];
  }
  try {
    return JSON.parse(localStorage.getItem('shitster_custom_playlists') || '[]');
  } catch {
    return [];
  }
}
```

**When to bump version:** Any structural change to `shitster_custom_playlists` object shape. Adding optional fields with safe defaults does NOT require a bump if read code handles missing fields explicitly.

**For `isEnabled` addition** (upcoming playlist toggle feature): add `isEnabled ?? true` at read time — no version bump needed. Example:

```typescript
const customPlaylists = raw.map(p => ({
  ...p,
  isEnabled: p.isEnabled ?? true  // safe default for old entries
}));
```

**`endGame` bug:** Currently removes `shitster_session_id` and `shitster_selected_defaults` but NOT `shitster_custom_playlists`. This is intentional (custom playlists persist between games) but inconsistent with session cleanup. Document the contract: session keys clear on `endGame`; playlist keys are persistent until explicitly removed by user.

---

## Play History Clear Endpoint

### Current Implementation

`POST /api/spotify/history/clear` — server-side, deletes all `playedSongs` rows for `locals.user.id`. Correct approach.

### Architecture Decision: Keep Server-Side

The endpoint is already correct. Reasons to keep it server-side:
- `playedSongs` is authoritative state (not client-derived). Client cannot clear it without the server.
- The clear operation is scoped to `userId` — requires authenticated session to prevent clearing other users' history.
- Client calls `await fetch('/api/spotify/history/clear', { method: 'POST' })` — one line. No complexity argument for client-side.

### What to Expose

Current response `{ success: true }` is sufficient. No need to return the deleted count. If the UI needs feedback ("X songs cleared"), the server can optionally return `{ success: true, cleared: n }` using Drizzle's `.returning()` but this is cosmetic.

**Do not expose a partial clear** (e.g., clear by sessionId only). The game's clear-history UX means "start fresh" — full clear per user is the right semantic. The `sessionId` column exists in `playedSongs` for potential future session-scoped dedup but is not needed for clear.

---

## API Route Organization

### Current Taxonomy

```
/api/
  auth/
    reauth/                      ← session/token invalidation
  spotify/
    devices/                     ← device list
    history/clear/               ← DB mutation (playedSongs)
    player/
      pause/                     ← playback control
      play/                      ← playback control
      start/                     ← DEAD: duplicate of play
    playlist/
      add/                       ← DEAD: DB write
      toggle/                    ← DEAD: DB write
      validate/                  ← LIVE: Spotify metadata fetch, localStorage flow
    playlists/
      +server.ts                 ← DEAD: DB read/write
      track-counts/              ← LIVE: bulk Spotify fetch
    songs/random/                ← core game mechanic
    token/                       ← DEAD: security risk
```

### Post-Cleanup Target

```
/api/
  auth/
    reauth/
  spotify/
    devices/
    history/clear/
    player/
      pause/
      play/
    playlist/
      validate/
    playlists/
      track-counts/
    songs/random/
```

### Naming Consistency Issues

**Singular vs plural inconsistency:** `playlist/validate` (singular) vs `playlists/track-counts` (plural). Current split is: `playlists/` for collection operations, `playlist/` for single-item operations. This is defensible but accidental — it happened because `playlist/add` and `playlist/toggle` (now dead) operated on single items. Post-cleanup, only `playlist/validate` remains singular. Consider renaming to `playlists/validate` for consistency, or leave it — the URL only exists in `setup/+page.svelte` so rename cost is trivial.

**Recommendation:** Rename `playlist/validate` → `playlists/validate`. Move `history/clear` under a cleaner path: `songs/history/clear` mirrors `songs/random` and groups song-related operations. Both renames are cosmetic — do them in a single commit updating the route dir + the one fetch call in the client.

### Pattern: All Spotify Routes Use spotifyFetch

All live `/api/spotify/*` handlers must go through `spotifyFetch()` from `lib/server/spotify.ts` and handle `SpotifyAuthError`. The `player/start` dead route fails to do this — another reason to delete it. The validate and track-counts routes currently do `try/catch` without explicit `SpotifyAuthError` handling; they should be updated to return `{ requiresReauth: true, status: 401 }` on `SpotifyAuthError` like other routes.

### Pattern: Auth Guard

No shared middleware helper exists — each route independently checks `locals.user`. For this app's scale (few routes), this is acceptable. Extracting a `requireAuth(event)` helper is worth doing during cleanup to DRY up the 7+ identical blocks.

---

## Anti-Patterns to Avoid

### Do Not Recreate DB-Backed Playlist Storage

`userPlaylists` table comment says "keeping for potential future use." Remove this comment. The decision is made: localStorage is the source of truth for playlist selection. Adding per-user DB playlist storage would reintroduce the IDOR surface and couple a stateless party game to per-user data. If cross-device sync is ever needed, that is a separate feature decision with its own design.

### Do Not Call Spotify API from Client

`SpotifyPlayerService` + `/api/spotify/token` represent a design that was tried and abandoned. Do not resurrect it. The server-proxy pattern is correct: tokens never leave the server, `SpotifyAuthError` propagates cleanly, token refresh is centralized.

### Do Not Put Business Logic in Page Components

`play/+page.svelte` currently contains track-picking trigger logic, history-clear logic, and end-game logic inline. For current scope this is fine. As the play page grows, extract: `src/lib/game.ts` for stateless game utilities (session ID generation, localStorage key constants). Keep Svelte components as thin UI orchestrators.

---

## Migration Risk Summary

| Change | Risk | Notes |
|--------|------|-------|
| Delete token endpoint | LOW | No live callers; closes security hole |
| Delete userPlaylists routes | LOW | No live callers; IDOR bugs make keeping them worse |
| Delete SpotifyPlayerService | LOW | Not imported by any live file |
| Delete email.ts | LOW | Not imported by any live file |
| Drop user_playlists table | LOW | Table unused; back up before drop |
| localStorage versioning | LOW | Defensive read is additive |
| Rename playlist/validate | LOW | One fetch URL in setup/+page.svelte |
| History clear endpoint | NONE | Already correct; no changes needed |

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| DB route removal | Deleting validate route by mistake | Verify caller in setup page before any deletion |
| Table drop migration | Drizzle schema out of sync with DB | Always generate migration via drizzle-kit, never manual ALTER |
| localStorage schema bump | Stale custom playlists after field addition | Use `?? default` at read site; only bump version for breaking shape changes |
| Playlist toggle UI (future) | Forgetting `isEnabled` default for old localStorage entries | Coerce at read time, not write time |
| History clear UX | Using alert() for feedback (current bug) | Replace with in-page `errorMessage` state already present |

---

*Sources: direct inspection of src/routes/api/*, src/lib/server/db/schema.ts, src/routes/play/+page.svelte, src/routes/setup/+page.svelte — HIGH confidence*
