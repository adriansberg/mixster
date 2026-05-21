---
phase: 04-play-page-polish
plan: "03"
subsystem: setup-ui
tags: [svelte, validation, setup, ui, client-side]
dependency_graph:
  requires: []
  provides: [PLAY-07]
  affects: [src/routes/setup/+page.svelte]
tech_stack:
  added: []
  patterns: [svelte5-runes, client-side-validation-gate]
key_files:
  created: []
  modified:
    - src/routes/setup/+page.svelte
decisions:
  - "Client validator mirrors parseSpotifyPlaylistId exactly (3 formats) — no import from $lib/server/spotify (server-only path)"
  - "Validation on submit only — no oninput/blur to avoid false negatives mid-paste"
  - "uriValidationError is a separate $state from errorMessage — server errors keep their own surface"
  - "addingPlaylist = true moved below validation gate — button never shows spinner for invalid input"
metrics:
  duration: "~5 min"
  completed: "2026-05-21"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 4 Plan 03: Client-Side URI Validation Gate Summary

Client-side Spotify playlist URI/URL/22-char-ID format validation added to setup page, short-circuiting invalid submits before the network round-trip.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add client-side Spotify URI validation gate (PLAY-07) | 9208750 | src/routes/setup/+page.svelte |

## What Was Built

Single-file change to `src/routes/setup/+page.svelte`:

- `uriValidationError = $state('')` — new state variable, distinct from `errorMessage`
- `isValidSpotifyPlaylistInput(input: string): boolean` — local helper mirroring `parseSpotifyPlaylistId`; accepts `spotify:playlist:*`, `https://open.spotify.com/playlist/*`, and 22-char base62 IDs
- `addCustomPlaylist()` entry block: clears both `errorMessage` and `uriValidationError`, then gates on validator before setting `addingPlaylist = true` or firing fetch
- Template: `{#if uriValidationError}` block with `text-sm text-destructive mt-1` below existing `{#if errorMessage}` block

## Verification

All acceptance criteria passed:
- `uriValidationError` declaration: 1 occurrence
- `isValidSpotifyPlaylistInput` function: 1 occurrence
- Call site `isValidSpotifyPlaylistInput(playlistInput.trim())`: 1 occurrence
- Norwegian error string: 1 occurrence
- `uriValidationError` total references: 5 (declaration + 2 assignments + 2 template)
- `text-sm text-destructive mt-1`: 1 occurrence
- No `$lib/server/spotify` import: 0 occurrences
- `addingPlaylist = true` line (186) after validation gate call (180): ordering correct
- `npx tsc --noEmit`: exit 0
- `npx prettier --check`: exit 0
- `npx eslint`: exit 0

## Deviations from Plan

None — plan executed exactly as written. Prettier auto-formatted the long error string assignment across two lines; this is cosmetic and correct.

## Known Stubs

None.

## Threat Flags

None. No new network endpoints or trust boundaries introduced. T-04-03-02 mitigation (URL constructor in try/catch) confirmed present in implementation.

## Self-Check: PASSED

- `src/routes/setup/+page.svelte` exists and contains all required elements
- Commit `9208750` present in git log
