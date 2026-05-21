<!-- refreshed: 2026-05-18 -->
# Architecture

**Analysis Date:** 2026-05-18
**Focus:** arch

## System Overview

```text
┌────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│   /           /setup          /play          /dashboard         │
│  +page.svelte  +page.svelte   +page.svelte   +page.svelte       │
│                    │               │                            │
│     localStorage (playlists, session_id, track counts)          │
└─────────────────────┬─────────────┬────────────────────────────┘
                      │ fetch()     │ fetch()
                      ▼             ▼
┌────────────────────────────────────────────────────────────────┐
│                   SvelteKit Server                              │
│  hooks.server.ts  →  event.locals.{user, session}              │
│                                                                 │
│  Page load fns:          API routes:                           │
│  +page.server.ts         /api/spotify/*   /api/auth/*          │
│  (auth guard + SSR)      +server.ts files                      │
└──────────┬──────────────────────┬──────────────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────────────────────────┐
│  lib/server/db   │   │  lib/server/spotify.ts               │
│  Drizzle ORM     │   │  getSpotifyAccessToken()             │
│  postgres-js     │   │  spotifyFetch()  (token refresh)     │
│  schema.ts       │   │  SpotifyAuthError                    │
└──────────────────┘   └──────────────┬───────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐   ┌──────────────────────────────────────┐
│  PostgreSQL DB   │   │  Spotify Web API                     │
│  (Neon/Vercel)   │   │  api.spotify.com/v1/*                │
└──────────────────┘   └──────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `hooks.server.ts` | Session validation on every request; populates `event.locals` | `src/hooks.server.ts` |
| `lib/server/auth` | Session CRUD, cookie management, Arctic OAuth provider | `src/lib/server/auth/` |
| `lib/server/spotify.ts` | Token retrieval + auto-refresh, authenticated Spotify API proxy | `src/lib/server/spotify.ts` |
| `lib/server/db` | Drizzle client + schema definitions | `src/lib/server/db/` |
| `lib/server/env.ts` | Zod-validated env vars, throws at startup if invalid | `src/lib/server/env.ts` |
| `lib/config/playlists.ts` | Hard-coded default HITSTER playlist definitions | `src/lib/config/playlists.ts` |
| `lib/services/spotify-player.ts` | Client-side Spotify API calls using access token (unused in current play flow) | `src/lib/services/spotify-player.ts` |
| Page `+page.server.ts` files | Auth guard redirects, SSR data loading | `src/routes/*/+page.server.ts` |
| API `+server.ts` files | Server-side Spotify proxies; all require `locals.user` | `src/routes/api/spotify/*/+server.ts` |

## Pattern Overview

**Overall:** SvelteKit with server-side auth guard pattern. All Spotify API calls are proxied through SvelteKit API routes — the browser never holds a Spotify access token directly. Playlist selection and game session state live in `localStorage`; play history lives in the DB.

**Key Characteristics:**
- Session stored as opaque cookie (`session`); token hashed with SHA-256 before DB lookup
- Spotify tokens stored per-user in DB; auto-refreshed by `getSpotifyAccessToken()` on every API call
- `SpotifyAuthError` thrown when tokens are irrecoverably invalid; API routes catch it and return `{ requiresReauth: true }` — client redirects to `/auth/login/spotify`
- Custom playlists stored client-side in `localStorage` (`mixster_custom_playlists`), sent as URIs in POST body to `/api/spotify/songs/random`
- No Svelte stores used for server state; all reactive state is Svelte 5 `$state` runes within page components

## Layers

**Request Middleware:**
- Purpose: Session hydration on every request
- Location: `src/hooks.server.ts`
- Contains: Single `handle` export calling `validateSessionToken`
- Depends on: `lib/server/auth`
- Used by: All routes via `event.locals`

**Auth Layer:**
- Purpose: Spotify OAuth (PKCE), session management, cookie helpers
- Location: `src/lib/server/auth/`
- Contains: `providers.ts` (Arctic `Spotify` instance), `session.ts` (generate/validate/invalidate), `index.ts` (re-exports)
- Depends on: `lib/server/db`, `@oslojs/crypto`, `arctic`
- Used by: `hooks.server.ts`, auth route handlers, API routes needing `locals.user`

**Spotify API Proxy Layer:**
- Purpose: Authenticated calls to Spotify Web API with auto-refresh
- Location: `src/lib/server/spotify.ts`
- Contains: `getSpotifyAccessToken()`, `spotifyFetch()`, `SpotifyAuthError`, `deleteSpotifyTokens()`, `parseSpotifyPlaylistId()`
- Depends on: `lib/server/db`, `lib/server/env`
- Used by: All `/api/spotify/*` route handlers

**API Routes:**
- Purpose: Server-side Spotify proxies and auth utilities
- Location: `src/routes/api/`
- Contains: `+server.ts` files exporting HTTP method handlers
- Depends on: `lib/server/spotify`, `lib/server/auth`, `lib/server/db`
- Used by: Browser `fetch()` calls from page components

**Page Layer:**
- Purpose: UI, game flow, client-side state
- Location: `src/routes/` (`.svelte` and `+page.server.ts` files)
- Contains: Svelte 5 rune-based components, `onMount` data fetching
- Depends on: API routes (via `fetch`), `localStorage`, `$app/navigation`
- Used by: End users

## Data Flow

### Primary Game Flow

1. User visits `/` (`src/routes/+page.svelte`) — clicks "START SPILL" → `goto('/setup')`
2. `/setup` load fn (`src/routes/setup/+page.server.ts`) — checks `locals.user` + DB token, redirects to Spotify login if missing; returns `defaultPlaylists`
3. Setup page stores selections in `localStorage` (`mixster_selected_defaults`, `mixster_custom_playlists`, `mixster_session_id`)
4. `/play` load fn (`src/routes/play/+page.server.ts`) — same auth guard
5. Play page `onMount` → `GET /api/spotify/devices` → returns available Spotify devices
6. User clicks "NESTE SANG" → `POST /api/spotify/songs/random` with `{ sessionId, selectedDefaultPlaylists, customPlaylistUris }`
7. Server: `spotifyFetch()` calls Spotify playlist + track endpoints, filters against `playedSongs` table (last 7 days), picks random track, inserts into `playedSongs`, returns `{ track }`
8. Play page: calls `PUT /api/spotify/player/play` with `{ trackId, deviceId }` → server proxies `PUT /me/player/play?device_id=...` to Spotify
9. User clicks "VIS SANG" → card flips (CSS 3D), `PUT /api/spotify/player/pause` called

### Auth Flow

1. `GET /auth/login/spotify` — generates PKCE state + verifier, sets httpOnly cookies, redirects to `accounts.spotify.com`
2. Spotify redirects to `GET /auth/callback/spotify` with `code` + `state`
3. State verified against cookie; Arctic validates code; Spotify `/v1/me` fetched
4. DB upsert: `users`, `oauthAccounts`, `spotifyTokens` (insert or conflict-update)
5. Session created: `generateSessionToken()` → `createSession()` → `setSessionTokenCookie()`
6. Redirect to `/play`

### Token Refresh Flow

1. Any API route calls `spotifyFetch(userId, endpoint)`
2. `getSpotifyAccessToken(userId)` queries `spotifyTokens` table
3. If `expiresAt < now + 60s` → calls `refreshSpotifyToken()` → `POST accounts.spotify.com/api/token`
4. Updates `spotifyTokens.accessToken` + `expiresAt` in DB
5. On 401 from Spotify or refresh failure: `deleteSpotifyTokens(userId)` + throws `SpotifyAuthError`
6. API route catches `SpotifyAuthError`, returns `{ requiresReauth: true, status: 401 }`
7. Client detects `requiresReauth`, redirects to `/auth/login/spotify`

**State Management:**
- Server session: `sessions` table + `session` cookie (30-day rolling)
- Spotify tokens: `spotifyTokens` table (per-user, refreshed in-place)
- Play history: `playedSongs` table (7-day dedup window)
- Playlist selection + session config: `localStorage` (client-only)
- UI state: Svelte 5 `$state` runes local to each page component

## Key Abstractions

**`spotifyFetch<T>`:**
- Purpose: Single authenticated fetch wrapper covering token get/refresh/error
- File: `src/lib/server/spotify.ts`
- Pattern: All `/api/spotify/*` handlers call this; never call Spotify directly

**`SpotifyAuthError`:**
- Purpose: Typed error signalling irrecoverable auth failure
- File: `src/lib/server/spotify.ts`
- Pattern: Thrown by `spotifyFetch`, caught at API route boundary, translated to `{ requiresReauth: true }`

**`defaultPlaylists`:**
- Purpose: Curated HITSTER playlist registry
- File: `src/lib/config/playlists.ts`
- Pattern: Loaded by `/setup` server load; IDs sent by client; resolved to URIs server-side in `/api/spotify/songs/random`

**`SpotifyPlayerService`:**
- Purpose: Client-side static class wrapping Spotify playback API with raw token
- File: `src/lib/services/spotify-player.ts`
- Pattern: Not currently used in the main play flow (play routes go through server proxy instead); exists as dead/alternative code

## Entry Points

**HTTP entry:**
- Location: `src/hooks.server.ts`
- Triggers: Every request
- Responsibilities: Session cookie → `event.locals.user` / `event.locals.session`

**Page loads:**
- Location: `src/routes/*/+page.server.ts`
- Triggers: SSR page render
- Responsibilities: Auth guard (redirect if unauthenticated), pass server data to component

**OAuth initiation:**
- Location: `src/routes/auth/login/spotify/+server.ts`
- Triggers: `GET /auth/login/spotify`
- Responsibilities: PKCE setup, redirect to Spotify

## Architectural Constraints

- **Server-only modules:** Everything under `src/lib/server/` uses `$lib/server/*` imports and must not be imported from client components (SvelteKit enforces this)
- **Global state:** `db` singleton in `src/lib/server/db/index.ts` (module-level `postgres` client); `spotify` OAuth provider singleton in `src/lib/server/auth/providers.ts`
- **Circular imports:** None detected
- **localStorage coupling:** `/play` and `/setup` pages read/write `localStorage` keys (`mixster_session_id`, `mixster_selected_defaults`, `mixster_custom_playlists`, `mixster_default_track_counts`) — these keys are an implicit API between the two pages
- **No Svelte stores for server state:** All persistent state flows through DB or `localStorage`; Svelte stores only used for theme (`src/lib/stores/theme.ts`)

## Anti-Patterns

### `SpotifyPlayerService` — unused client-side class

**What happens:** `src/lib/services/spotify-player.ts` defines a `SpotifyPlayerService` that calls Spotify API directly from the browser using a raw access token.
**Why it's wrong:** The current play flow doesn't use it — all playback goes through `/api/spotify/player/*` server routes instead. The class is dead code and would expose access tokens to the browser if wired up.
**Do this instead:** Continue proxying through server routes (`src/routes/api/spotify/player/play/+server.ts`, etc.) which keep tokens server-side.

### Inline type definitions in route files

**What happens:** `SpotifyPlaylistResponse`, `SpotifyTrack`, `SpotifyUser`, and `SpotifyDevice` interfaces are defined inline inside individual `+server.ts` files.
**Why it's wrong:** Duplicates Spotify type surface across files; no central source of truth.
**Do this instead:** Consolidate into `src/lib/types/` (directory already exists at `src/lib/types/spotify-player.d.ts`).

## Error Handling

**Strategy:** Catch `SpotifyAuthError` at API route boundary; propagate all other errors as 500 JSON responses. Client checks `response.requiresReauth` flag.

**Patterns:**
- `spotifyFetch` throws `SpotifyAuthError` on 401 or refresh failure; callers wrap in `try/catch`
- Page components check `data.requiresReauth` in fetch responses and call `goto('/auth/login/spotify')`
- `validateEnv()` in `src/lib/server/env.ts` throws synchronously at startup if required vars missing

## Cross-Cutting Concerns

**Logging:** `console.error` / `console.log` — no structured logging library
**Validation:** Zod for env vars (`src/lib/server/env.ts`); `parseSpotifyPlaylistId()` for playlist input; minimal input validation in API routes
**Authentication:** `hooks.server.ts` populates `locals.user`; each `+page.server.ts` and API route independently checks `locals.user` (no shared middleware guard helper)

---

*Architecture analysis: 2026-05-18*
