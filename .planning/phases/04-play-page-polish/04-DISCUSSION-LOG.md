# Phase 4: Play Page Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 04-play-page-polish
**Areas discussed:** Error state lifecycle, Token refresh buffer

---

## Error state lifecycle

### Q1: When should re-auth/rate-limit banner clear?

| Option | Description | Selected |
|--------|-------------|----------|
| Clear immediately on press | Optimistic — banner disappears when user acts; re-shows if request fails again | |
| Clear only on success | Safe — banner stays during loading; slower feel but accurate | |
| You decide | Claude picks what fits existing pattern | ✓ |

**User's choice:** You decide
**Notes:** Claude decision: clear immediately (consistent with existing `errorMessage = ''` at top of `getNextSong()`). Add `requiresReauth = false; rateLimited = false;` alongside.

---

### Q2: Should NESTE SANG be disabled while requiresReauth is true?

| Option | Description | Selected |
|--------|-------------|----------|
| Disable NESTE SANG (recommended) | Makes re-auth flow obvious; prevents confusing double-error | ✓ |
| Keep NESTE SANG enabled | User can retry without re-authing if banner was transient fluke | |

**User's choice:** Disable NESTE SANG (recommended)
**Notes:** `disabled={loading || requiresReauth}`

---

## Token refresh buffer

### Q1: Naming preference for the 5-min buffer constant?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline constant (recommended) | `expiresIn < 5 * 60 * 1000` — minimal change | ✓ |
| Named constant | `const REFRESH_BUFFER_MS = 5 * 60 * 1000` at top of file | |

**User's choice:** Inline constant (recommended)
**Notes:** Single-line change at `src/lib/server/spotify.ts:29`

---

## Claude's Discretion

- Error banner clearing behavior — user picked "You decide" → clear optimistically at start of action
- `requiresReauth` and `rateLimited` variable names — follow camelCase convention
- 429 banner implementation details — follow UI-SPEC exactly
- URI validation regex — use `parseSpotifyPlaylistId` logic as reference

## Areas not discussed (covered by UI-SPEC)

User skipped "429 scope" and "URI validation approach" — both are fully specified in `04-UI-SPEC.md`:
- 429: client-side banner only, no server-side retry, manual "PRØV IGJEN" button
- URI validation: client regex first, then server validates authoritatively

## Deferred Ideas

- Server-side 429 retry with exponential backoff → v2
- `Retry-After` header countdown display → v2
- Stale device auto-refresh → v2, RES-01
- Private playlist 403 warning → v2, RES-02
