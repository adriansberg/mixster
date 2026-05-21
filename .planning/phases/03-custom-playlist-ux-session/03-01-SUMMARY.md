---
phase: 03-custom-playlist-ux-session
plan: 01
subsystem: playlist-state
tags: [svelte, zod, localStorage, schema-migration, tdd]
dependency_graph:
  requires: []
  provides: [playlist-state-schema, setup-page-migration]
  affects: [src/routes/play/+page.svelte]
tech_stack:
  added: [vitest@4.1.7]
  patterns: [zod-safeparse-silent-fallback, localStorage-consolidated-schema, tdd-red-green]
key_files:
  created:
    - src/lib/config/playlist-state.ts
    - src/lib/config/playlist-state.test.ts
  modified:
    - src/routes/setup/+page.svelte
    - package.json
    - pnpm-lock.yaml
decisions:
  - "Zod safeParse with DEFAULT_PLAYLIST_STATE fallback — never throws on corrupted localStorage"
  - "migrateOldKeys always removes old keys even if malformed, prevents corruption persistence"
  - "savePlaylistState() called on init (idempotent canonical write) + every toggle/add/remove"
  - "First-time users (null key) get all defaults pre-selected at page level, not inside helper"
  - "vitest installed via pnpm (npm install fails due to pnpm lockfile conflict)"
metrics:
  duration: ~5min
  completed_date: "2026-05-21"
  tasks_completed: 2
  files_changed: 5
---

# Phase 3 Plan 1: Playlist State Schema + Setup Page Migration Summary

Consolidated localStorage playlist state into a single Zod-validated `mixster_playlists` schema, with one-time migration from old keys and full enable/disable toggle parity for custom playlists on the setup page.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create playlist-state schema module (RED) | 4715abd | src/lib/config/playlist-state.test.ts |
| 1 | Create playlist-state schema module (GREEN) | dffe77a | src/lib/config/playlist-state.ts |
| 2 | Migrate setup page to consolidated schema | 58bcdde | src/routes/setup/+page.svelte |

## What Was Built

**`src/lib/config/playlist-state.ts`** — new module exporting:
- `STORAGE_KEY = 'mixster_playlists'`
- `PlaylistStateSchema` — Zod schema with `version: 1`, `defaultSelected: string[]`, `custom: [{id, name, uri, trackCount, enabled}]`
- `DEFAULT_PLAYLIST_STATE` — `{version:1, defaultSelected:[], custom:[]}`
- `parsePlaylistState(raw)` — silent fallback on any parse/validation failure
- `migrateOldKeys()` — SSR-safe one-time migration from old `mixster_custom_playlists` + `mixster_selected_defaults` keys

**`src/routes/setup/+page.svelte`** — refactored to:
- Import and use `parsePlaylistState`, `migrateOldKeys`, `STORAGE_KEY`
- Restore selections from `mixster_playlists` on load (first-time: all defaults)
- `savePlaylistState()` helper writes on every toggle, add, remove
- `toggleCustom(id)` — new handler flips `enabled` field + persists
- Custom playlist cards now match default toggle visual (gradient active state)
- Fjern button always visible, `stopPropagation` prevents toggle-on-remove
- START SPILL disabled when `selectedDefaults.length + enabledCustoms.length === 0`
- Old keys `mixster_custom_playlists` and `mixster_selected_defaults` fully removed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] vitest not installed**
- **Found during:** Task 1 setup (TDD RED phase)
- **Issue:** `npx vitest` not found; `package.json` has no test runner; `npm install` fails due to pnpm lockfile conflict
- **Fix:** Installed `vitest@4.1.7` via `pnpm add -D vitest`
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Commit:** included in 4715abd

## Verification

- `npx tsc --noEmit` — passes (exit 0)
- `npx vitest run src/lib/config/playlist-state.test.ts` — 18 tests pass
- Acceptance criteria grepping: all pass
  - `STORAGE_KEY = 'mixster_playlists'`: 1
  - `version: z.literal(1)`: 1
  - `enabled: z.boolean()`: 1
  - `safeParse` count: 2
  - `migrateOldKeys()` in setup page: 1
  - `savePlaylistState` in setup page: 6
  - `toggleCustom` in setup page: 2
  - `mixster_custom_playlists` in setup page: 0 (gone)
  - `mixster_selected_defaults` in setup page: 0 (gone)
  - `customPlaylists.filter((p) => p.enabled)`: 4
  - `enabled: true` in addCustomPlaylist: 1
  - `stopPropagation`: 1

## TDD Gate Compliance

- RED gate: commit `4715abd` — `test(03-01): add failing tests for playlist-state schema module`
- GREEN gate: commit `dffe77a` — `feat(03-01): implement playlist-state schema module`
- All 18 tests pass after GREEN implementation

## Known Stubs

None.

## Threat Flags

None — all localStorage-facing surfaces use Zod `safeParse` with silent fallback per T-03-01-01.

## Self-Check: PASSED

- `src/lib/config/playlist-state.ts` exists: FOUND
- `src/lib/config/playlist-state.test.ts` exists: FOUND
- `src/routes/setup/+page.svelte` modified: FOUND
- Commits 4715abd, dffe77a, 58bcdde: all present in git log
