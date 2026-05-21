# Technology Stack — Spotify Party Jukebox (Mixster)

**Project:** Mixster
**Researched:** 2026-05-18
**Overall confidence:** HIGH (Spotify API changes verified against official docs; SvelteKit patterns from official docs)

---

## 1. Spotify Web API — Playlist Resolution

### BREAKING: February 2026 API Changes

**CRITICAL for this project.** Two breaking changes affect current and planned code:

**Field rename** (HIGH confidence — official migration guide):
- `GET /playlists/{id}/tracks` → `GET /playlists/{id}/items`
- Response: `playlist.tracks.items[0].track` → `playlist.items?.items?.[0]?.item`
- Old `/tracks` endpoint kept for backwards compat but deprecated — migrate now

**Access restriction** (HIGH confidence — official docs):
- `items` (track listing) only returned for playlists the **authenticated user owns or collaborates on**
- For all other playlists: only metadata returned, `items` field absent
- This **directly affects** `songs/random/+server.ts` which fetches `?limit=100` tracks from HITSTER official playlists — those are not user-owned

**Impact assessment:**
- Fetching `name` + `tracks.total` for playlist metadata: still works for any playlist via `GET /playlists/{id}?fields=name,items.total` — metadata unaffected
- Fetching track listings from HITSTER default playlists (third-party owned): **will break** once migration window closes
- Fetching track listings from user-added custom playlists: works only if user owns them

**Pattern for playlist resolution (name + track count from URL/URI):**

```typescript
// Parse Spotify playlist ID from URL or URI
// Handles: spotify:playlist:ID, https://open.spotify.com/playlist/ID?si=...
function parsePlaylistId(input: string): string | null {
  // URI format: spotify:playlist:<22-char base62>
  const uriMatch = input.match(/^spotify:playlist:([A-Za-z0-9]{22})$/);
  if (uriMatch) return uriMatch[1];
  // URL format: open.spotify.com/playlist/<id>
  const urlMatch = input.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})/);
  if (urlMatch) return urlMatch[1];
  return null;
}

// Fetch ONLY metadata — name + total track count
// fields param avoids fetching track data (saves quota, avoids access restriction)
const playlist = await spotifyFetch(userId, 
  `/playlists/${id}?fields=id,name,description,images,items.total,snapshot_id`
);
// Post-Feb-2026: items.total (not tracks.total)
const trackCount = playlist.items?.total ?? 0;
```

**Why `fields` param is mandatory:** Without it, the API returns the full track listing (100 tracks default), consuming quota and triggering the access-restriction issue for non-owned playlists. Using `fields=name,items.total` fetches only what's needed for display.

### Pagination

- Max `limit=100` per page for `/items` endpoint (HIGH confidence — official docs)
- `total` field in paging object gives track count without fetching all tracks
- For playlists >100 tracks, paginate with `offset` — for this app (just needs track count), the `fields=items.total` approach avoids pagination entirely
- Current `songs/random` code fetches only first 100 tracks of a playlist — acceptable for MVP, but large playlists (>100 tracks) are under-represented. Document as known limitation.

### Rate Limits

- Rolling 30-second window; threshold not published
- 429 response includes `Retry-After: <seconds>` header
- Server-side proxy (existing pattern) naturally serializes requests — no client-side fan-out risk
- For playlist resolution at add-time (one-off user action), rate limit is not a concern
- For `songs/random` (called per round), cache `snapshot_id` per playlist to skip re-fetching track list when playlist unchanged — reduces API calls from O(1 per round) to O(0 per round for cached playlists)

### Error Cases for Playlist Resolution

| Error | HTTP | Cause | Handling |
|-------|------|-------|----------|
| Invalid ID format | — | Client-side parse fails | Reject before API call |
| Playlist not found | 404 | Deleted or ID wrong | "Playlist not found" to user |
| Private playlist | 403 | User doesn't have access | "Playlist is private or inaccessible" |
| Auth expired | 401 | Token stale | Existing `SpotifyAuthError` pattern handles this |
| Rate limited | 429 | Too many calls | Retry after `Retry-After` header value |

**Recommended:** Validate ID format client-side (regex) before calling server endpoint. Show inline error on the add-form, not a page-level error.

---

## 2. localStorage Schema Design

### Recommended Schema

```typescript
// Key: 'mixster_playlists' (consistent with existing mixster_* namespace)

interface StoredPlaylist {
  id: string;          // spotify playlist ID (22-char base62)
  uri: string;         // spotify:playlist:<id>
  name: string;        // resolved from Spotify API at add-time
  trackCount: number;  // resolved from Spotify API at add-time
  enabled: boolean;    // user toggle — true = included in game
  addedAt: number;     // unix ms timestamp — for display ordering
  isDefault: boolean;  // true = bundled HITSTER playlist, false = user-added
}

interface PlaylistsStorage {
  version: 1;          // bump on breaking schema change
  playlists: StoredPlaylist[];
}
```

**Zod schema at read-time** (HIGH confidence — Svelte 5 runes + Zod v4 pattern):

```typescript
import { z } from 'zod/v4-mini'; // smaller bundle — Zod v4 has this export

const StoredPlaylistSchema = z.object({
  id: z.string(),
  uri: z.string(),
  name: z.string(),
  trackCount: z.number(),
  enabled: z.boolean(),
  addedAt: z.number(),
  isDefault: z.boolean()
});

const PlaylistsStorageSchema = z.object({
  version: z.literal(1),
  playlists: z.array(StoredPlaylistSchema)
});

function loadPlaylists(): PlaylistsStorage {
  if (typeof localStorage === 'undefined') return defaultStorage();
  try {
    const raw = localStorage.getItem('mixster_playlists');
    if (!raw) return defaultStorage();
    const parsed = JSON.parse(raw);
    const result = PlaylistsStorageSchema.safeParse(parsed);
    if (!result.success) {
      // Schema mismatch (version bump or corruption) — reset to defaults
      return defaultStorage();
    }
    return result.data;
  } catch {
    return defaultStorage();
  }
}
```

**Why Zod at read-time:** localStorage is untrusted (user can edit it, previous app version wrote different shape). Zod `.safeParse()` gives runtime type safety + automatic fallback to defaults. No separate version migration logic needed for MVP — just bump `version` literal and fallback clears state.

**Why `isDefault: boolean` on stored playlists:** Avoids two separate storage keys (`mixster_default_enabled` + `mixster_custom_playlists`). Single source of truth for all playlist state. Simplifies toggle logic — same code path for default and custom playlists.

**Why store `name` + `trackCount` at add-time:** Avoids fetching playlist metadata on every page load. Spotify API call happens once (when user pastes URL), result persisted. If user wants refresh, they remove and re-add.

### Svelte 5 Runes Integration

Use a `$state` rune with SSR guard — no library needed for this simple case:

```typescript
// src/lib/stores/playlists.svelte.ts
import { browser } from '$app/environment';

let _state = $state<PlaylistsStorage>(defaultStorage());

export const playlistStore = {
  get state() { return _state; },
  load() {
    if (!browser) return;
    _state = loadPlaylists();
  },
  save() {
    if (!browser) return;
    localStorage.setItem('mixster_playlists', JSON.stringify(_state));
  },
  // ... add, toggle, remove methods
};
```

Call `playlistStore.load()` in `onMount()` in the root layout. Avoids SSR hydration mismatch.

**Why not `svelte-persisted-store` or similar library:** All those libraries target Svelte 3/4 stores. Svelte 5 runes make them unnecessary. The pattern above is 30 lines, no dependency, fully typed.

---

## 3. PWA Display on TV / Large Screen

### Manifest Configuration

```json
{
  "display": "fullscreen",
  "display_override": ["window-controls-overlay", "fullscreen", "standalone"],
  "orientation": "landscape",
  "background_color": "#000000",
  "theme_color": "#000000"
}
```

**`fullscreen` over `standalone`** (HIGH confidence — MDN + Smashing Magazine 2025): Fullscreen hides all browser chrome — correct for a party game on TV where URL bar / back button are distractions. Standalone keeps system status bar visible — fine for phone, wrong for TV kiosk use.

**`display_override` array** (HIGH confidence — MDN): Fallback chain for browsers that don't support `fullscreen` PWA mode. Order matters — try `window-controls-overlay` first on desktop, fall back to `fullscreen`, then `standalone`.

**`orientation: "landscape"`**: Forces landscape on tablets/TVs. Party game is always landscape.

### vite-plugin-pwa Config for SvelteKit

Current stack has `@vite-pwa/sveltekit ^1.0.1`. Verify `vite.config.ts` manifest includes above fields. Minimal addition:

```typescript
// vite.config.ts
SvelteKitPWA({
  manifest: {
    display: 'fullscreen',
    display_override: ['window-controls-overlay', 'fullscreen', 'standalone'],
    orientation: 'landscape',
    background_color: '#000000',
    theme_color: '#000000',
    // ... existing fields
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  }
})
```

### CSS for Large Screen

Add `@media (min-width: 1280px)` breakpoints for TV display. Minimum font size 2rem for readability at 3m viewing distance. Use CSS custom properties for screen-size-specific sizing rather than hardcoding Tailwind classes.

Use `display-mode` CSS media feature to adjust layout when running as installed PWA:

```css
@media (display-mode: fullscreen) {
  /* No browser chrome — safe to use full viewport */
  body { padding: 0; }
}
```

### Known Limitation

TVs with built-in browsers (Samsung Tizen, LG webOS) have limited PWA support. Party use case likely means laptop/tablet connected to TV via HDMI — Chrome/Safari on that device will support fullscreen PWA correctly. Not worth building Tizen-specific workarounds.

---

## 4. SvelteKit Form Actions vs Fetch for Mutations

### Decision Rule

| Mutation Type | Use | Rationale |
|---------------|-----|-----------|
| Add playlist (paste URL → resolve → store) | `fetch` to `+server.ts` | Returns JSON (resolved name, trackCount); form action can't cleanly return structured data for inline display |
| Toggle playlist enabled | localStorage only, no server call | No server state involved |
| Clear play history | Form action (`+page.server.ts`) | Pure server-side DB delete, no response data needed, benefits from `use:enhance` loading state |
| Remove custom playlist | localStorage only, no server call | No server state involved |

**Why fetch for playlist add:**
- Needs to return `{ name, trackCount }` from Spotify API to display in UI
- Form actions return `ActionData` which can carry structured data, but the DX is awkward — `form.name` vs typed response object
- Error states (404, 403, invalid URL) map cleanly to JSON `{ error: string }` with status codes
- The operation is async (Spotify API call) — fetch + `$state` loading flag is cleaner than form action + `use:enhance` callback

**Why form action for clear history:**
- No response data needed — just success/fail
- `use:enhance` gives optimistic UI and loading state for free
- Server-side DB delete — exactly what form actions are designed for
- Works without JS (good practice even if party app always has JS)

**Pattern for playlist add endpoint:**

```typescript
// src/routes/api/spotify/playlist/resolve/+server.ts
export async function GET(event: RequestEvent) {
  // ?uri=spotify:playlist:xxx or ?url=https://open.spotify.com/playlist/xxx
  const input = event.url.searchParams.get('uri') ?? event.url.searchParams.get('url');
  const id = parsePlaylistId(input ?? '');
  if (!id) return json({ error: 'Invalid Spotify URL or URI' }, { status: 400 });
  
  // Fetch metadata only — no track listing
  const data = await spotifyFetch(user.id, 
    `/playlists/${id}?fields=id,name,items.total,snapshot_id`
  );
  return json({ id, name: data.name, trackCount: data.items?.total ?? 0 });
}
```

Use `GET` not `POST` — resolving a playlist is idempotent and cacheable. No state changed on server.

---

## Alternatives Considered

| Decision | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| localStorage validation | Zod safeParse at read-time | No validation | Silent corruption on schema change |
| localStorage validation | Zod safeParse at read-time | Migration functions per version | Overkill for MVP; fallback-to-default is acceptable |
| PWA display mode | `fullscreen` | `standalone` | Standalone keeps browser chrome — wrong for TV kiosk |
| Playlist add | `fetch` to `+server.ts` | Form action | Form action returns `ActionData` awkwardly for structured JSON response |
| Playlist resolution | `fields` query param | Full playlist fetch | Full fetch returns 100 tracks unnecessarily; triggers access restrictions post-Feb 2026 |
| Svelte 5 localStorage | Raw `$state` + Zod | `svelte-persisted-store` | Library targets Svelte 3/4 stores; unmaintained for runes pattern |

---

## Migration Urgency

The February 2026 Spotify API changes are **live now** (as of 2026-05-18). Current code using `/tracks` endpoint and accessing `playlist.tracks.items` will either:
- Already be broken if the migration window closed
- Break imminently if still in grace period

**Immediate action required:** Audit all `spotifyFetch` calls in `spotify.ts` and API routes for use of `/tracks` endpoint and `.tracks.` field access. Update to `/items` and `.items.` before any new feature work.

---

## Sources

- [February 2026 Web API Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) — HIGH confidence
- [Spotify Rate Limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits) — HIGH confidence
- [GET /playlists/{id} Reference](https://developer.spotify.com/documentation/web-api/reference/get-playlist) — HIGH confidence
- [SvelteKit Form Actions Docs](https://svelte.dev/docs/kit/form-actions) — HIGH confidence
- [Svelte 5 Runic Persist Pattern](https://www.puruvj.dev/blog/svelte-5-runic-persist-theming) — MEDIUM confidence (community blog, verified against Svelte 5 runes API)
- [MDN display_override](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display_override) — HIGH confidence
- [Smashing Magazine — PWA Display Modes 2025](https://www.smashingmagazine.com/2025/08/optimizing-pwas-different-display-modes/) — MEDIUM confidence
- [spotify-uri parsing library](https://github.com/TooTallNate/spotify-uri) — MEDIUM confidence (regex patterns verified against Spotify URI/ID docs)
