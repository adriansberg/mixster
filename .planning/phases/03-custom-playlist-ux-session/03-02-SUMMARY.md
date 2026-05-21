---
phase: 03-custom-playlist-ux-session
plan: 02
subsystem: play-session-ux
tags: [svelte, session, counter, inline-confirm, localStorage]
dependency_graph:
  requires: [03-01]
  provides: [play-page-schema-integration, songs-played-counter, double-press-clear]
  affects: [src/routes/play/+page.svelte, src/routes/setup/+page.svelte]
tech_stack:
  added: []
  patterns: [double-press-inline-confirm, rune-state-counter, localStorage-schema-consumer]
key_files:
  created: []
  modified:
    - src/routes/play/+page.svelte
    - src/routes/setup/+page.svelte
decisions:
  - "clearPending reset to false before fetch so rapid third click requires fresh double-press"
  - "songsPlayed increments after currentTrack assignment — not after playSong call"
  - "endGame removes shitster_session_id only; shitster_playlists untouched (D-15)"
  - "Spillhistorikk section reuses errorMessage state from setup page — no new state"
metrics:
  duration: ~8min
  completed_date: "2026-05-21"
  tasks_completed: 2
  files_changed: 2
---

# Phase 3 Plan 2: Session UX — Counter + Double-Press Clear Summary

Play page consumes consolidated `shitster_playlists` schema with enabled-only custom filtering, songs-played counter in header, and inline double-press TØM HISTORIKK on both play and setup pages — no alert() or window.confirm() anywhere in the clear flow.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire play page to consolidated schema + counter + double-press clear | 890025f | src/routes/play/+page.svelte |
| 2 | Add double-press TØM HISTORIKK button to setup page | 2bca905 | src/routes/setup/+page.svelte |

## What Was Built

**`src/routes/play/+page.svelte`** — refactored to:
- Import `parsePlaylistState`, `STORAGE_KEY` from `$lib/config/playlist-state`
- `onMount` reads `shitster_playlists`, populates `selectedDefaults` and `customPlaylistUris` (enabled customs only — D-06)
- `customPlaylistUris` cached in `$state` — not re-read on every `getNextSong` call
- `songsPlayed` counter: increments after `currentTrack = data.track` on success, resets to 0 on successful clear
- Header shows `X sang spilt` / `X sanger spilt` (desktop: `hidden sm:block`, mobile bottom bar)
- `clearHistory()` double-press: first click sets `clearPending=true`; second click POSTs, shows `Slettet!` for 2s, resets counter
- `onblur` cancels pending confirmation
- `endGame` removes `shitster_session_id` only — `shitster_playlists` preserved
- Old keys `shitster_selected_defaults` and `shitster_custom_playlists` fully removed
- All 2 original `alert()` calls in clearHistory removed (the plan spec expected 3 reauth alerts to remain, but those did not exist in the actual source — see deviation note)

**`src/routes/setup/+page.svelte`** — additions:
- `clearPending` and `clearSuccess` `$state` variables
- `clearHistory()` function with identical double-press pattern to play page
- New "Spillhistorikk" section between Custom Playlists and Start Button
- TØM HISTORIKK button with variant toggle, onblur cancel, Bekreft?/Slettet! feedback
- `errorMessage` shared with existing form error display (no new state)
- No `window.confirm()` or `alert()` anywhere

## Deviations from Plan

### Plan Spec Discrepancy — No Auto-Fix Needed

**1. [Rule 1 - Discrepancy] Plan expected 3 reauth alert() calls to remain in play page**
- **Found during:** Task 1 acceptance criteria check
- **Issue:** Plan specified `grep -c "alert(" returns exactly 3` (3 reauth alerts at lines ~50, ~109, ~151 preserved). Actual source file had only 2 `alert()` calls, both in the old `clearHistory()` function — no reauth alerts existed at those lines.
- **Fix:** Removed both clearHistory alerts as specified. Result is 0 alerts (correct). The criterion `returns exactly 3` was based on a stale view of the file.
- **Impact:** None — zero alerts is the desired end state. Phase 4 has no reauth alerts to clean up.

## Verification

- `svelte-check --tsconfig ./tsconfig.json` — 0 errors, 0 warnings (both tasks)
- `grep -c "alert(" src/routes/play/+page.svelte` → 0 (all alerts removed)
- `grep -cE "window\.confirm|alert\(" src/routes/setup/+page.svelte` → 0
- `grep -c "shitster_selected_defaults|shitster_custom_playlists" play/+page.svelte setup/+page.svelte` → 0 (old keys gone)
- `grep -c "parsePlaylistState" src/routes/play/+page.svelte` → 2 (import + usage)
- `grep -c "clearPending" src/routes/play/+page.svelte` → 10 (well above minimum 4)
- `grep -c "clearPending" src/routes/setup/+page.svelte` → 7 (well above minimum 4)
- `grep -c "sanger spilt\|sang spilt" src/routes/play/+page.svelte` → 2 (desktop + mobile)

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. All localStorage reads use `parsePlaylistState` (Zod-validated with silent fallback per T-03-02-01).

## Self-Check: PASSED

- `src/routes/play/+page.svelte` modified: FOUND
- `src/routes/setup/+page.svelte` modified: FOUND
- Commit 890025f (Task 1): FOUND
- Commit 2bca905 (Task 2): FOUND
