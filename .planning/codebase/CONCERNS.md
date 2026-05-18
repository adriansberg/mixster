# Codebase Concerns

**Analysis Date:** 2026-05-18

---

## Security Considerations

### [HIGH] Spotify token exposed to client via API endpoint

- Risk: `/api/spotify/token` returns the raw Spotify access token to the browser. Any XSS or CSRF attacker who can call this endpoint gets a valid Spotify token, which grants `user-modify-playback-state` scope — full playback control on the user's account.
- Files: `src/routes/api/spotify/token/+server.ts:13-25`
- Current mitigation: Endpoint requires authenticated session cookie.
- Recommendation: Remove the endpoint entirely. The token is only needed client-side for `SpotifyPlayerService`, which is currently unused (see Dead Code below). All Spotify API calls should go server-side through existing proxy routes.

### [HIGH] IDOR on playlist DELETE and PATCH — no ownership check

- Risk: `DELETE /api/spotify/playlists` and `PATCH /api/spotify/playlist/toggle` accept a `playlistId` and act on it without verifying the record belongs to the requesting user. Any authenticated user can delete or toggle another user's playlist.
- Files:
  - `src/routes/api/spotify/playlists/+server.ts:37` — `db.delete(userPlaylists).where(eq(userPlaylists.id, playlistId))` — no `userId` filter
  - `src/routes/api/spotify/playlist/toggle/+server.ts:26-29` — same pattern
- Fix: Add `and(eq(userPlaylists.id, playlistId), eq(userPlaylists.userId, user.id))` to both queries.

### [MEDIUM] Debug `console.log` statements leak OAuth state to server logs

- Risk: OAuth state and code-verifier values appear in server logs. In a hosted environment (Vercel) logs may be retained and accessible to team members.
- Files:
  - `src/routes/auth/login/spotify/+server.ts:15` — `console.log('Setting OAuth state:', state)`
  - `src/routes/auth/callback/spotify/+server.ts:25-26` — logs both state values
- Fix: Remove both log statements before production hardening.

### [MEDIUM] Session cookie missing `secure` flag in some paths

- Risk: `setSessionTokenCookie` in `src/lib/server/auth/session.ts:78` sets `session` cookie without `secure: true`. The `spotify_oauth_state` and `spotify_code_verifier` cookies in `src/routes/auth/login/spotify/+server.ts:27-40` correctly check `isProduction`, but the session cookie itself does not. On HTTP (dev proxies, misconfigured prod) the session token can leak over the network.
- Files: `src/lib/server/auth/session.ts:73-84`
- Fix: Add `secure: env.NODE_ENV === 'production'` to `setSessionTokenCookie`.

### [LOW] `console.log('data', data)` in production page

- Risk: Leaks device list (device IDs, names) to browser console.
- Files: `src/routes/play/+page.svelte:55`
- Fix: Remove.

---

## Tech Debt

### [HIGH] `SpotifyPlayerService` is dead code — direct Spotify API calls from client

- Issue: `src/lib/services/spotify-player.ts` makes direct Spotify API calls from the browser using a token fetched from `/api/spotify/token`. The play page does NOT use this service — it calls the server-side proxy routes instead. The service is completely unused but implies a client-side playback architecture that conflicts with the actual server-side proxy approach.
- Files: `src/lib/services/spotify-player.ts` (all 129 lines), `src/lib/types/spotify-player.d.ts`
- Impact: Confusion about the intended architecture; the token endpoint exists solely to support this dead code path.
- Fix: Delete both files and the token endpoint after confirming no callers remain.

### [HIGH] `userPlaylists` table is dead — playlists stored in localStorage instead

- Issue: Schema comment at `src/lib/server/db/schema.ts:47` explicitly states "userPlaylists table is no longer used - playlists stored in localStorage". Routes still exist to read/write it (`/api/spotify/playlists`, `/api/spotify/playlist/add`, `/api/spotify/playlist/toggle`). localStorage playlist state is sent as untrusted POST body to `/api/spotify/songs/random` and accepted without sanitization beyond array spread.
- Files:
  - `src/lib/server/db/schema.ts:50-63` — dead table definition
  - `src/routes/api/spotify/playlists/+server.ts` — reads dead table
  - `src/routes/api/spotify/playlist/add/+server.ts` — writes dead table
  - `src/routes/api/spotify/playlist/toggle/+server.ts` — mutates dead table
  - `src/routes/api/spotify/songs/random/+server.ts:30-37` — accepts arbitrary `customPlaylistUris` array from client
- Impact: Dead DB routes are maintenance burden and contain the IDOR vulnerability above. Untrusted `customPlaylistUris` could be used to enumerate any Spotify playlist.
- Fix: Decide authoritatively whether playlists live in DB or localStorage; remove the dead path.

### [MEDIUM] `email.ts` contains unused dead code — no email flows exist in the app

- Issue: `src/lib/server/email.ts` exports `sendVerificationEmail` and `sendPasswordResetEmail`. There are no email verification or password reset flows in the application (Spotify-only OAuth). The `RESEND_API_KEY` and `EMAIL_FROM` env vars are also absent from `.env.example`.
- Files: `src/lib/server/email.ts`
- Fix: Delete or add env vars to `.env.example` and wire up actual flows.

### [MEDIUM] `env.ts` references `RESEND_API_KEY` and `EMAIL_FROM` that are not in the validated schema

- Issue: `src/lib/server/email.ts:6,31` reads `env.RESEND_API_KEY` and `env.EMAIL_FROM` but these fields are not declared in the Zod schema in `src/lib/server/env.ts`. TypeScript will error or silently return `undefined`.
- Files: `src/lib/server/env.ts:5-16`, `src/lib/server/email.ts:6,31`

### [LOW] Redundant playback routes — `player/start` duplicates `player/play`

- Issue: `src/routes/api/spotify/player/start/+server.ts` and `src/routes/api/spotify/player/play/+server.ts` both accept `{trackId, deviceId}` and call `PUT /me/player/play`. The `start` route does not handle `SpotifyAuthError`.
- Files:
  - `src/routes/api/spotify/player/start/+server.ts`
  - `src/routes/api/spotify/player/play/+server.ts`

---

## Performance Bottlenecks

### [HIGH] Up to 20 sequential Spotify API calls per "next song" request

- Problem: `src/routes/api/spotify/songs/random/+server.ts` runs a retry loop of up to 10 attempts. Each attempt makes 2 Spotify API calls (playlist tracks + track details). Worst case = 20 serial HTTP requests, each ~100–300ms = up to 6 seconds of latency.
- Files: `src/routes/api/spotify/songs/random/+server.ts:58-132`
- Cause: Playlist fetch is inside the retry loop, re-fetching the same playlist on every attempt. Track details fetched separately even though `release_date` could be included in the playlist fields request.
- Improvement path: Cache playlist track lists between attempts (within request); request `album.release_date` in the initial playlist fields query (`fields=items(track(id,name,artists,album(release_date,images)))`); remove the separate `/tracks/:id` call entirely.

### [MEDIUM] Playlist fetches capped at 100 tracks regardless of playlist size

- Problem: `/playlists/${playlistId}/tracks?limit=100` only retrieves the first 100 tracks. Playlists described in `src/lib/config/playlists.ts` (e.g. HITSTER Norway) may have hundreds of tracks. Selection pool is artificially limited, increasing repeat rates and exhaustion failures.
- Files: `src/routes/api/spotify/songs/random/+server.ts:70`
- Improvement path: Use `total` from the response to paginate or pick a random `offset` within `[0, total-100]` before fetching.

### [MEDIUM] No rate-limit handling for Spotify API 429 responses

- Problem: `src/lib/server/spotify.ts:spotifyFetch` treats any non-OK status other than 401 as a generic error (`return null`). Spotify returns HTTP 429 with a `Retry-After` header when rate-limited. The retry loop in the random-song endpoint will hammer the API and burn all 10 attempts.
- Files: `src/lib/server/spotify.ts:127-139`, `src/routes/api/spotify/songs/random/+server.ts:61-131`
- Improvement path: Check for 429 in `spotifyFetch`, read `Retry-After`, and either throw a typed error or delay.

---

## Known Bugs

### [MEDIUM] Token refresh is not atomic — concurrent requests can double-refresh

- Symptoms: Two concurrent requests both see `expiresIn < 60s`, both call `refreshSpotifyToken`, both write back. The second write overwrites the first refresh token, which may already be consumed, causing the next request to fail with 401 and trigger re-auth.
- Files: `src/lib/server/spotify.ts:27-54`
- Trigger: Any two in-flight `/api/spotify/*` requests when token is near expiry.
- Workaround: None currently. Spotify does tolerate one extra use of a refresh token in practice, but this is not guaranteed.

### [LOW] `endGame` only removes two of three localStorage keys

- Symptoms: `shitster_custom_playlists` persists after ending a game. On next setup, custom playlists reappear — intended, but the session data being cleared while custom playlists remain creates an inconsistent state if the user then re-enters setup.
- Files: `src/routes/play/+page.svelte:214-218`

---

## Fragile Areas

### [MEDIUM] Playlist URI parsing relies on positional `.split(':')[2]`

- Files: `src/routes/api/spotify/songs/random/+server.ts:65`, `src/routes/api/spotify/playlists/track-counts/+server.ts:25`
- Why fragile: `randomPlaylistUri.split(':')[2]` silently returns `undefined` if the URI format is unexpected (e.g. a URL accidentally stored in localStorage). `playlistId` then becomes `undefined`, and `/playlists/undefined/tracks` returns a Spotify 400 that surfaces as a failed attempt with no indication of the root cause.
- `track-counts` route uses `.pop()` which is slightly more robust but still relies on URI format.
- Safe modification: Use `parseSpotifyPlaylistId` (already in `src/lib/server/spotify.ts:182`) consistently in both places; it handles URIs, URLs, and bare IDs.

### [LOW] `alert()` used for user-facing auth error messages

- Files: `src/routes/play/+page.svelte:50, 109, 150`
- Why fragile: Blocks the browser thread; inconsistent UX on mobile; cannot be styled or dismissed programmatically.
- Fix: Replace with in-page error state already used elsewhere (`errorMessage`).

---

## Test Coverage Gaps

### [HIGH] Zero test files exist in the project

- What's not tested: All server endpoints, token refresh logic, playlist URI parsing, IDOR-vulnerable delete/patch routes, random-song selection algorithm.
- Files: Entire `src/` tree
- Risk: Regressions in auth, token handling, and playlist logic will be undetected until production failures.
- Priority: High — auth and token refresh are the most critical paths.

---

## Scaling Limits

### [LOW] `playedSongs` table grows unbounded per user

- Current capacity: One row per played track. No cleanup beyond the manual clear endpoint (`/api/spotify/history/clear`).
- Limit: No practical DB limit, but query at `src/routes/api/spotify/songs/random/+server.ts:48-53` loads ALL rows from last 7 days into memory, builds an in-memory array of IDs, then filters in application code.
- Scaling path: Move the deduplication filter to SQL (`NOT IN (SELECT spotify_track_id FROM played_songs WHERE ...)`) and add a periodic TTL cleanup job or DB-level row expiry.

---

*Concerns audit: 2026-05-18*
