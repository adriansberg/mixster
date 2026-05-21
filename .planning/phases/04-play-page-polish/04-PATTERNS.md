# Phase 4: Play Page Polish - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 4
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/routes/play/+page.svelte` | component | request-response | `src/routes/setup/+page.svelte` | exact (same runes + fetch + error state pattern) |
| `src/lib/server/spotify.ts` | utility | request-response | self (line 29) | self-edit |
| `src/routes/setup/+page.svelte` | component | request-response | `src/routes/play/+page.svelte` | exact (same errorMessage + form submit pattern) |
| `src/routes/api/spotify/songs/random/+server.ts` | route handler | request-response | `src/routes/api/spotify/songs/random/+server.ts` (existing 401/403 guards) | self-edit |

---

## Pattern Assignments

### `src/routes/play/+page.svelte` (component, request-response)

**Analog:** self — extend existing patterns in place

**Existing state declaration pattern** (lines 7–19):
```typescript
let currentTrack: Track | null = $state(null);
let isRevealed = $state(false);
let loading = $state(false);
let errorMessage = $state('');
// ... other $state declarations
```
Add two new flags immediately after `errorMessage`:
```typescript
let requiresReauth = $state(false);
let rateLimited = $state(false);
```

**Existing error-clear pattern at top of async action** (line 89, `getNextSong`):
```typescript
loading = true;
errorMessage = '';
isRevealed = false;
```
Extend to (D-01):
```typescript
loading = true;
errorMessage = '';
requiresReauth = false;
rateLimited = false;
isRevealed = false;
```

**Existing alert+goto pattern to replace** (lines 55–58, onMount):
```typescript
if (data.requiresReauth) {
    alert('Your Spotify session has expired. Please log in again.');
    goto('/auth/login/spotify');
    return;
}
```
Replace with:
```typescript
if (data.requiresReauth) {
    requiresReauth = true;
    return;
}
```
Same replacement applies at lines ~107–110 (`getNextSong`) and ~150–153 (`playSong`).

**Existing `!response.ok` branch in `getNextSong`** (lines 103–115):
```typescript
if (!response.ok) {
    const error = await response.json();
    if (error.requiresReauth) {
        alert('...');
        goto('/auth/login/spotify');
        return;
    }
    errorMessage = error.error || 'Failed to get next song';
    return;
}
```
Replace with (also add 429 check BEFORE the `!ok` check):
```typescript
if (response.status === 429) {
    rateLimited = true;
    return;
}
if (!response.ok) {
    const error = await response.json();
    if (error.requiresReauth) {
        requiresReauth = true;
        return;
    }
    errorMessage = error.error || 'Kunne ikke laste neste sang. Prøv igjen.';
    return;
}
```

**Existing NESTE SANG button `disabled` pattern** (line 396):
```svelte
disabled={loading}
```
Extend to (D-02):
```svelte
disabled={loading || requiresReauth}
```
Same extension applies to VIS SANG button (line 387) — but `requiresReauth` disabling only mandated on NESTE SANG per D-02.

**console.log to remove** (line 61):
```typescript
console.log('data', data);
```
Delete this line entirely.

**Existing error display block** (lines 295–300, template):
```svelte
{:else if errorMessage}
    <div class="p-4 md:p-6 rounded-lg bg-destructive/10 border border-destructive space-y-2">
        <p class="text-destructive">{errorMessage}</p>
    </div>
```
Replace the entire `{#if showDeviceSelector ...}{:else if errorMessage}` block with the priority chain (requiresReauth > rateLimited > errorMessage > device selector):
```svelte
{#if requiresReauth}
    <div class="bg-orange-500/10 border border-orange-500/50 rounded-lg p-4 space-y-3">
        <p class="text-base font-semibold">Spotify-økt utløpt</p>
        <p class="text-sm text-muted-foreground">Logg inn på nytt for å fortsette.</p>
        <Button variant="outline" onclick={() => goto('/auth/login/spotify')}>Logg inn igjen</Button>
    </div>
{:else if rateLimited}
    <div class="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 space-y-3">
        <p class="text-base">Spotify er overbelastet. Vent litt og prøv igjen.</p>
        <Button
            variant="outline"
            size="sm"
            onclick={() => { rateLimited = false; getNextSong(); }}
        >PRØV IGJEN</Button>
    </div>
{:else if errorMessage}
    <div class="p-4 md:p-6 rounded-lg bg-destructive/10 border border-destructive space-y-2">
        <p class="text-destructive text-base">{errorMessage}</p>
    </div>
{:else if showDeviceSelector && availableDevices.length > 0}
    <!-- existing device selector block unchanged -->
```

**TV layout CSS targets** (UI-04):

VIS SANG / NESTE SANG buttons — lines 387 and 396 class attribute:
```
current:  text-base md:text-lg px-8 py-6
new:      text-lg md:text-xl px-10 py-6
```

Songs counter — line 253:
```
current:  text-sm hidden sm:block
new:      text-base hidden sm:block
```

`.perspective-card` max-width — `<style>` block line 433:
```css
/* current */
max-width: 400px;
/* new */
max-width: 480px;
```

---

### `src/lib/server/spotify.ts` (utility, request-response)

**Analog:** self — single-line edit at line 29

**Current token buffer** (line 29):
```typescript
const needsRefresh = expiresIn < 60 * 1000; // Less than 1 minute
```
Change to (D-03):
```typescript
const needsRefresh = expiresIn < 5 * 60 * 1000; // Less than 5 minutes
```

**`parseSpotifyPlaylistId` — reference for client-side URI validation** (lines 182–208):
```typescript
export function parseSpotifyPlaylistId(input: string): string | null {
    if (input.startsWith('spotify:playlist:')) {
        return input.split(':')[2];
    }
    try {
        const url = new URL(input);
        if (url.hostname === 'open.spotify.com' && url.pathname.startsWith('/playlist/')) {
            const id = url.pathname.split('/')[2];
            return id?.split('?')[0] ?? null;
        }
    } catch { /* not a URL */ }
    if (/^[a-zA-Z0-9]{22}$/.test(input)) {
        return input;
    }
    return null;
}
```
Mirror this logic inline on the client (no import — client cannot import server modules).

---

### `src/routes/setup/+page.svelte` (component, request-response)

**Analog:** self — add `uriValidationError` state and inline validation before `addCustomPlaylist()`

**Existing state + error pattern** (lines 26–32):
```typescript
let playlistInput = $state('');
let addingPlaylist = $state(false);
let errorMessage = $state('');
```
Add after `errorMessage`:
```typescript
let uriValidationError = $state('');
```

**Existing `addCustomPlaylist` entry** (lines 152–156):
```typescript
async function addCustomPlaylist() {
    if (!playlistInput.trim()) return;

    errorMessage = '';
    addingPlaylist = true;
```
Extend to clear `uriValidationError` and validate before the API call:
```typescript
async function addCustomPlaylist() {
    if (!playlistInput.trim()) return;

    errorMessage = '';
    uriValidationError = '';

    if (!isValidSpotifyPlaylistInput(playlistInput.trim())) {
        uriValidationError = 'Ugyldig Spotify-lenke. Lim inn en Spotify-URL, URI eller spilleliste-ID.';
        return;
    }

    addingPlaylist = true;
    // ... rest unchanged
```

**Inline validation function** (add above `addCustomPlaylist`, mirrors `parseSpotifyPlaylistId`):
```typescript
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

**Existing error display below input** (lines 327–329):
```svelte
{#if errorMessage}
    <p class="text-sm text-destructive">{errorMessage}</p>
{/if}
```
Add below it (or replace with two separate blocks):
```svelte
{#if uriValidationError}
    <p class="text-sm text-destructive mt-1">{uriValidationError}</p>
{/if}
{#if errorMessage}
    <p class="text-sm text-destructive">{errorMessage}</p>
{/if}
```

---

### `src/routes/api/spotify/songs/random/+server.ts` (route handler, request-response)

**Analog:** self — existing 401/403 guard pattern at lines 87–99 and 113–126

**Existing guard pattern for `totalResponse`** (lines 87–99):
```typescript
if (totalResponse.status === 401) {
    throw new SpotifyAuthError('Re-authentication required');
}
if (totalResponse.status === 403) {
    return json({ error: 'playlistInaccessible', ... }, { status: 403 });
}
if (!totalResponse.ok) {
    attempts++;
    continue;
}
```
Add 429 guard BEFORE `!ok` (after existing 401/403 checks):
```typescript
if (totalResponse.status === 401) {
    throw new SpotifyAuthError('Re-authentication required');
}
if (totalResponse.status === 403) {
    return json({ error: 'playlistInaccessible', message: 'Copy this playlist to your Spotify library to use it' }, { status: 403 });
}
if (totalResponse.status === 429) {
    return json({ error: 'Rate limited by Spotify', rateLimited: true }, { status: 429 });
}
if (!totalResponse.ok) {
    attempts++;
    continue;
}
```

**Same change for `windowResponse`** (lines 113–126) — mirror exactly:
```typescript
if (windowResponse.status === 401) {
    throw new SpotifyAuthError('Re-authentication required');
}
if (windowResponse.status === 403) {
    return json({ error: 'playlistInaccessible', message: 'Copy this playlist to your Spotify library to use it' }, { status: 403 });
}
if (windowResponse.status === 429) {
    return json({ error: 'Rate limited by Spotify', rateLimited: true }, { status: 429 });
}
if (!windowResponse.ok) {
    attempts++;
    continue;
}
```

---

## Shared Patterns

### Svelte 5 `$state` declaration
**Source:** `src/routes/play/+page.svelte` lines 7–19, `src/routes/setup/+page.svelte` lines 16–32
**Apply to:** All new state variables in both component files
```typescript
let <name> = $state(<initial>);
```
No Svelte stores. No `writable()`. Runes only.

### Error clearing at top of async action
**Source:** `src/routes/play/+page.svelte` line 89, `src/routes/setup/+page.svelte` line 155
**Apply to:** `getNextSong()`, `playSong()`, `addCustomPlaylist()`
Pattern: clear ALL error flags (not just `errorMessage`) at entry point of every mutating async function.

### `requiresReauth` response field convention
**Source:** `src/routes/api/spotify/songs/random/+server.ts` lines 185–190, confirmed same in `devices` and `player/play` routes
**Apply to:** Client-side checks in `onMount`, `getNextSong`, `playSong`
```typescript
// Server returns: { error: '...', requiresReauth: true }
// Client checks:
if (error.requiresReauth) {
    requiresReauth = true;
    return;
}
```
Never auto-navigate. User acts on the banner.

### Button component usage
**Source:** `src/routes/play/+page.svelte` lines 259, 269, 304, 373, 384, 394
**Apply to:** Re-auth banner CTA, 429 "PRØV IGJEN" button
```svelte
import { Button } from '$lib/components/ui/button';
// ...
<Button variant="outline" size="sm" onclick={handler}>LABEL</Button>
```

### `goto` import and usage
**Source:** `src/routes/play/+page.svelte` line 3
**Apply to:** Re-auth banner CTA onclick (already imported)
```typescript
import { goto } from '$app/navigation';
// in handler:
onclick={() => goto('/auth/login/spotify')}
```

---

## No Analog Found

All files have existing analogs or are self-edits. No files require patterns from RESEARCH.md only.

---

## Metadata

**Analog search scope:** `src/routes/play/`, `src/routes/setup/`, `src/routes/api/spotify/songs/random/`, `src/lib/server/`
**Files scanned:** 4 primary files (all read in full)
**Pattern extraction date:** 2026-05-21
