# Phase 3: Custom Playlist UX + Session - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 03-custom-playlist-ux-session
**Areas discussed:** Playlist toggle persistence, Custom playlist enable/disable, Songs-played counter, History clear inline confirmation

---

## Playlist Toggle Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Live — write on every toggle | Every click writes to localStorage immediately | ✓ |
| At game start only | State persists only when START SPILL clicked | |
| You decide | Claude picks | |

**User's choice:** Live persistence on every toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — read savedDefaults from localStorage on load | Setup page restores selections on load | ✓ |
| No — always start with all defaults selected | Current behavior | |

**User's choice:** Read savedDefaults from localStorage on setup page load

| Option | Description | Selected |
|--------|-------------|----------|
| Consolidate into single versioned key | `shitster_playlists` with Zod validation | ✓ |
| Keep scattered keys, just fix persistence | Simpler, misses PLAY-05 | |

**User's choice:** Consolidate into single `shitster_playlists` key

**Notes:** Track counts cache stays separate. Schema: `{ version: 1, defaultSelected: string[], custom: [{id, name, uri, trackCount, enabled}] }`.

---

## Custom Playlist Enable/Disable

| Option | Description | Selected |
|--------|-------------|----------|
| Same as defaults — click card to toggle | Custom rows become clickable cards with gradient border | ✓ |
| Separate toggle switch on each row | Explicit switch, different pattern from defaults | |
| You decide | Claude picks | |

**User's choice:** Same toggle UX as default playlists

| Option | Description | Selected |
|--------|-------------|----------|
| Both — block START SPILL + skip disabled in songs/random | Double guard | ✓ |
| Only skip in song selection | Allow start even if nothing enabled | |

**User's choice:** Both guards

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible on the card | Fjern button always present | ✓ |
| Only show on hover | Hover-only for cleaner look | |
| You decide | Claude picks | |

**User's choice:** Always visible

**Notes:** Custom playlist cards use same visual pattern as default toggles. Fjern button is a small secondary action on the card.

---

## Songs-Played Counter

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side in play page state | $state counter, increments per song, resets on clear | ✓ |
| Server-side — count from DB | Accurate across reloads, needs API addition | |

**User's choice:** Client-side $state counter

| Option | Description | Selected |
|--------|-------------|----------|
| In the header bar next to 'shitster' | Small "X sanger spilt" text in top bar | ✓ |
| Below the card, above controls | More prominent, more vertical clutter | |
| You decide | Claude places it | |

**User's choice:** Header bar placement

**Notes:** Counter resets to 0 on history clear. "X sanger spilt" text is small, always visible.

---

## History Clear Inline Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Double-press — button text changes on first click | First click → "Bekreft?" (red), second click → confirm | ✓ |
| Inline expand — button reveals confirm/cancel row | Explicit but layout shift | |
| You decide | Claude picks | |

**User's choice:** Double-press pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Play page only | Button already exists there | |
| Both pages | Add to setup page too per SESS-01 | ✓ |

**User's choice:** Both pages

| Option | Description | Selected |
|--------|-------------|----------|
| Inline success state — button shows "Slettet!" briefly | Button text for ~2 seconds, then reverts | ✓ |
| Persistent inline message below the button | Stays until next action | |
| You decide | Claude picks | |

**User's choice:** Brief "Slettet!" on the button, then reverts

**Notes:** Cancel via click-outside or any other interaction. No `window.confirm()`.

---

## Claude's Discretion

None — user made a clear choice in all areas.

## Deferred Ideas

- `alert()` → inline errors for reauth → Phase 4, UI-01/02
- Rate limit (429) inline handling → Phase 4, API-04
- Private playlist 403 warning → v2, RES-02
- Stale device auto-refresh → v2, RES-01
- Token refresh singleton → v2, RES-03
