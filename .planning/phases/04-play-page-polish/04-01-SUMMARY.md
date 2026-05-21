---
phase: 04-play-page-polish
plan: "01"
subsystem: spotify-server
tags: [spotify, rate-limit, token-refresh, server]
requirements: [API-03, API-04]

dependency_graph:
  requires: []
  provides: [429-short-circuit, 5min-token-buffer]
  affects: [src/lib/server/spotify.ts, src/routes/api/spotify/songs/random/+server.ts]

tech_stack:
  added: []
  patterns: [inline-constant, status-guard-chain]

key_files:
  modified:
    - src/lib/server/spotify.ts
    - src/routes/api/spotify/songs/random/+server.ts

decisions:
  - "No named constant for refresh buffer (D-03 — inline only per plan)"
  - "No Retry-After parsing on 429 — deferred to v2 per plan scope"
  - "Static error string 'Rate limited by Spotify' chosen as canonical telemetry value"

metrics:
  duration: "~8 min"
  completed: "2026-05-21"
  tasks_completed: 2
  files_modified: 2
---

# Phase 4 Plan 1: Spotify Server Hardening Summary

**One-liner:** 5-minute token refresh buffer + immediate 429 short-circuit on both Spotify fetches in songs/random retry loop.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Widen token refresh buffer to 5 minutes (API-03) | 3f15863 | src/lib/server/spotify.ts |
| 2 | Add 429 short-circuit guards to songs/random (API-04 server) | 08aaaa3 | src/routes/api/spotify/songs/random/+server.ts |

## What Was Built

**Task 1 — Token refresh buffer (API-03):**
Changed `needsRefresh` threshold at `spotify.ts:29` from `60 * 1000` to `5 * 60 * 1000` inline (no named constant per D-03). Comment updated to "Less than 5 minutes". Single-line change, exactly 1 insertion + 1 deletion.

**Task 2 — 429 short-circuit (API-04 server):**
Inserted `status === 429` guard branch immediately after the existing `status === 403` branch in both Spotify fetch blocks inside the `while (attempts < maxAttempts)` loop. Each guard returns `json({ error: 'Rate limited by Spotify', rateLimited: true }, { status: 429 })` immediately — no `attempts++`, no `continue`, no retry. The client contract (`status: 429` + `{ rateLimited: true }`) is consumed by Plan 02 (Wave 2, client-side handler).

## Verification Evidence

```
grep -c "5 * 60 * 1000" src/lib/server/spotify.ts        → 1
grep -c "// Less than 5 minutes" src/lib/server/spotify.ts → 1
grep -c "totalResponse.status === 429" ...random/+server.ts → 1
grep -c "windowResponse.status === 429" ...random/+server.ts → 1
grep -c "status: 429" ...random/+server.ts                 → 2
grep -c "rateLimited: true" ...random/+server.ts           → 2
grep -c "maxAttempts = 10" ...random/+server.ts            → 1 (untouched)
git diff --stat src/lib/server/spotify.ts → 1 file, 1 insertion, 1 deletion
```

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Existing T-04-01-01 and T-04-01-04 threats mitigated as planned.

## Self-Check: PASSED

- src/lib/server/spotify.ts: present, 1 line changed
- src/routes/api/spotify/songs/random/+server.ts: present, 6 lines added
- Commit 3f15863: verified in git log
- Commit 08aaaa3: verified in git log
- tsc errors: pre-existing (.svelte-kit/tsconfig.json missing) — not caused by these changes, confirmed by stash test
