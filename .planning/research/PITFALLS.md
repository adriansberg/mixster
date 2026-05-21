# Domain Pitfalls

**Domain:** Spotify party jukebox (SvelteKit 2 + Svelte 5 runes)
**Researched:** 2026-05-18

---

## Critical Pitfalls

### Pitfall 1: URI parsing silently produces `undefined` playlist ID

**What goes wrong:** `randomPlaylistUri.split(':')[2]` in `songs/random/+server.ts:65` returns `undefined` when a URL (not a URI) lands in `customPlaylistUris`. The request to `/playlists/undefined/tracks` gets a Spotify 400, `spotifyFetch` returns `null`, and the loop burns all 10 attempts silently. Party sees "Could not find a song" with no actionable message.

**Why it happens:** localStorage stores whatever the user pasted. The UI doesn't validate format before storing. The server trusts the array without normalizing.

**Consequences:** All 10 attempts exhausted, up to 20 Spotify API calls wasted, then a dead-end error.

**Prevention:** Run every URI/URL through `parseSpotifyPlaylistId` (already in `spotify.ts:182`) at the top of the POST handler before the loop. Reject with `400 invalid_uri` immediately if any entry returns `null`. Never let a raw client string hit the split.

**Detection:** Error message "Could not find an unplayed song" with no prior auth errors. Check server logs for `Spotify API error: 400`.


### Pitfall 2: Spotify 429 burns all retry attempts mid-game

**What goes wrong:** `spotifyFetch` treats 429 as a generic non-OK and returns `null`. The retry loop in `songs/random` interprets `null` as "no valid track" and continues, firing the next Spotify call immediately. Under rate limiting all 10 attempts fail in rapid succession. Party waits 6+ seconds then gets an error.

**Why it happens:** No 429 handling in `spotifyFetch`. Retry loop has no back-off.

**Consequences:** 10 failed API calls, full latency of the loop, then a user-facing error. If the host hits "next song" again, the next 10 calls are also rate-limited.

**Prevention:** In `spotifyFetch`, check `response.status === 429`, read the `Retry-After` header, throw a typed `SpotifyRateLimitError` (like `SpotifyAuthError`). Catch it in the random-song handler and return a `429` to the client with `retryAfterSeconds`. Client shows "Spotify is busy, try in Xs" instead of a dead error.

**Detection:** Rapid successive `Spotify API error: 429` log lines.


### Pitfall 3: Non-atomic token refresh breaks playback mid-game

**What goes wrong:** Two in-flight requests (e.g. device poll + song fetch) both see `expiresIn < 60s`. Both call `refreshSpotifyToken`. Both write back. The second write stores a new `accessToken` but the refresh token used for the first request is now consumed. Next request that triggers refresh gets a 401 from Spotify's token endpoint → `deleteSpotifyTokens` fires → user is logged out mid-game.

**Why it happens:** No mutex or check-and-set around the refresh in `getSpotifyAccessToken` (spotify.ts:26-54).

**Consequences:** Mid-game auth loss. `SpotifyAuthError` throws, client gets `requiresReauth: true`, `alert()` fires, game ends.

**Prevention (short term):** Widen the expiry buffer from 60s to 5 min so both requests use the existing token rather than racing to refresh. Eliminates the race window for normal use. **Long term:** module-level in-flight refresh promise (singleton pattern: store a `Promise<string>` and reuse it for concurrent callers).

**Detection:** 401 from Spotify token endpoint immediately after a successful refresh. Logs: `Failed to refresh Spotify token` followed by `cleaning up invalid tokens`.


### Pitfall 4: `isPlaying` state desyncs from actual Spotify playback

**What goes wrong:** `isPlaying` is set to `true` after a successful `PUT /player/play` response (play/+page.svelte:160). If Spotify pauses independently (end of track, app switched, another client pauses), `isPlaying` stays `true`. The UI shows the pause button; pressing it sends pause, but the track is already stopped. Next "NESTE SANG" press auto-calls `playSong` → play succeeds, but the host thinks it was already playing.

**Why it happens:** No polling of `/me/player` state. `isPlaying` is client-held optimistic state with no reconciliation.

**Consequences:** Host confusion during party. Flip-card reveal sends a pause to an already-stopped track — harmless but confusing. More critically, if Spotify's "active device" context is lost, the `PUT /play` returns 404 (no active device), client still sets `isPlaying = true`.

**Prevention:** After every failed play/pause, re-fetch devices and reset `deviceId` if the selected device is no longer in the list. Optionally poll `/me/player` once per song card (not continuously — rate limits). Treat any non-2xx play response as a device-lost event.

**Detection:** `isPlaying = true` but no music playing. Subsequent NESTE SANG triggers play but host expects it was already playing.


---

## Moderate Pitfalls

### Pitfall 5: `customPlaylistUris` can enumerate any Spotify playlist

**What goes wrong:** `songs/random` accepts `customPlaylistUris` as an arbitrary array from POST body (server.ts:21-23). Any authenticated user can pass any Spotify playlist URI — including private playlists belonging to other users. Spotify allows fetching tracks from any URI the API grants access to; the server passes it straight through.

**Prevention:** Validate format (must pass `parseSpotifyPlaylistId`). Optionally add a server-side allowlist check or require URIs to be pre-resolved through a separate "add playlist" endpoint that verifies access before storing. At minimum, log unusual URIs.

**Detection:** Unexpected private-playlist URIs in server logs.


### Pitfall 6: localStorage parse throws on corrupted data — silently skips playlists

**What goes wrong:** `JSON.parse(localStorage.getItem('mixster_custom_playlists'))` (play/+page.svelte:89) has no try/catch. If the stored value is malformed (partial write, browser extension interference, manual edit), `JSON.parse` throws, the error propagates up the `getNextSong` catch block, and `errorMessage = 'Failed to load next song'` is shown — misleading because no network call has even started.

**Prevention:** Wrap every `localStorage.getItem` + `JSON.parse` in try/catch. On parse failure, log and treat as empty array (`[]`). Provide a helper: `function safeLocalJSON(key, fallback)`.

**Detection:** "Failed to load next song" with no network activity in DevTools.


### Pitfall 7: Devices list fetched once at mount — stale mid-game

**What goes wrong:** `availableDevices` is fetched once in `onMount` (play/+page.svelte:44-78). If the party's Spotify client is opened on a new device, or the active device goes to sleep, `deviceId` still points to the old device. `PUT /player/play?device_id=<stale_id>` returns Spotify 404 (device not found). `spotifyFetch` returns `null`. Play route returns 500. Client shows "Playback failed: Failed to control playback".

**Prevention:** Re-fetch devices on every play attempt (or on 404 from play). Auto-refresh device list when `errorMessage` contains a playback failure. Add a "Refresh devices" button in the device selector.

**Detection:** "Playback failed" after a working session; devices haven't changed in UI but Spotify device is different.


### Pitfall 8: Private or collaborative playlist returns 403 — silent fail

**What goes wrong:** When the user adds a private playlist owned by another user, Spotify returns 403. `spotifyFetch` returns `null` for non-401 errors. The loop increments `attempts` and tries the next playlist. If only one playlist is selected and it's inaccessible, all 10 attempts hit the same playlist and exhaust the loop.

**Prevention:** When resolving a playlist for "add playlist" UI, call `GET /playlists/{id}` and check `collaborative` and `public` fields. Warn on add if the playlist may be inaccessible. In the random loop, track which playlist URIs returned `null` and skip them after the first failure (don't retry same failing playlist).

**Detection:** All 10 attempts hit the same playlistId in logs, all return null.


### Pitfall 9: Play history dedup loads all rows into memory

**What goes wrong:** `playedSongs.findMany` loads the entire 7-day history as an array (server.ts:48-53), then filters in JavaScript. With a long play session this grows but is currently bounded. The real risk is that `NOT IN` with a large in-memory array is fine in JS but the query still fetches every row — if two users share the same Spotify account (party with multiple browser sessions), play history balloons unexpectedly.

**Prevention:** Move dedup to SQL: `WHERE spotify_track_id NOT IN (SELECT spotify_track_id FROM played_songs WHERE user_id = ? AND played_at > ?)`. Add an index on `(user_id, played_at)`.

**Detection:** Slow "next song" requests after many rounds.


---

## Minor Pitfalls

### Pitfall 10: `endGame` removes session and defaults but not custom playlists

**What goes wrong:** `endGame` (play/+page.svelte:214-218) clears `mixster_session_id` and `mixster_selected_defaults` but not `mixster_custom_playlists`. On next setup, custom playlists reappear. Intended as convenience, but if the host accidentally ends the game, then starts a new setup, custom playlists from the old session are pre-loaded without the host noticing.

**Prevention:** Document this as intentional behavior in a code comment. Alternatively, add an explicit "Clear everything" path in the session management UX.


### Pitfall 11: `alert()` blocks thread on auth errors

**What goes wrong:** Three `alert()` calls in play/+page.svelte (lines 50, 109, 150) block the browser's main thread and look broken on mobile/TV. On iOS Safari, `alert()` in async context can misbehave with focus.

**Prevention:** Replace with the existing `errorMessage` $state. Show the error inline, then navigate after a short delay or user confirmation button.


### Pitfall 12: Svelte 5 `$state` arrays — direct mutation doesn't trigger reactivity

**What goes wrong:** `$state([])` creates a reactive proxy, but only for assignments and property sets. Methods like `array.splice()` or `array[0] = x` applied to a `$state` array mutate the underlying array — this does work in Svelte 5 because the proxy intercepts array mutations — but mixing push/splice with assignment (`arr = [...arr, x]`) creates subtle bugs when developers switch patterns mid-codebase.

**Why it happens:** Svelte 5 runes are new; Svelte 4 store patterns are deeply ingrained. Developers reach for `writable` or `$store` syntax instinctively.

**Prevention:** Pick one pattern per array: either always reassign (`arr = [...arr, item]`) or always mutate (`arr.push(item)`) — both work in Svelte 5, but don't mix. Never initialize `$state` inside `onMount` for values that drive initial render; initialize at component top level so SSR and hydration see the correct type.


### Pitfall 13: `$derived` recomputes on every reactive read if dependencies are unstable

**What goes wrong:** If a `$derived` expression references a function or object created inside the block (not from $state), it recomputes every time any $state changes regardless of relevance.

**Prevention:** Keep `$derived` expressions simple — reference only `$state` variables. Move complex transforms to a regular function called from `$derived`. Avoid `new Date()` or `Math.random()` inside `$derived`.


---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Custom playlist add UI | URI validation (Pitfall 1) fires on first use | Run `parseSpotifyPlaylistId` at add time, reject before storing |
| Playlist add UI | Private playlist 403 (Pitfall 8) | Validate accessibility at add time, not at play time |
| Setup page polish | localStorage parse throw (Pitfall 6) | Add `safeLocalJSON` helper before any new localStorage reads |
| Play page polish | Stale device (Pitfall 7) + isPlaying desync (Pitfall 4) | Re-fetch devices on play failure; don't trust client isPlaying |
| Session management / history clear | endGame key mismatch (Pitfall 10) | Audit all 3 localStorage keys in endGame |
| Dead code cleanup | Token endpoint removal | Confirm `SpotifyPlayerService` has zero callers first; delete service, types, and token endpoint together |
| Performance work | 429 with retry loop (Pitfall 2) | Must add 429 handling before any increase to maxAttempts or parallelism |
| Token refresh atomicity (Pitfall 3) | Mid-game logout | Widen expiry buffer first as cheap fix; mutex as follow-up |

---

## Sources

- Code audit: `src/lib/server/spotify.ts`, `src/routes/play/+page.svelte`, `src/routes/api/spotify/songs/random/+server.ts`, `src/routes/api/spotify/devices/+server.ts`, `src/routes/api/spotify/player/play/+server.ts`
- `.planning/codebase/CONCERNS.md` (project audit 2026-05-18)
- `.planning/PROJECT.md` (project spec 2026-05-18)
- Spotify Web API docs: device not found returns 404, rate limit returns 429 with `Retry-After`, private playlist fetch returns 403
- Svelte 5 runes docs: `$state` proxy behavior, `$derived` dependency tracking
