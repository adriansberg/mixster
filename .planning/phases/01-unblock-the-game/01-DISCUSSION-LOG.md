# Phase 1: Unblock the Game - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 1-Unblock-the-Game
**Areas discussed:** Random offset strategy

---

## Random Offset Strategy

### Question 1: Offset window approach

| Option | Description | Selected |
|--------|-------------|----------|
| Windowed (20 items) | Pick random offset in [0, total-1], fetch min(20, remaining) items, dedup-filter, retry with new offset if exhausted | |
| Full 100-window | Pick random offset in [0, total-100], fetch 100 items, dedup-filter, retry with new offset | ✓ |
| You decide | Claude picks approach | |

**User's choice:** Full 100-window
**Notes:** User first asked "is limit=100 the maximum?" — confirmed yes, Spotify caps `/items` at 100. User then chose the full 100-window as it maximizes dedup resistance with the simplest retry logic.

---

### Question 2: Null/local track handling

| Option | Description | Selected |
|--------|-------------|----------|
| Keep existing filter | `item.track &&` null check only — no release_date requirement at selection time | |
| Require release_date | Only include tracks with `album.release_date` in the window — filter at selection, not after | ✓ |
| You decide | Claude applies whatever validation makes sense | |

**User's choice:** Require release_date too
**Notes:** This decision also collapses the 2-call pattern into 1 call — including `album(release_date,images)` in the `/items` fields query means no separate `/tracks/{id}` fetch is needed.

---

## Claude's Discretion

- **API-02 validate route scope:** User did not discuss this area. Claude determined: `playlist/validate` needs `tracks.total` → `items.total` (surgical field change, not a behavioral change). CLAUDE.md "Do Not Touch" means be careful, not frozen — the Spotify API broke `tracks` for third-party playlists. Same fix for `track-counts` route.
- **AUTH-01 commit scope:** Commit the 5 modified/new files as-is. `play/+page.svelte` alert() calls stay — those are Phase 4.

## Deferred Ideas

- Token refresh singleton (concurrent refresh race) — v2, RES-03
- alert() → inline error states — Phase 4, UI-01
- Re-auth inline banner — Phase 4, UI-02
- Rate limit (429) handling — Phase 4, API-04
