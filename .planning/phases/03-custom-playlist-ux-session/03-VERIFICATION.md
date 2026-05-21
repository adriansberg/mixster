---
phase: 03-custom-playlist-ux-session
verified: 2026-05-21T08:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open /setup with empty localStorage, toggle one default off, reload — toggle state persists"
    expected: "The toggled-off playlist remains deselected after reload"
    why_human: "localStorage interaction requires a browser session"
  - test: "Open /setup with old shitster_custom_playlists key present (no shitster_playlists). Reload — old key is gone, shitster_playlists contains migrated data with enabled:true per entry"
    expected: "Migration runs once, old key deleted, new key populated correctly"
    why_human: "Requires devtools localStorage manipulation and browser reload"
  - test: "Add a custom playlist via URL. Verify it appears as a toggle card with the gradient active style matching default playlists. Click the card — gradient deactivates. Click Fjern — playlist removed without toggling"
    expected: "Custom playlist card visually matches default toggles; Fjern is independent of toggle"
    why_human: "Visual appearance and UX behaviour require browser"
  - test: "Disable all playlists on /setup — START SPILL becomes disabled. Re-enable one — it becomes enabled"
    expected: "Button disabled prop responds correctly to zero-enabled state"
    why_human: "Requires interactive browser session"
  - test: "On /play, fetch a song (START FØRSTE SANG). Counter appears showing '1 sang spilt'. Fetch again — '2 sanger spilt'"
    expected: "Counter increments only on successful song fetch"
    why_human: "Requires live Spotify session and full game flow"
  - test: "On /play, click TØM HISTORIKK once — button turns 'Bekreft?' in destructive red. Tab away — reverts to 'TØM HISTORIKK'. Click twice consecutively — button briefly shows 'Slettet!', counter resets to 0"
    expected: "Double-press pattern works; onblur cancels pending; success feedback shown for ~2s"
    why_human: "Requires interactive browser session and live API"
  - test: "Click AVSLUTT SPILL from /play, return to /setup — playlist selections are still intact"
    expected: "shitster_playlists untouched by endGame()"
    why_human: "Requires full session flow in browser"
  - test: "On /setup, use TØM HISTORIKK double-press — identical UX to play page"
    expected: "Bekreft?/Slettet! feedback, onblur cancel, API POST fires only on second click"
    why_human: "Requires interactive browser session and live API"
---

# Phase 3: Custom Playlist UX + Session Verification Report

**Phase Goal:** Users can manage their own playlists and control session history — the core differentiator from physical Hitster is complete
**Verified:** 2026-05-21T08:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can paste a Spotify playlist URL or URI, see resolved name + track count, and have it saved across page reloads | VERIFIED | `addCustomPlaylist()` in setup page calls `/api/spotify/playlist/validate`, stores result with `enabled:true` via `savePlaylistState()` which writes to `shitster_playlists`. Persistence across reloads confirmed by `parsePlaylistState` on init restoring `customPlaylists` from that key. |
| 2 | User can toggle any playlist (default or custom) on/off; only enabled playlists are used when fetching the next song | VERIFIED | `toggleDefault()` and `toggleCustom()` each call `savePlaylistState()`. Play page `onMount` reads `state.custom.filter(p => p.enabled).map(p => p.uri)` into `customPlaylistUris`, which is sent as-is to `/api/spotify/songs/random`. |
| 3 | User can remove a custom playlist they added | VERIFIED | `removePlaylist()` filters out the entry and calls `savePlaylistState()`. Fjern button in markup calls `removePlaylist` with `e.stopPropagation()` so toggle is not triggered. |
| 4 | User can clear play history; counter resets and playlist selections are fully preserved | VERIFIED | `clearHistory()` on play page: on success sets `songsPlayed = 0`. `endGame()` removes only `shitster_session_id` — `shitster_playlists` untouched (grep confirms no `removeItem('shitster_playlists')` anywhere). `clearHistory()` on setup page contains no localStorage writes at all. |
| 5 | History clear prompts inline confirmation — no `window.confirm()` dialog | VERIFIED | Double-press pattern implemented on both pages. `grep -cE "window\.confirm\|alert\(" src/routes/setup/+page.svelte` = 0. Play page retains 3 `alert()` calls but all are in reauth branches explicitly preserved for Phase 4 (per PLAN 03-02 deviation note and ROADMAP Phase 4 SC-1). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/config/playlist-state.ts` | Zod schema, helpers, STORAGE_KEY | VERIFIED | Exports STORAGE_KEY, PlaylistStateSchema, PlaylistState, DEFAULT_PLAYLIST_STATE, parsePlaylistState, migrateOldKeys — all present and substantive |
| `src/lib/config/playlist-state.test.ts` | 18 tests covering all behavior bullets | VERIFIED | 18/18 tests pass under `npx vitest run` |
| `src/routes/setup/+page.svelte` | Consolidated schema, custom toggle UX, immediate persistence, TØM HISTORIKK | VERIFIED | Imports parsePlaylistState+migrateOldKeys+STORAGE_KEY; 6 savePlaylistState calls; toggleCustom defined and wired; clearHistory double-press; no old keys |
| `src/routes/play/+page.svelte` | Consolidated schema read, enabled-only filter, counter, double-press clear | VERIFIED | Imports parsePlaylistState+STORAGE_KEY; onMount filters enabled customs; songsPlayed increments after track assignment; clearHistory double-press; endGame leaves shitster_playlists intact |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `setup/+page.svelte` | `playlist-state.ts` | import at line 8-12 | WIRED | `parsePlaylistState`, `migrateOldKeys`, `STORAGE_KEY` all imported and used |
| `setup/+page.svelte` | `localStorage shitster_playlists` | `savePlaylistState()` called 6 times | WIRED | Called at init, toggleDefault, toggleCustom, addCustomPlaylist, removePlaylist — every mutation path covered |
| `play/+page.svelte` | `playlist-state.ts` | import at line 5 | WIRED | `parsePlaylistState`, `STORAGE_KEY` imported; used in onMount |
| `play/+page.svelte` | `/api/spotify/songs/random` | fetch with `customPlaylistUris` state var | WIRED | `customPlaylistUris` populated from `state.custom.filter(p => p.enabled)` in onMount; sent in every `getNextSong` call |
| `play/+page.svelte` | `/api/spotify/history/clear` | fetch POST in clearHistory | WIRED | Second-click branch sends `fetch('/api/spotify/history/clear', { method: 'POST' })` |
| `setup/+page.svelte` | `/api/spotify/history/clear` | fetch POST in clearHistory | WIRED | Same double-press pattern; confirmed by `grep -c "/api/spotify/history/clear" src/routes/setup/+page.svelte` = 1 |

### Acceptance Criteria Spot-Checks

| Criterion | Result | Status |
|-----------|--------|--------|
| STORAGE_KEY export = 'shitster_playlists' | Present at line 3 of playlist-state.ts | PASS |
| `version: z.literal(1)` | Present at line 6 | PASS |
| `enabled: z.boolean()` | Present at line 14 | PASS |
| `safeParse` in playlist-state.ts | 2 occurrences (parsePlaylistState + migrateOldKeys) | PASS |
| `migrateOldKeys()` in setup page | 1 occurrence (line 56) | PASS |
| `savePlaylistState` in setup page | 6 occurrences | PASS |
| `toggleCustom` in setup page | 2 occurrences (definition + onclick) | PASS |
| `shitster_custom_playlists` in setup/play pages | 0 | PASS |
| `shitster_selected_defaults` in setup/play pages | 0 | PASS |
| `customPlaylists.filter((p) => p.enabled)` | 4 occurrences in setup page | PASS |
| `enabled: true` in addCustomPlaylist | 1 | PASS |
| `stopPropagation` in setup page | 1 | PASS |
| `parsePlaylistState` in play page | 2 (import line + usage) | PASS |
| `songsPlayed += 1` | 1 | PASS |
| `songsPlayed = 0` | 1 (in clearHistory on success) | PASS |
| `clearPending` in play page | 10 occurrences | PASS |
| `clearPending` in setup page | 7 occurrences | PASS |
| `clearSuccess` in play page | 5 occurrences | PASS |
| `clearSuccess` in setup page | 4 occurrences | PASS |
| `Bekreft?` in play + setup pages | 2 (one each) | PASS |
| `Slettet!` in play + setup pages | 2 (one each) | PASS |
| `sang(er)? spilt` in play page | 2 (desktop hidden sm:block + mobile inside currentTrack block) | PASS |
| `alert(` in setup page | 0 | PASS |
| `window.confirm\|alert(` in setup page | 0 | PASS |
| `alert(` in play page | 3 (reauth-only — Phase 4 scope per deviation note) | PASS |
| `/api/spotify/history/clear` in play + setup | 1 each | PASS |
| `TØM HISTORIKK` in setup + play pages | 1 + 2 (desktop + mobile) | PASS |
| `onblur` cancels clearPending in play | 2 occurrences (desktop + mobile buttons) | PASS |
| `onblur` cancels clearPending in setup | 1 occurrence | PASS |

### Test Suite

| Suite | Command | Result | Status |
|-------|---------|--------|--------|
| playlist-state unit tests | `npx vitest run src/lib/config/playlist-state.test.ts` | 18/18 passed | PASS |
| TypeScript / Svelte check | `npx svelte-check --tsconfig ./tsconfig.json` | 0 errors, 0 warnings | PASS |

### Anti-Patterns Found

No TBD/FIXME/XXX/placeholder markers found in phase-modified files. The 3 `alert()` calls in play page are legitimate Phase 4 deferrals documented in PLAN 03-02 deviation note and ROADMAP Phase 4 SC-1 — not stubs.

### Human Verification Required

1. **Toggle persistence across reload**
   **Test:** Open /setup with empty localStorage. Toggle one default playlist off. Reload page.
   **Expected:** Toggled-off playlist remains deselected.
   **Why human:** localStorage state requires a live browser session.

2. **Old key migration**
   **Test:** Seed `shitster_custom_playlists` in localStorage via devtools (no `shitster_playlists`). Load /setup.
   **Expected:** Old key removed; `shitster_playlists` contains migrated data with `enabled:true` per entry.
   **Why human:** Requires devtools manipulation and browser reload.

3. **Custom playlist card visual parity + Fjern independence**
   **Test:** Add a custom playlist. Verify card visual matches default toggles. Click card — gradient toggles. Click Fjern — removes without toggling.
   **Expected:** Visual and interaction match the default playlist toggle cards.
   **Why human:** Visual appearance cannot be grepped.

4. **START SPILL disabled guard**
   **Test:** Disable all playlists on /setup. Re-enable one.
   **Expected:** Button disabled when zero enabled; enabled once at least one is active.
   **Why human:** Requires interactive browser.

5. **Songs-played counter**
   **Test:** Start game from /setup. Fetch a song. Counter shows "1 sang spilt". Fetch again — "2 sanger spilt".
   **Expected:** Counter increments on each successful fetch only.
   **Why human:** Requires live Spotify session.

6. **Double-press clear on play page**
   **Test:** Click TØM HISTORIKK once — "Bekreft?" in red. Tab away — reverts. Click twice quickly — "Slettet!", counter resets to 0.
   **Expected:** Full double-press UX works end-to-end including API call.
   **Why human:** Requires live browser session and authenticated API.

7. **Selections preserved on game end**
   **Test:** Start game, play a song, click AVSLUTT SPILL, return to /setup.
   **Expected:** Playlist selections from before game are still active.
   **Why human:** Requires full session flow.

8. **Double-press clear on setup page**
   **Test:** Same double-press flow as #6 on /setup.
   **Expected:** Identical UX; selections intact after clear.
   **Why human:** Requires interactive browser and live API.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are met by the code. All acceptance criteria grepped clean. Tests pass. TypeScript/Svelte check clean. The 3 remaining `alert()` calls in play page are in reauth branches explicitly scoped to Phase 4 (ROADMAP Phase 4 SC-1: "No alert() or window.confirm() calls remain").

---

_Verified: 2026-05-21T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
