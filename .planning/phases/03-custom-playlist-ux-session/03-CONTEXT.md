# Phase 3: Custom Playlist UX + Session - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the custom playlist management UI (add/toggle/remove for both default and custom playlists) and session history management (clear with inline confirmation, songs-played counter). Consolidate the scattered localStorage keys into a single versioned, Zod-validated schema. This is the core differentiator from physical Hitster: any Spotify playlist, any party.

**In scope:**
- Custom playlist enable/disable toggle (matching default playlist UX)
- Default playlist selection state persisted live to localStorage (not just at game start)
- Setup page restores selections from localStorage on load
- Consolidated `shitster_playlists` localStorage schema with versioning + Zod validation
- Songs-played counter in play page header (client-side, resets on clear)
- History clear inline confirmation — double-press pattern, no `window.confirm()`
- History clear button on both play page and setup page
- Only enabled playlists passed to `/api/spotify/songs/random`

**Out of scope:**
- `alert()` → inline error replacement (Phase 4, UI-01)
- Re-auth inline banner (Phase 4, UI-02)
- URI validation improvements (Phase 4, PLAY-07)
- Rate limit handling (Phase 4, API-04)
- Album art on flip card (v2, UX-01)

</domain>

<decisions>
## Implementation Decisions

### localStorage Schema (PLAY-05)
- **D-01:** Consolidate all playlist state into a single `shitster_playlists` key with versioned schema: `{ version: 1, defaultSelected: string[], custom: [{ id: string, name: string, uri: string, trackCount: number, enabled: boolean }] }`.
- **D-02:** Track counts cache (`shitster_default_track_counts` + `_timestamp`) stays as a separate cache key — it is not playlist state.
- **D-03:** Zod schema validates on every read. On parse failure, silently reset to defaults (all default playlists selected, empty custom array).
- **D-04:** On setup page load, read `shitster_playlists` and restore `defaultSelected` and `custom` arrays. Fall through to all-selected defaults if key doesn't exist or parse fails. Migrate old `shitster_custom_playlists` + `shitster_selected_defaults` keys if the new key is absent (one-time migration, then delete old keys).

### Playlist Toggle Persistence (PLAY-03, PLAY-06)
- **D-05:** Write to `shitster_playlists` immediately on every toggle — not just at game start. A helper function handles the write.
- **D-06:** Play page reads `shitster_playlists` to construct the song selection request. `customPlaylistUris` sent to `/api/spotify/songs/random` only includes custom playlists where `enabled === true`. `selectedDefaultPlaylists` is `defaultSelected` from the schema.

### Custom Playlist Enable/Disable UX (PLAY-03)
- **D-07:** Custom playlist rows in setup page become clickable cards matching the default playlist toggle UX. Enabled = gradient border + highlight (same classes as selected defaults). Disabled = muted card style.
- **D-08:** "Fjern" (Remove) button is always visible on the card regardless of enabled state. It is a small button in the card, not hidden on hover.
- **D-09:** "START SPILL" is disabled when zero playlists are enabled (zero enabled defaults + zero enabled customs). The guard that currently checks `totalSelectedPlaylists === 0` must be updated to count only enabled playlists.

### Songs-Played Counter (SESS-04)
- **D-10:** Track counter client-side as a `$state` variable in the play page. Increment by 1 on every successful `getNextSong()` call. Reset to 0 on successful history clear.
- **D-11:** Show counter in the play page header bar as small text "X sanger spilt" (next to the "shitster" title). Visible at all times during play, TV-readable.

### History Clear UX (SESS-01, SESS-02, SESS-03)
- **D-12:** Double-press confirmation pattern. First click: button text changes to "Bekreft?" with destructive red styling. Second click: executes clear. Clicking anywhere else (or waiting) cancels — reset back to "TØM HISTORIKK".
- **D-13:** After successful clear: button briefly shows "Slettet!" for ~2 seconds, then reverts to "TØM HISTORIKK". Counter resets to 0. No `alert()`.
- **D-14:** History clear button appears on both the play page (already exists) and the setup page (add it). Same double-press UX on both pages.
- **D-15:** Clear only deletes `playedSongs` DB rows. Playlist selections (localStorage) are never touched — SESS-02.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, requirement IDs (PLAY-01–06, SESS-01–04)
- `.planning/REQUIREMENTS.md` — Full requirement definitions

### Primary Files to Modify
- `src/routes/setup/+page.svelte` — Main target: add localStorage schema, live persistence, custom toggle UX, clear button, restore state on load
- `src/routes/play/+page.svelte` — Add songs-played counter, double-press clear confirmation, read new localStorage schema for song selection
- `src/routes/api/spotify/history/clear/+server.ts` — Existing endpoint (no changes needed — works as-is)
- `src/routes/api/spotify/playlist/validate/+server.ts` — Existing endpoint (no changes needed — works as-is)

### Supporting References
- `src/routes/api/spotify/songs/random/+server.ts` — Interface unchanged; `customPlaylistUris` must only include enabled playlists (client-side filter)
- `src/lib/components/ui/button/` — Button component used for all interactive elements
- `src/lib/components/ui/input/` — Input component for playlist URL field
- `src/lib/server/db/schema.ts` — `playedSongs` table (cleared by history clear endpoint)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button` from `$lib/components/ui/button` — all interactive elements; supports `variant="outline"`, `variant="ghost"`, `size="sm"/"lg"`, disabled prop
- `Input` from `$lib/components/ui/input` — playlist URL input (already in use)
- `Label` from `$lib/components/ui/label` — already imported in setup page
- `/api/spotify/history/clear` POST endpoint — works, just needs UI to call it correctly
- `/api/spotify/playlist/validate` POST endpoint — works, returns `{ name, uri, trackCount }`
- `parseSpotifyPlaylistId` in `src/lib/server/spotify.ts` — already used in validate endpoint
- Gradient button class: `bg-linear-to-r from-purple-600 via-pink-500 to-orange-400 text-white` — used for enabled/active state

### Established Patterns
- Svelte 5 runes: `$state()`, `$derived`, `onMount`. No Svelte stores for UI state.
- Norwegian UI copy throughout: "NESTE SANG", "VIS SANG", "TØM HISTORIKK", "START SPILL", "Fjern", "Legg til"
- `errorMessage = $state('')` pattern — inline error display, no toast library
- localStorage reads happen either in the script body (before mount) or in `onMount` — use `onMount` for async; use script body for sync reads
- Track counts cache: separate keys `shitster_default_track_counts` + `shitster_default_track_counts_timestamp` (24h TTL) — do not touch

### Integration Points
- Setup page → play page: data flows via localStorage (`shitster_playlists` after migration, `shitster_session_id` unchanged)
- Play page reads `shitster_playlists` in `onMount` to build the songs/random request body
- `songs/random` POST body: `{ sessionId, selectedDefaultPlaylists: string[], customPlaylistUris: string[] }` — interface unchanged, client filters enabled
- Default playlist toggle visual: active = `bg-linear-to-br from-purple-600 to-pink-500 text-white border-purple-400 shadow-lg`, inactive = `bg-card hover:bg-accent`

### Known Issues Being Fixed
- `clearHistory()` in play page uses `alert()` — replace with double-press + "Slettet!" feedback
- `selectedDefaults` in setup page always starts as all-selected (doesn't read localStorage) — fix by reading `shitster_playlists.defaultSelected` on load
- Custom playlists have no `enabled` field in current schema — migration needed when reading old `shitster_custom_playlists` key (add `enabled: true` to all entries)
- Playlist state only written to localStorage in `startGame()` — move writes to each toggle handler

</code_context>

<specifics>
## Specific Ideas

- Zod schema for the consolidated key (define in setup page or extract to `src/lib/config/playlists.ts`):
  ```typescript
  const PlaylistStateSchema = z.object({
    version: z.literal(1),
    defaultSelected: z.array(z.string()),
    custom: z.array(z.object({
      id: z.string(),
      name: z.string(),
      uri: z.string(),
      trackCount: z.number(),
      enabled: z.boolean()
    }))
  });
  ```
- Migration: if `shitster_playlists` absent but `shitster_custom_playlists` exists, parse old key and add `enabled: true` to each entry; write to new key; delete old keys.
- Double-press clear: `let clearPending = $state(false)`. First click sets `clearPending = true`. Second click (while `clearPending`) executes clear + shows "Slettet!". `onclick:outside` or `onblur` resets `clearPending`.
- Songs-played counter: `let songsPlayed = $state(0)`. Increment in `getNextSong()` on success. Reset in `clearHistory()` on success.

</specifics>

<deferred>
## Deferred Ideas

- Token refresh singleton (concurrent refresh race) → v2, RES-03
- `alert()` → inline error states for reauth → Phase 4, UI-01/02
- Rate limit (429) inline handling → Phase 4, API-04
- Stale device auto-refresh → v2, RES-01
- Private playlist 403 warning → v2, RES-02

</deferred>

---

*Phase: 3-custom-playlist-ux-session*
*Context gathered: 2026-05-21*
