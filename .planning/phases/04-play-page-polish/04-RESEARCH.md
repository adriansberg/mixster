# Phase 4: Play Page Polish - Research

**Researched:** 2026-05-21
**Domain:** SvelteKit / Svelte 5 UI state, Spotify API error handling, Tailwind CSS v4
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Clear ALL error state flags at top of `getNextSong()` — `requiresReauth = false; rateLimited = false;` alongside existing `errorMessage = ''`.
- **D-02:** NESTE SANG button disabled while `requiresReauth = true` — `disabled={loading || requiresReauth}`.
- **D-03:** Token refresh buffer inline constant — `const needsRefresh = expiresIn < 5 * 60 * 1000;` at `src/lib/server/spotify.ts:29`.

### Claude's Discretion

- `requiresReauth` and `rateLimited` state variable names (follow existing camelCase)
- 429 banner placement and "PRØV IGJEN" button behavior — follow UI-SPEC exactly
- URI validation regex pattern — use `parseSpotifyPlaylistId` logic as reference
- TV layout CSS tweaks — follow UI-SPEC values verbatim

### Deferred Ideas (OUT OF SCOPE)

- Server-side 429 retry with exponential backoff (v2, RES-03)
- `Retry-After` header countdown display (v2)
- Stale device auto-refresh on 404 (v2, RES-01)
- Private playlist 403 warning (v2, RES-02)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-03 | Token refresh buffer widened to 5 min | Line 29 of `spotify.ts` confirmed: `60 * 1000` → `5 * 60 * 1000` |
| API-04 | 429 rate limit handled gracefully — no silent retry storm | `songs/random` uses raw `fetch` in a loop; loop must short-circuit on 429. Current code uses `!totalResponse.ok` to `attempts++` — this loops silently on 429. Fix: check status before branching. |
| PLAY-07 | URI validation rejects invalid input client-side | `parseSpotifyPlaylistId` server logic is the reference. Client regex covers URI pattern and URL pattern. |
| UI-01 | All `alert()` calls replaced with inline error states | 3 confirmed instances: lines ~56–59, ~107–110, ~150–153 in `play/+page.svelte` |
| UI-02 | Re-auth prompt shown as inline banner — no hard redirect | Same 3 instances; replace `alert() + goto()` with `requiresReauth = true` |
| UI-03 | `console.log('data', data)` removed | Confirmed at line 61 in `play/+page.svelte` |
| UI-04 | Play page layout readable on TV at party distance | CSS changes: button text/padding, counter size, card max-width — exact values in UI-SPEC |
</phase_requirements>

---

## Summary

Phase 4 is a pure UI polish and resilience pass over `play/+page.svelte`, `src/lib/server/spotify.ts`, and `src/routes/setup/+page.svelte`. No new packages are installed. All patterns already exist in the codebase — this phase extends them.

The three `alert()` calls in `play/+page.svelte` are all in the same two patterns: `data.requiresReauth` check in `onMount` and `error.requiresReauth` checks in `getNextSong`/`playSong`. Both currently call `alert()` then `goto('/auth/login/spotify')`. The fix is identical in all three: set `requiresReauth = true`, let the template render the banner, user clicks the CTA to navigate.

The 429 handling gap is a silent loop: `songs/random` iterates up to 10 times, and when Spotify returns 429, `!totalResponse.ok` branches to `attempts++` and loops again — hammering the rate-limited endpoint. Fix: check `response.status === 429` explicitly before the generic `!ok` branch, return a structured `{ rateLimited: true }` JSON with status 429 to the client. Client checks `response.status === 429` and sets `rateLimited = true`.

**Primary recommendation:** All changes are surgical edits to three files. Follow the state priority order in UI-SPEC: `requiresReauth` > `rateLimited` > `errorMessage` > device selector.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Error display (re-auth, 429, generic) | Browser / Client | — | State flags + conditional template rendering; no server involvement |
| 429 detection | API / Backend | Browser / Client | Server detects status from Spotify, passes structured response; client sets flag |
| Token refresh buffer | API / Backend | — | `getSpotifyAccessToken()` runs server-side only |
| URI validation | Browser / Client | API / Backend | Client validates format before calling; server validates authoritatively |
| TV layout tweaks | Browser / Client | — | Tailwind class changes only |

---

## Standard Stack

### Core (no new installs — all pre-installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte 5 runes | `$state`, `$derived` | Reactive state for error flags | Project convention — no Svelte stores |
| SvelteKit | 2.x | Route handlers, `goto()` | Framework |
| Tailwind CSS v4 | 4.x | Utility classes for banner surfaces, TV sizing | Project design system |
| bits-ui Button | pre-installed | Banner CTAs (`variant="outline"`, `size="sm"`) | Pre-installed component library |

### No New Packages

This phase installs zero external dependencies. All tooling is already in `package.json`. [VERIFIED: direct codebase inspection]

---

## Package Legitimacy Audit

No packages to audit — Phase 4 installs no external dependencies.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User action (click NESTE SANG)
  └─→ getNextSong() [client]
        ├─ clear state: requiresReauth=false, rateLimited=false, errorMessage=''
        ├─ POST /api/spotify/songs/random [API route]
        │     ├─ Spotify 429 → return { rateLimited: true }, status 429
        │     ├─ SpotifyAuthError → return { requiresReauth: true }, status 401
        │     └─ OK → return { track: {...} }
        ├─ response.status === 429 → rateLimited = true → render yellow banner
        ├─ error.requiresReauth → requiresReauth = true → render orange banner
        └─ error.error → errorMessage = '...' → render red banner

Template display priority (single slot):
  requiresReauth → {:else if rateLimited} → {:else if errorMessage} → device selector
```

### Recommended File Structure (no changes to layout)

```
src/
├── routes/
│   ├── play/+page.svelte          # Primary target: state flags, banners, TV CSS
│   ├── setup/+page.svelte         # PLAY-07: client URI validation
│   └── api/spotify/
│       └── songs/random/+server.ts  # API-04: 429 pass-through
└── lib/server/
    └── spotify.ts                 # API-03: refresh buffer at line 29
```

### Pattern 1: Svelte 5 $state for error flags

**What:** Add two boolean state flags alongside existing `errorMessage`
**When to use:** Any mutually exclusive error condition with distinct display and recovery

```typescript
// Source: existing play/+page.svelte pattern — extended
let errorMessage = $state('');
let requiresReauth = $state(false);  // NEW
let rateLimited = $state(false);     // NEW
```

### Pattern 2: State priority in template (single display slot)

**What:** `{:else if}` chain respects priority; only one banner renders at a time

```svelte
<!-- Source: UI-SPEC state priority order -->
{#if requiresReauth}
  <div class="bg-orange-500/10 border border-orange-500/50 rounded-lg p-4">
    <p class="text-base font-semibold">Spotify-økt utløpt</p>
    <p class="text-sm text-muted-foreground">Logg inn på nytt for å fortsette.</p>
    <Button variant="outline" onclick={() => goto('/auth/login/spotify')}>Logg inn igjen</Button>
  </div>
{:else if rateLimited}
  <div class="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
    <p class="text-base">Spotify er overbelastet. Vent litt og prøv igjen.</p>
    <Button variant="outline" size="sm" onclick={() => { rateLimited = false; getNextSong(); }}>PRØV IGJEN</Button>
  </div>
{:else if errorMessage}
  <div class="p-4 md:p-6 rounded-lg bg-destructive/10 border border-destructive">
    <p class="text-destructive text-base">{errorMessage}</p>
  </div>
{:else if showDeviceSelector && availableDevices.length > 0}
  <!-- device selector -->
{/if}
```

### Pattern 3: 429 detection in songs/random server route

**What:** Explicit status check before the generic `!ok` branch to break the silent retry loop

```typescript
// Source: direct inspection of songs/random/+server.ts
// Current: if (!totalResponse.ok) { attempts++; continue; }
// Fixed:
if (totalResponse.status === 429) {
  return json({ error: 'Rate limited', rateLimited: true }, { status: 429 });
}
if (!totalResponse.ok) {
  attempts++;
  continue;
}
// Repeat same check for windowResponse
```

Client-side detection:
```typescript
// in getNextSong()
if (response.status === 429) {
  rateLimited = true;
  loading = false;
  return;
}
```

### Pattern 4: Client URI validation (PLAY-07)

**What:** Check input format before calling `/playlist/validate`; use same logic as server `parseSpotifyPlaylistId`

```typescript
// Reference: src/lib/server/spotify.ts parseSpotifyPlaylistId() (lines 182–208)
// Client-side equivalent (no import needed — inline function or regex):
function isValidSpotifyPlaylistInput(input: string): boolean {
  if (input.startsWith('spotify:playlist:')) return true;
  try {
    const url = new URL(input);
    if (url.hostname === 'open.spotify.com' && url.pathname.startsWith('/playlist/')) return true;
  } catch { /* not a URL */ }
  if (/^[a-zA-Z0-9]{22}$/.test(input)) return true;
  return false;
}
```

Inline validation state in setup page:
```typescript
let uriValidationError = $state('');  // NEW — separate from errorMessage (which covers server errors)
```

On submit: if `!isValidSpotifyPlaylistInput(playlistInput.trim())`, set `uriValidationError = 'Ugyldig Spotify-lenke...'` and return. Clear on next submit attempt.

Display: `<p class="text-destructive text-sm mt-1">{uriValidationError}</p>` below the Input.

### Pattern 5: Token buffer change (API-03)

Single character edit. Line 29 of `spotify.ts`:
```typescript
// Before:
const needsRefresh = expiresIn < 60 * 1000; // Less than 1 minute
// After:
const needsRefresh = expiresIn < 5 * 60 * 1000; // Less than 5 minutes
```

### Pattern 6: TV layout CSS changes (UI-04)

Exact values from UI-SPEC:

| Element | Current class | New class |
|---------|--------------|-----------|
| VIS SANG / NESTE SANG buttons | `text-base md:text-lg px-8 py-6` | `text-lg md:text-xl px-10 py-6` |
| Songs counter | `text-sm hidden sm:block` | `text-base hidden sm:block` |
| `.perspective-card` max-width | `max-w-400px` | `max-w-[480px]` |
| Banner body text | n/a (new) | `text-base` minimum |

### Anti-Patterns to Avoid

- **Clearing only `errorMessage` at start of getNextSong:** Also clear `requiresReauth` and `rateLimited` — D-01 is explicit.
- **Auto-redirecting on requiresReauth:** Never call `goto('/auth/login/spotify')` automatically. User clicks the CTA.
- **Auto-retrying on 429:** No setTimeout, no retry loop. User clicks "PRØV IGJEN".
- **Validating URI on keypress:** Validate only on submit attempt. Keypress validation causes false negatives mid-paste.
- **Separate display slot for each banner:** Single `{:else if}` chain, one slot, priority order enforced.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Banner button | Custom `<button>` element | `Button` from `$lib/components/ui/button` | Consistent focus, keyboard, sizing |
| URI format check | External validation library | Inline logic mirroring `parseSpotifyPlaylistId` | Already exists server-side; trivial to inline client-side without a dep |

---

## Runtime State Inventory

Not applicable — this is a UI polish phase with no rename/refactor/migration component.

---

## Common Pitfalls

### Pitfall 1: 429 loop in songs/random server route

**What goes wrong:** `windowResponse` also needs a 429 check. Only patching `totalResponse` leaves a second silent loop vector.
**Why it happens:** The route makes two sequential Spotify API calls per attempt (total fetch, then window fetch).
**How to avoid:** Add `status === 429` guard before `!ok` branch on BOTH `totalResponse` and `windowResponse`.
**Warning signs:** If rate-limited mid-window-fetch, the route currently loops 10 more times.

### Pitfall 2: requiresReauth not cleared between getNextSong calls

**What goes wrong:** User logs in again, returns to play page, banner still visible — because `requiresReauth` was never cleared.
**Why it happens:** Forgetting to add `requiresReauth = false` to the D-01 clearing block.
**How to avoid:** D-01 explicitly covers this. First line of `getNextSong()`: `requiresReauth = false; rateLimited = false; errorMessage = '';`.

### Pitfall 3: NESTE SANG button disabled incorrectly

**What goes wrong:** Button also disabled during `rateLimited` — but UI-SPEC requires the 429 banner to have its own "PRØV IGJEN" recovery button, so disabling NESTE SANG is optional for that state. D-02 only mandates `requiresReauth` disabling.
**Why it happens:** Overly broad `disabled` condition.
**How to avoid:** Keep `disabled={loading || requiresReauth}`. Do not add `|| rateLimited` unless explicitly decided.

### Pitfall 4: uriValidationError not cleared on valid submission

**What goes wrong:** User fixes URI, submits successfully, stale error message persists.
**Why it happens:** `errorMessage = ''` at top of `addCustomPlaylist()` clears server errors but not the client-side validation error.
**How to avoid:** Clear `uriValidationError = ''` at top of `addCustomPlaylist()` alongside `errorMessage = ''`.

### Pitfall 5: Device selector shown after requiresReauth banner

**What goes wrong:** Device selector renders simultaneously with re-auth banner — visual conflict.
**Why it happens:** `showDeviceSelector && availableDevices.length > 0` is not in the `{:else if}` chain.
**How to avoid:** Keep device selector as the final `{:else if}` in the priority chain. `requiresReauth` takes precedence.

---

## Code Examples

### Re-auth banner (complete)

```svelte
<!-- Source: UI-SPEC Phase 4 + existing Button import -->
{:else if requiresReauth}
  <div class="bg-orange-500/10 border border-orange-500/50 rounded-lg p-4 space-y-3">
    <p class="text-base font-semibold">Spotify-økt utløpt</p>
    <p class="text-sm text-muted-foreground">Logg inn på nytt for å fortsette.</p>
    <Button variant="outline" onclick={() => goto('/auth/login/spotify')}>Logg inn igjen</Button>
  </div>
```

### 429 banner (complete)

```svelte
<!-- Source: UI-SPEC Phase 4 -->
{:else if rateLimited}
  <div class="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 space-y-3">
    <p class="text-base">Spotify er overbelastet. Vent litt og prøv igjen.</p>
    <Button
      variant="outline"
      size="sm"
      onclick={() => { rateLimited = false; getNextSong(); }}
    >PRØV IGJEN</Button>
  </div>
```

### Updated getNextSong() skeleton

```typescript
// Source: existing play/+page.svelte + D-01 + API-04
async function getNextSong() {
  loading = true;
  errorMessage = '';
  requiresReauth = false;   // D-01
  rateLimited = false;       // D-01
  isRevealed = false;

  try {
    const response = await fetch('/api/spotify/songs/random', { ... });

    if (response.status === 429) {   // API-04
      rateLimited = true;
      return;
    }

    if (!response.ok) {
      const error = await response.json();
      if (error.requiresReauth) {    // UI-02
        requiresReauth = true;
        return;
      }
      errorMessage = error.error || 'Kunne ikke laste neste sang. Prøv igjen.';
      return;
    }

    const data = await response.json();
    currentTrack = data.track;
    songsPlayed += 1;
    if (currentTrack) await playSong(currentTrack.id);
  } catch {
    errorMessage = 'Kunne ikke laste neste sang. Prøv igjen.';
  } finally {
    loading = false;
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `alert()` for all errors | Inline Svelte state + conditional template rendering | Phase 4 | Eliminates browser dialogs in game context |
| 60s token refresh buffer | 5 min buffer | Phase 4 | Prevents mid-game token expiry during long rounds |
| Silent 429 retry loop | Explicit 429 → client banner → manual retry | Phase 4 | Stops Spotify rate-limit escalation |
| No client URI validation | Client regex pre-check before server call | Phase 4 | Immediate feedback on invalid paste |

**Nothing deprecated in this phase.** All changes extend existing patterns.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `play/+page.svelte` alert calls are at lines ~57, ~108, ~150 (approximate) | Architecture Patterns | Line numbers are approximate from read; exact lines differ by ≤5. Planner should find by text pattern, not line number. |
| A2 | `console.log('data', data)` is at line 61 | Phase Requirements / UI-03 | Confirmed by file read — LOW risk |

**All major claims verified by direct file inspection.** No package assumptions. UI-SPEC values copied verbatim.

---

## Open Questions

1. **429 on windowResponse vs totalResponse**
   - What we know: two raw Spotify fetches per attempt in the loop
   - What's unclear: should windowResponse 429 also return immediately or just increment attempts?
   - Recommendation: Return immediately on either 429 — both signal Spotify overload for the whole session, not just that request.

2. **Retry-After header**
   - UI-SPEC notes: "Read and display wait time if present: 'Prøv igjen om X sekunder.'"
   - What's unclear: This was marked deferred in `<deferred>` section but partially mentioned in interaction contracts
   - Recommendation: Planner should treat this as optional enhancement within the 429 banner task if trivial; skip if adds complexity.

---

## Environment Availability

Step 2.6: SKIPPED — phase is code/config edits only. No external tools, services, or CLIs required beyond existing SvelteKit dev server.

---

## Security Domain

Phase 4 adds no authentication flows, no new data inputs that reach the DB, and no new API endpoints. Applicable ASVS checks:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes (URI input) | Client regex + existing server `parseSpotifyPlaylistId` — no change to server validation |
| V2 Authentication | No new flows | Existing `SpotifyAuthError` pattern unchanged |
| V6 Cryptography | No | n/a |

No new threat surface introduced. The re-auth banner redirects to the existing `/auth/login/spotify` endpoint — no new auth logic.

---

## Sources

### Primary (HIGH confidence)

- Direct inspection: `src/routes/play/+page.svelte` — all 3 `alert()` calls, `console.log`, existing state pattern
- Direct inspection: `src/lib/server/spotify.ts` — line 29 token buffer, `parseSpotifyPlaylistId` at line 182
- Direct inspection: `src/routes/setup/+page.svelte` — `addCustomPlaylist()` flow, `errorMessage` pattern
- Direct inspection: `src/routes/api/spotify/songs/random/+server.ts` — 429 silent loop confirmed
- Direct inspection: `src/routes/api/spotify/devices/+server.ts` — `requiresReauth` response confirmed
- Direct inspection: `src/routes/api/spotify/player/play/+server.ts` — `requiresReauth` response confirmed
- `.planning/phases/04-play-page-polish/04-UI-SPEC.md` — design contract, exact class values, Norwegian copy
- `.planning/phases/04-play-page-polish/04-CONTEXT.md` — locked decisions D-01, D-02, D-03

### Secondary (MEDIUM confidence)

- None needed — all claims verified from codebase directly.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all verified in codebase
- Architecture: HIGH — all patterns confirmed by direct file reads
- Pitfalls: HIGH — all identified from actual code paths, not speculation
- UI values: HIGH — taken verbatim from 04-UI-SPEC.md

**Research date:** 2026-05-21
**Valid until:** Indefinite for this phase (stable tech, no external dependencies)
