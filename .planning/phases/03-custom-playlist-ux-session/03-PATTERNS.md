# Phase 3: Custom Playlist UX + Session - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 3 (2 modified, 1 new)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/routes/setup/+page.svelte` | component | CRUD + event-driven | itself (current version) | self — incremental modification |
| `src/routes/play/+page.svelte` | component | event-driven + request-response | itself (current version) | self — incremental modification |
| `src/lib/config/playlists.ts` | config | transform | `src/lib/server/env.ts` | role-match (Zod schema + parse/export) |

---

## Pattern Assignments

### `src/lib/config/playlists.ts` (config, transform)

**Analog:** `src/lib/server/env.ts`

**Imports pattern** (`src/lib/server/env.ts` lines 1–3):
```typescript
import { z } from 'zod';
```

**Zod schema + parse + infer type pattern** (`src/lib/server/env.ts` lines 5–18):
```typescript
const envSchema = z.object({
  DATABASE_URL: z.url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    return envSchema.parse({ ...privateEnv, ...publicEnv });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('\n');
      throw new Error(`Environment validation failed:\n${missingVars}`);
    }
    throw error;
  }
}
```

**Apply for `playlists.ts`:** define `PlaylistStateSchema`, export `PlaylistState` type, export `DEFAULT_PLAYLIST_STATE`, export `parsePlaylistState(raw: string): PlaylistState` (uses `safeParse`, returns default on failure — silent reset, not throw). Also export migration helper `migrateOldKeys()`.

**Schema to implement** (from CONTEXT.md `<specifics>`):
```typescript
const PlaylistStateSchema = z.object({
  version: z.literal(1),
  defaultSelected: z.array(z.string()),
  custom: z.array(z.object({
    id: z.string(),
    name: z.string(),
    uri: z.string(),
    trackCount: z.number(),
    enabled: z.boolean()
  }))
});
```

---

### `src/routes/setup/+page.svelte` (component, CRUD + event-driven)

**Analog:** itself — incremental modification. All patterns sourced from existing file.

**Imports pattern** (`src/routes/setup/+page.svelte` lines 1–7):
```typescript
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import { Label } from '$lib/components/ui/label';
import { goto } from '$app/navigation';
import { nanoid } from 'nanoid';
import { onMount } from 'svelte';
```
Add: `import { parsePlaylistState, migrateOldKeys, DEFAULT_PLAYLIST_STATE } from '$lib/config/playlists';`

**State declaration pattern** (lines 11–21):
```typescript
let selectedDefaults = $state<string[]>(data.defaultPlaylists.map((p) => p.id));
let customPlaylists = $state<Array<{ id: string; name: string; uri: string; trackCount: number }>>([]);
let errorMessage = $state('');
```
Replace with new schema-typed state:
```typescript
let selectedDefaults = $state<string[]>([]);
let customPlaylists = $state<Array<{ id: string; name: string; uri: string; trackCount: number; enabled: boolean }>>([]);
let clearPending = $state(false);
let clearSuccess = $state(false);
```

**localStorage sync read (script body, before mount)** (lines 42–51):
```typescript
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('shitster_custom_playlists');
  if (stored) {
    try {
      customPlaylists = JSON.parse(stored);
    } catch {
      // Ignore parse errors
    }
  }
}
```
Replace with: call `migrateOldKeys()` then `parsePlaylistState(localStorage.getItem('shitster_playlists') ?? '')` and assign `defaultSelected` + `custom` arrays. Fall through to defaults on parse failure (handled inside `parsePlaylistState`).

**Async onMount pattern** (lines 53–103): unchanged — keep track-count cache logic as-is.

**Toggle + immediate localStorage write pattern** (lines 105–111):
```typescript
function toggleDefault(id: string) {
  if (selectedDefaults.includes(id)) {
    selectedDefaults = selectedDefaults.filter((x) => x !== id);
  } else {
    selectedDefaults = [...selectedDefaults, id];
  }
  // D-05: write immediately after every toggle
  savePlaylistState();
}
```
New `savePlaylistState()` helper writes `shitster_playlists` key using consolidated schema.

**Custom playlist card toggle pattern** — new, copy visual classes from default toggle:
```svelte
<!-- Active = gradient border + highlight (lines 239–243 of setup page) -->
class="... {playlist.enabled
  ? 'bg-linear-to-br from-purple-600 to-pink-500 text-white border-purple-400 shadow-lg'
  : 'bg-card hover:bg-accent'}"
onclick={() => toggleCustom(playlist.id)}
```
"Fjern" button always visible regardless of enabled state (D-08), inside the card as `variant="ghost" size="sm"`.

**addCustomPlaylist result** (lines 134–145): new playlist gets `enabled: true` field added.

**startGame guard** (lines 162–163): update to count only enabled playlists:
```typescript
// D-09: count only enabled
const totalEnabled = selectedDefaults.length + customPlaylists.filter(p => p.enabled).length;
if (totalEnabled === 0) { ... }
```

**START SPILL disabled condition** (line 344):
```svelte
<!-- current: disabled={totalSelectedPlaylists === 0} -->
<!-- new: -->
disabled={selectedDefaults.length + customPlaylists.filter(p => p.enabled).length === 0}
```

**Double-press clear pattern** (new, D-12/D-13 — no existing analog; implement inline):
```typescript
let clearPending = $state(false);
let clearSuccess = $state(false);

async function clearHistory() {
  if (!clearPending) {
    clearPending = true;
    return;
  }
  clearPending = false;
  try {
    const res = await fetch('/api/spotify/history/clear', { method: 'POST' });
    if (res.ok) {
      clearSuccess = true;
      setTimeout(() => { clearSuccess = false; }, 2000);
    }
  } catch {
    errorMessage = 'Klarte ikke å tømme historikk';
  }
}
```
Button label logic:
```svelte
<Button
  variant={clearPending ? 'destructive' : 'outline'}
  size="sm"
  onclick={clearHistory}
  onblur={() => { clearPending = false; }}
>
  {clearSuccess ? 'Slettet!' : clearPending ? 'Bekreft?' : 'TØM HISTORIKK'}
</Button>
```

**Error display pattern** (line 291 in setup page):
```svelte
{#if errorMessage}
  <p class="text-sm text-destructive">{errorMessage}</p>
{/if}
```
Reuse for all inline errors — same pattern throughout.

---

### `src/routes/play/+page.svelte` (component, event-driven + request-response)

**Analog:** itself — incremental modification.

**State additions** (after line 16):
```typescript
let customPlaylistUris = $state<string[]>([]);
let songsPlayed = $state(0);  // D-10
let clearPending = $state(false);
let clearSuccess = $state(false);
```

**onMount localStorage read** (lines 34–36): replace old keys with new schema:
```typescript
onMount(async () => {
  sessionId = localStorage.getItem('shitster_session_id') || '';
  const state = parsePlaylistState(localStorage.getItem('shitster_playlists') ?? '');
  selectedDefaults = state.defaultSelected;
  // D-06: only enabled custom playlists
  customPlaylistUris = state.custom.filter(p => p.enabled).map(p => p.uri);
  // ... rest unchanged
});
```

**getNextSong — remove old localStorage read + increment counter** (lines 87–92):
```typescript
// Remove: storedCustom localStorage read (now in onMount)
// Use: customPlaylistUris from $state

const response = await fetch('/api/spotify/songs/random', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId,
    selectedDefaultPlaylists: selectedDefaults,
    customPlaylistUris  // from $state, already filtered to enabled
  })
});
// On success:
songsPlayed += 1;  // D-10
```

**clearHistory — replace alert() with double-press pattern** (lines 205–212):
```typescript
async function clearHistory() {
  if (!clearPending) {
    clearPending = true;
    return;
  }
  clearPending = false;
  try {
    const res = await fetch('/api/spotify/history/clear', { method: 'POST' });
    if (res.ok) {
      songsPlayed = 0;  // D-10 reset
      clearSuccess = true;
      setTimeout(() => { clearSuccess = false; }, 2000);
    }
  } catch {
    errorMessage = 'Klarte ikke å tømme historikk';
  }
}
```

**Header bar — counter + button** (lines 232–248): add counter text and update button:
```svelte
<div class="flex items-center justify-center sm:justify-between">
  <h1 class="...">shitster</h1>
  {#if songsPlayed > 0}
    <span class="text-xs text-muted-foreground hidden sm:block">
      {songsPlayed} {songsPlayed === 1 ? 'sang' : 'sanger'} spilt
    </span>
  {/if}
  <div class="hidden sm:flex gap-2">
    <Button
      variant={clearPending ? 'destructive' : 'outline'}
      size="sm"
      onclick={clearHistory}
      onblur={() => { clearPending = false; }}
    >
      {clearSuccess ? 'Slettet!' : clearPending ? 'Bekreft?' : 'TØM HISTORIKK'}
    </Button>
    <Button variant="outline" size="sm" onclick={endGame}>AVSLUTT SPILL</Button>
  </div>
</div>
```

**endGame** (lines 214–218): update to remove new localStorage key too:
```typescript
function endGame() {
  localStorage.removeItem('shitster_session_id');
  // Do NOT remove shitster_playlists — selections persist across games (D-15)
  goto('/');
}
```

---

## Shared Patterns

### Zod safeParse with silent default fallback
**Source:** `src/lib/server/env.ts` (parse pattern) — adapted for client-side silent reset
**Apply to:** `src/lib/config/playlists.ts` `parsePlaylistState()`
```typescript
// Use safeParse (not parse) so localStorage corruption never throws
const result = PlaylistStateSchema.safeParse(JSON.parse(raw));
if (!result.success) return DEFAULT_PLAYLIST_STATE;
return result.data;
```

### Gradient active state (toggle cards)
**Source:** `src/routes/setup/+page.svelte` lines 239–243
**Apply to:** both default playlist buttons and new custom playlist toggle cards
```svelte
class="... {isActive
  ? 'bg-linear-to-br from-purple-600 to-pink-500 text-white border-purple-400 shadow-lg'
  : 'bg-card hover:bg-accent'}"
```

### Destructive button variant
**Source:** `src/lib/components/ui/button/button.svelte` lines 9, 29–30
**Apply to:** `clearPending` state on TØM HISTORIKK buttons in both pages
```svelte
variant={clearPending ? 'destructive' : 'outline'}
```
`destructive` maps to `bg-destructive text-destructive-foreground hover:bg-destructive/90`.

### Inline error display
**Source:** `src/routes/setup/+page.svelte` line 291
**Apply to:** all error states in both pages (no toast, no alert)
```svelte
{#if errorMessage}
  <p class="text-sm text-destructive">{errorMessage}</p>
{/if}
```

### localStorage write helper pattern
**Source:** `src/routes/setup/+page.svelte` lines 141–144 (current `localStorage.setItem` calls)
**Apply to:** new `savePlaylistState()` in setup page — centralise all writes to `shitster_playlists`
```typescript
function savePlaylistState() {
  localStorage.setItem('shitster_playlists', JSON.stringify({
    version: 1,
    defaultSelected: selectedDefaults,
    custom: customPlaylists
  }));
}
```
Call after every toggle and after add/remove custom playlist.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| double-press confirmation pattern | UI pattern | event-driven | No existing confirm flow in codebase — implement inline per D-12 spec |

---

## Metadata

**Analog search scope:** `src/routes/`, `src/lib/`
**Files scanned:** 6 (setup page, play page, env.ts, playlists.ts, button.svelte, history/clear server)
**Pattern extraction date:** 2026-05-21
