# Phase 4: Play Page Polish - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the play page party-ready: replace all three `alert()` calls with inline error states, add a re-auth inline banner, handle Spotify 429 rate limits gracefully with a manual retry button, add client-side URI validation on setup page, widen the token refresh buffer to 5 minutes, and apply TV-readable layout tweaks.

**In scope (requirements: API-03, API-04, PLAY-07, UI-01, UI-02, UI-03, UI-04):**
- Replace 3 `alert()` + `goto()` calls in `play/+page.svelte` with `requiresReauth = true` → re-auth inline banner (UI-01, UI-02)
- 429 from Spotify surfaced as inline rate-limit banner with manual "PRØV IGJEN" button (API-04)
- URI validation on setup page: client-side regex check before submitting (PLAY-07)
- Remove `console.log('data', data)` from play page (UI-03)
- Token refresh buffer widened from 60s to 5 min in `spotify.ts` (API-03)
- TV-readable layout adjustments: card max-width, button text size, counter text size (UI-04)

**Out of scope:**
- Server-side 429 retry logic (client-side "prøv igjen" only)
- Album art on flip card (v2, UX-01)
- Stale device auto-refresh (v2, RES-01)
- Private playlist 403 warning (v2, RES-02)

</domain>

<decisions>
## Implementation Decisions

### Error State Lifecycle (UI-01, UI-02, API-04)
- **D-01:** Clear ALL error state flags at the top of `getNextSong()` — add `requiresReauth = false; rateLimited = false;` alongside the existing `errorMessage = '';`. Consistent with the current pattern. Optimistic: banner disappears immediately when user acts; re-appears if the request fails again.
- **D-02:** NESTE SANG button is disabled while `requiresReauth = true` — `disabled={loading || requiresReauth}`. Makes the intended flow obvious: user must click "Logg inn igjen" first. Prevents double-error when re-auth is still needed.

### Token Refresh Buffer (API-03)
- **D-03:** Inline constant — `const needsRefresh = expiresIn < 5 * 60 * 1000;` at `src/lib/server/spotify.ts:29`. Single-line change, no named constant needed.

### Claude's Discretion
- `requiresReauth` and `rateLimited` state variable names (follow existing camelCase convention)
- 429 banner placement and "PRØV IGJEN" button behavior — follow UI-SPEC exactly
- URI validation regex pattern for Spotify URLs/URIs — use `parseSpotifyPlaylistId` logic as reference
- TV layout CSS tweaks — follow UI-SPEC values verbatim

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Contract (most important — covers all UI changes)
- `.planning/phases/04-play-page-polish/04-UI-SPEC.md` — Interaction contracts, component surfaces, Norwegian copy, state priority order, 429 state machine, TV layout values. Read this before touching any UI.

### Requirements
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, requirement IDs (API-03, API-04, PLAY-07, UI-01–04)
- `.planning/REQUIREMENTS.md` — Full requirement definitions

### Primary Files to Modify
- `src/routes/play/+page.svelte` — Main target: replace alert() calls, add requiresReauth/rateLimited state, TV layout tweaks, remove console.log
- `src/lib/server/spotify.ts` — API-03: widen needsRefresh buffer from 60s to 5 min at line 29
- `src/routes/setup/+page.svelte` — PLAY-07: add client-side URI validation before form submit
- `src/routes/api/spotify/songs/random/+server.ts` — Confirm 429 status is passed through to client (no server-side retry added)

### Supporting References
- `src/lib/components/ui/button/` — Button component (variant="outline", size="sm")
- `src/lib/server/spotify.ts` — `parseSpotifyPlaylistId()` at line 182 — reference for URI regex logic

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button` from `$lib/components/ui/button` — `variant="outline"` for re-auth CTA and 429 retry
- `requiresReauth` response field already returned by `devices`, `songs/random`, `player/play` API routes — client just needs to check it and set state flag instead of calling `alert()`
- `errorMessage = $state('')` pattern — extended with `requiresReauth = $state(false)` and `rateLimited = $state(false)`
- `parseSpotifyPlaylistId()` in `src/lib/server/spotify.ts:182` — handles URIs, URLs, bare IDs; reference for client regex

### Established Patterns
- Svelte 5 runes: `$state()`, `$derived`, `onMount` — no Svelte stores
- Norwegian UI copy throughout (`NESTE SANG`, `TØM HISTORIKK`, etc.)
- `errorMessage = ''` cleared at top of async actions — D-01 follows this
- `disabled={loading}` pattern on action buttons — extend to `disabled={loading || requiresReauth}`

### Integration Points
- Play page onMount → devices fetch → `data.requiresReauth` → currently `alert()` → replace with `requiresReauth = true`
- `getNextSong()` → songs/random → `error.requiresReauth` or `response.status === 429` → set state flags
- `playSong()` → player/play → `error.requiresReauth` → set `requiresReauth = true`
- Setup page submit → currently calls `playlist/validate` → add client-side regex check before API call

### Known State in Current Code
- 3 `alert()` calls: `onMount` (line ~57), `getNextSong()` (line ~108), `playSong()` (line ~150)
- `console.log('data', data)` at line ~61 in `onMount`
- No `requiresReauth` or `rateLimited` state variables yet — add both
- Token buffer: `src/lib/server/spotify.ts:29` — currently `60 * 1000`

</code_context>

<specifics>
## Specific Ideas

- State priority for the single display slot (from UI-SPEC): `requiresReauth` > `rateLimited` > `errorMessage` > device selector. Implement as `{:else if requiresReauth}` ... `{:else if rateLimited}` ... `{:else if errorMessage}` ... chain in template.
- 429 state machine (from UI-SPEC): `response.status === 429` in `getNextSong()` → `rateLimited = true; loading = false; return;`. "PRØV IGJEN" button: `onclick={() => { rateLimited = false; getNextSong(); }}`.
- Re-auth banner CTA: `onclick={() => goto('/auth/login/spotify')}` — same `goto` already imported.
- Client URI validation: check input against Spotify URL pattern (`open.spotify.com/playlist/`) or URI pattern (`spotify:playlist:`) before calling `/playlist/validate`. On mismatch: set inline `validationError` state, no API call.

</specifics>

<deferred>
## Deferred Ideas

- Server-side 429 retry with exponential backoff → v2, RES-03 territory
- `Retry-After` header parsing and countdown display in banner → v2
- Stale device auto-refresh on 404 device not found → v2, RES-01
- Private playlist 403 warning → v2, RES-02

</deferred>

---

*Phase: 4-play-page-polish*
*Context gathered: 2026-05-21*
