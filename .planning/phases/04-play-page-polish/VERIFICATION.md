---
phase: 04-play-page-polish
verified: 2026-05-21T23:45:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Force re-auth banner on play page"
    expected: "Orange 'Spotify-økt utløpt' banner renders with 'Logg inn igjen' button. No browser alert. No automatic redirect. NESTE SANG button is disabled. Clicking button navigates to /auth/login/spotify."
    why_human: "Requires deleting spotifyTokens row for the test user or mocking 401 from /api/spotify/devices or /api/spotify/songs/random."
  - test: "Force 429 banner on play page"
    expected: "Yellow 'Spotify er overbelastet' banner renders with 'PRØV IGJEN' button. No browser alert. Clicking PRØV IGJEN clears the banner and retries getNextSong. No automatic retry loop."
    why_human: "Requires stubbing /api/spotify/songs/random to return HTTP 429, or triggering actual Spotify rate-limiting."
  - test: "TV readability at distance"
    expected: "NESTE SANG and VIS SANG buttons visibly larger than before (text-lg md:text-xl px-10 py-6). Songs counter readable at text-base on desktop. Flip card occupies more horizontal space (480px max-width)."
    why_human: "Visual regression — only observable in a rendered browser at party-viewing distance."
  - test: "Client-side URI validation on setup page"
    expected: "Pasting 'https://youtube.com/watch?v=abc' and clicking 'Legg til': red text 'Ugyldig Spotify-lenke. Lim inn en spillelistelenke fra Spotify.' appears below the input. Button stays 'Legg til' (no spinner). DevTools Network shows zero POST to /api/spotify/playlist/validate. Then pasting a valid 'https://open.spotify.com/playlist/37i9dQZF1DX...' and clicking 'Legg til' fires the server validate call normally."
    why_human: "Network-level check and UI timing requires a browser with DevTools open."
---

# Phase 04: Play Page Polish — Verification Report

**Phase Goal:** Polish the play page — fix server-side Spotify integration (rate limiting, token refresh), replace alert/goto error handling with inline banners, add client-side URI validation on setup page.
**Verified:** 2026-05-21T23:45:00Z
**Status:** HUMAN_NEEDED (all automated checks PASS — 4 items require browser testing)
**Re-verification:** No — initial verification

---

## Overall Verdict: PASS (automated) / HUMAN_NEEDED (4 browser checks pending)

All 7 requirement-level truths are satisfied by code evidence. No blockers. No stubs. No anti-patterns. Four items cannot be verified without a running browser session.

---

## Per-Requirement Check

### API-03 — Token refresh buffer widened to 5 minutes

**Truth:** `needsRefresh` threshold in `getSpotifyAccessToken` fires when fewer than 5 minutes remain (not 1 minute).

| Check | Result |
|-------|--------|
| `grep "5 \* 60 \* 1000" src/lib/server/spotify.ts` | 1 match — line 29 |
| Comment reads "Less than 5 minutes" | PASS |
| Bare `60 * 1000` no longer present outside that expression | PASS |
| Inline constant only (no named const) | PASS — matches D-03 |
| Commit 3f15863 | Exists, 1 insertion + 1 deletion |

**Status: VERIFIED**

---

### API-04 — 429 short-circuit in songs/random (server + client)

**Server truth:** When Spotify returns 429 on either the `totalResponse` or `windowResponse` fetch, the route returns HTTP 429 with `{ error: 'Rate limited by Spotify', rateLimited: true }` immediately — no further retry attempts.

| Check | Result |
|-------|--------|
| `totalResponse.status === 429` guard | 1 occurrence — line 96 |
| `windowResponse.status === 429` guard | 1 occurrence — line 126 |
| `rateLimited: true` in response body | 2 occurrences (one per guard) |
| `status: 429` in json response | 2 occurrences |
| `maxAttempts = 10` untouched | 1 occurrence — loop bound preserved |
| 401/403 paths unchanged | Both guards still present for both responses |
| Commit 08aaaa3 | Exists |

**Client truth:** `getNextSong()` checks `response.status === 429` before `!response.ok`, sets `rateLimited = true`, no auto-retry.

| Check | Result |
|-------|--------|
| `response.status === 429` check | 1 occurrence — line 107 |
| `rateLimited = true` | 1 occurrence — line 108 |
| `rateLimited = false` at getNextSong entry (D-01) | Line 93 |
| `rateLimited = false` in PRØV IGJEN handler | Line 311 |
| Yellow banner present | `bg-yellow-500/10 border border-yellow-500/50` — 1 occurrence |
| "PRØV IGJEN" button wired to `rateLimited = false; getNextSong()` | PASS |
| Commit a658fb1 | Exists |

**Status: VERIFIED (automated); browser confirmation in human checks**

---

### UI-01 — No alert() calls remain

| Check | Result |
|-------|--------|
| `grep -c "alert(" src/routes/play/+page.svelte` | 0 |
| Three former alert sites replaced with `requiresReauth = true; return;` | PASS — 3 occurrences of `requiresReauth = true` at lines 60, 116, 158 |

**Status: VERIFIED**

---

### UI-02 — Re-auth shown as inline banner, user-initiated redirect

| Check | Result |
|-------|--------|
| `requiresReauth = $state(false)` declared | 1 occurrence — line 11 |
| `requiresReauth = true` at all 3 former alert/goto sites | Lines 60 (onMount), 116 (getNextSong !ok), 158 (playSong !ok) |
| `goto('/auth/login/spotify')` count | Exactly 1 — the user-click CTA in the banner |
| Orange banner present | `bg-orange-500/10 border border-orange-500/50` — 1 occurrence |
| "Spotify-økt utløpt" copy | 1 occurrence |
| "Logg inn igjen" button | 1 occurrence |
| D-01 clearing at getNextSong entry | requiresReauth cleared on line 92 |
| D-02 NESTE SANG disable | `disabled={loading \|\| requiresReauth}` — 2 occurrences (lines 348, 436: NESTE SANG button and START FØRSTE SANG button) |

Note: The plan specified D-02 on NESTE SANG only, but the implementation also applies `disabled={loading || requiresReauth}` to the START FØRSTE SANG button in the "Klar til å spille!" slot. This is a minor scope expansion that is consistent with the intent (prevent any song fetch while re-auth is needed) and not a defect.

**Status: VERIFIED (automated); banner rendering confirmed in human checks**

---

### UI-03 — No console.log debug output

| Check | Result |
|-------|--------|
| `grep -c "console.log('data'" src/routes/play/+page.svelte` | 0 |
| `grep -c "console.log" src/routes/play/+page.svelte` | 0 |

**Status: VERIFIED**

---

### UI-04 — TV-readable layout

| Check | Result |
|-------|--------|
| `text-lg md:text-xl px-10 py-6` on buttons | 2 occurrences (VIS SANG + NESTE SANG) |
| Old class `text-base md:text-lg px-8 py-6` gone | 0 occurrences |
| Desktop songs counter at `text-base` | `text-base text-muted-foreground hidden sm:block` — 1 occurrence |
| `.perspective-card` max-width 480px | 1 occurrence |
| Old max-width 400px gone | 0 occurrences |

**Status: VERIFIED (automated); visual readability confirmed in human checks**

---

### PLAY-07 — Client-side URI validation on setup page

| Check | Result |
|-------|--------|
| `uriValidationError = $state('')` declared | 1 occurrence — line 29 |
| `isValidSpotifyPlaylistInput` function present | 1 occurrence — line 153 |
| Mirrors all 3 parseSpotifyPlaylistId formats | `spotify:playlist:` prefix check, `open.spotify.com/playlist/` URL check, `^[a-zA-Z0-9]{22}$` regex — all present |
| Call site in `addCustomPlaylist` | Line 180 |
| `addingPlaylist = true` AFTER validation gate | Line 186 > line 180 — PASS |
| Clearing both `errorMessage` and `uriValidationError` at entry | Lines 177–178 |
| Norwegian error string | "Ugyldig Spotify-lenke. Lim inn en spillelistelenke fra Spotify." — 1 occurrence |
| Template `{#if uriValidationError}` block with `text-sm text-destructive mt-1` | 1 occurrence |
| No `$lib/server/spotify` import in client file | 0 occurrences |
| Total `uriValidationError` references | 5 (declaration + 2 assignments + 2 template references) |
| Commit 9208750 | Exists |

Note: `open.spotify.com` appears twice in setup page — once in the validator function (line 160) and once in the `<Input>` placeholder text (line 346). Both are correct.

**Status: VERIFIED (automated); network behaviour confirmed in human checks**

---

## Artifact Status

| Artifact | Exists | Substantive | Wired | Status |
|----------|--------|-------------|-------|--------|
| `src/lib/server/spotify.ts` | Yes | 5-min buffer at line 29 | Called by songs/random via getSpotifyAccessToken | VERIFIED |
| `src/routes/api/spotify/songs/random/+server.ts` | Yes | Both 429 guards present | Returns HTTP 429 to client | VERIFIED |
| `src/routes/play/+page.svelte` | Yes | All state flags, banners, TV layout present | Inline banners driven by $state; PRØV IGJEN calls getNextSong | VERIFIED |
| `src/routes/setup/+page.svelte` | Yes | isValidSpotifyPlaylistInput + uriValidationError gate | Called before fetch in addCustomPlaylist | VERIFIED |

---

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| songs/random/+server.ts | client | `status: 429` + `{ rateLimited: true }` | WIRED — guard returns json with both |
| songs/random/+server.ts | client | `{ requiresReauth: true }` on SpotifyAuthError | WIRED — outer catch unchanged |
| play/+page.svelte getNextSong | /api/spotify/songs/random | `response.status === 429` check | WIRED — line 107 |
| play/+page.svelte banner CTA | /auth/login/spotify | `goto('/auth/login/spotify')` on user click | WIRED — 1 occurrence only |
| setup/+page.svelte addCustomPlaylist | isValidSpotifyPlaylistInput | early-return gate before fetch | WIRED — line 180 |
| setup/+page.svelte template | uriValidationError state | `{#if uriValidationError}` block | WIRED — line 360 |

---

## Anti-Patterns Scan

No `TBD`, `FIXME`, or `XXX` markers found in any of the four modified files.

Two minor items noted — neither is a blocker:

| File | Line | Pattern | Severity | Notes |
|------|------|---------|----------|-------|
| `src/routes/play/+page.svelte` | 142 | `errorMessage = 'Please select a device first'` | INFO | English string in `playSong()` when `deviceId` is null. Not covered by this phase's scope (plan 02 copywriting contract only touched the network-error copy, not the device-guard path). Not a regression — was English before this phase. |
| `src/routes/play/+page.svelte` | 205, 208 | `errorMessage = 'Failed to control playback'` | INFO | English strings in `togglePlayback()`. Same as above — out of scope for phase 04. |

Both items are pre-existing English strings in code paths not touched by this phase. They do not block the phase goal.

---

## Human Verification Required

### 1. Re-auth banner rendering

**Test:** With dev server running, delete the `spotifyTokens` row for your user (or intercept `/api/spotify/devices` to return `{ requiresReauth: true }`). Navigate to `/play`.
**Expected:** Orange "Spotify-økt utløpt" banner renders immediately. No `alert()` dialog. NESTE SANG button is disabled. Clicking "Logg inn igjen" navigates to `/auth/login/spotify`.
**Why human:** Requires manipulating DB state or network interception; cannot be verified by static analysis.

### 2. 429 rate-limit banner rendering and recovery

**Test:** Stub `/api/spotify/songs/random` to return HTTP 429 (e.g., intercept in DevTools or temporarily hardcode the response). Click NESTE SANG.
**Expected:** Yellow "Spotify er overbelastet. Vent litt og prøv igjen." banner appears. No browser alert. No automatic retry. Clicking "PRØV IGJEN" clears the banner and fires a new getNextSong request.
**Why human:** Requires network interception or actual Spotify rate-limiting.

### 3. TV readability at viewing distance

**Test:** Open `/play` on a desktop browser at 1.5m+ viewing distance (or zoom out to simulate distance). Compare button text size and card width with a screenshot from before the phase.
**Expected:** NESTE SANG and VIS SANG buttons noticeably larger (text-lg md:text-xl). Songs counter readable. Flip card wider (480px vs 400px).
**Why human:** Visual regression — pixels can be correct but rendering context matters.

### 4. Setup page URI validation — network behaviour

**Test:** Open `/setup`, paste `https://youtube.com/watch?v=abc` in the playlist input, click "Legg til". Open DevTools Network tab.
**Expected:** Red text "Ugyldig Spotify-lenke. Lim inn en spillelistelenke fra Spotify." appears below the input. Button stays "Legg til" (no spinner). Zero POST requests to `/api/spotify/playlist/validate` in Network tab. Then paste a valid `https://open.spotify.com/playlist/37i9dQZF1DX...` URL and click "Legg til" — the POST fires normally.
**Why human:** Network-level verification and button spinner timing require a live browser.

---

## Gaps Summary

No gaps. All 7 requirement truths verified by codebase evidence. Phase goal achieved.

---

_Verified: 2026-05-21T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
