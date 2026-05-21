<!-- refreshed: 2026-05-18 -->
# Codebase Structure

**Analysis Date:** 2026-05-18
**Focus:** arch

## Directory Layout

```
mixster/
├── src/
│   ├── app.d.ts                    # App.Locals type declarations (user, session)
│   ├── hooks.server.ts             # Global request hook: session validation
│   ├── lib/
│   │   ├── assets/                 # Static assets imported by components
│   │   ├── components/
│   │   │   ├── theme-toggle.svelte # Dark/light mode toggle
│   │   │   └── ui/                 # shadcn-style primitive components
│   │   │       ├── button/         # Button component + index.ts barrel
│   │   │       ├── input/          # Input component + index.ts barrel
│   │   │       └── label/          # Label component + index.ts barrel
│   │   ├── config/
│   │   │   └── playlists.ts        # defaultPlaylists: DefaultPlaylist[] (HITSTER URIs)
│   │   ├── index.ts                # Barrel: re-exports utils
│   │   ├── server/                 # Server-only modules (never imported client-side)
│   │   │   ├── auth/
│   │   │   │   ├── index.ts        # Re-exports providers + session
│   │   │   │   ├── providers.ts    # Arctic Spotify OAuth instance
│   │   │   │   └── session.ts      # generateSessionToken, createSession,
│   │   │   │                       # validateSessionToken, invalidateSession,
│   │   │   │                       # setSessionTokenCookie, deleteSessionTokenCookie
│   │   │   ├── db/
│   │   │   │   ├── index.ts        # Drizzle client (postgres-js singleton)
│   │   │   │   └── schema.ts       # Tables: users, sessions, oauthAccounts,
│   │   │   │                       #         spotifyTokens, playedSongs, userPlaylists
│   │   │   ├── email.ts            # (exists, not used in main flow)
│   │   │   ├── env.ts              # Zod-validated env: DATABASE_URL,
│   │   │   │                       # SPOTIFY_CLIENT_ID/SECRET, PUBLIC_APP_URL
│   │   │   └── spotify.ts          # getSpotifyAccessToken, spotifyFetch,
│   │   │                           # SpotifyAuthError, deleteSpotifyTokens,
│   │   │                           # parseSpotifyPlaylistId
│   │   ├── services/
│   │   │   └── spotify-player.ts   # SpotifyPlayerService (client-side, currently unused)
│   │   ├── stores/
│   │   │   └── theme.ts            # Svelte store for dark/light theme
│   │   ├── types/
│   │   │   └── spotify-player.d.ts # Spotify Web Playback SDK types
│   │   └── utils.ts                # cn() Tailwind class merge utility
│   └── routes/
│       ├── +layout.svelte          # Root layout: theme, global styles
│       ├── +page.svelte            # Landing page (/) with "START SPILL" button
│       ├── api/
│       │   ├── auth/
│       │   │   └── reauth/
│       │   │       └── +server.ts  # POST: invalidate sessions + tokens, force re-login
│       │   └── spotify/
│       │       ├── devices/
│       │       │   └── +server.ts  # GET:  /me/player/devices
│       │       ├── history/
│       │       │   └── clear/
│       │       │       └── +server.ts  # POST: delete playedSongs for user
│       │       ├── player/
│       │       │   ├── pause/
│       │       │   │   └── +server.ts  # PUT:  /me/player/pause
│       │       │   ├── play/
│       │       │   │   └── +server.ts  # PUT:  /me/player/play (trackId + deviceId)
│       │       │   └── start/
│       │       │       └── +server.ts  # PUT:  resume playback
│       │       ├── playlist/
│       │       │   ├── add/
│       │       │   │   └── +server.ts  # POST: validate + add custom playlist
│       │       │   ├── toggle/
│       │       │   │   └── +server.ts  # POST: toggle playlist active state
│       │       │   └── validate/
│       │       │       └── +server.ts  # POST: validate Spotify playlist URI/URL/ID
│       │       ├── playlists/
│       │       │   ├── +server.ts      # GET:  fetch user playlists
│       │       │   └── track-counts/
│       │       │       └── +server.ts  # POST: batch fetch track counts for URIs
│       │       ├── songs/
│       │       │   └── random/
│       │       │       └── +server.ts  # POST: pick random unplayed track,
│       │       │                       #       record in playedSongs, return track data
│       │       └── token/
│       │           └── +server.ts      # GET:  return Spotify access token to client
│       ├── auth/
│       │   ├── callback/
│       │   │   └── spotify/
│       │   │       └── +server.ts  # GET: PKCE callback, upsert user/tokens, create session
│       │   ├── login/
│       │   │   └── spotify/
│       │   │       └── +server.ts  # GET: generate state+verifier, redirect to Spotify
│       │   └── logout/
│       │       └── +server.ts      # POST: invalidate session, clear cookie, redirect /
│       ├── dashboard/
│       │   ├── +page.server.ts     # load: auth guard, return user
│       │   └── +page.svelte        # User dashboard (basic)
│       ├── play/
│       │   ├── +page.server.ts     # load: auth guard + token check, return spotifyClientId
│       │   └── +page.svelte        # Main game UI: device selector, card flip,
│       │                           #               play/pause/next controls
│       └── setup/
│           ├── +page.server.ts     # load: auth guard + token check, return defaultPlaylists
│           └── +page.svelte        # Playlist selection + session init, writes localStorage
├── static/                         # Static assets served as-is
├── drizzle.config.ts               # Drizzle Kit config (migrations)
├── svelte.config.js                # SvelteKit adapter (Vercel)
├── vite.config.ts                  # Vite config
├── tailwind.config.js              # Tailwind config
├── tsconfig.json                   # TypeScript config
├── docker-compose.yml              # Local PostgreSQL dev container
├── Dockerfile                      # App container
└── vercel.json                     # Vercel deployment config
```

## Directory Purposes

**`src/lib/server/`:**
- Purpose: All server-only business logic; SvelteKit prevents client import
- Contains: DB client, auth helpers, Spotify proxy, env validation
- Key files: `spotify.ts`, `auth/session.ts`, `db/schema.ts`, `env.ts`

**`src/lib/components/`:**
- Purpose: Reusable Svelte UI components
- Contains: shadcn-style primitives under `ui/`; each has `component.svelte` + `index.ts` barrel
- Key files: `ui/button/button.svelte`, `ui/input/input.svelte`

**`src/lib/config/`:**
- Purpose: Static application configuration
- Contains: `playlists.ts` — the only file; defines 6 default HITSTER playlists

**`src/lib/services/`:**
- Purpose: Client-side service classes (currently just `SpotifyPlayerService`)
- Note: `SpotifyPlayerService` is not used in the active play flow

**`src/lib/types/`:**
- Purpose: TypeScript ambient type declarations
- Contains: `spotify-player.d.ts` for Spotify Web Playback SDK global types

**`src/routes/api/`:**
- Purpose: SvelteKit server-side API endpoints; all require authenticated `locals.user`
- Contains: Spotify proxy routes + auth utility routes
- Pattern: Each leaf dir has one `+server.ts` exporting named HTTP method handlers

**`src/routes/auth/`:**
- Purpose: OAuth flow handlers (not API — no JSON responses, only redirects)
- Contains: login initiation, OAuth callback, logout

**`src/routes/play/`:**
- Purpose: Core game experience
- Key interaction: `+page.server.ts` guards auth; `+page.svelte` runs entire game loop

**`src/routes/setup/`:**
- Purpose: Pre-game configuration (playlist selection, session init)
- Key interaction: Reads `defaultPlaylists` from server; writes selections to `localStorage`

## Key File Locations

**Entry Points:**
- `src/hooks.server.ts`: Every server request; session hydration
- `src/routes/+layout.svelte`: Root UI shell
- `src/routes/+page.svelte`: Landing page `/`

**Configuration:**
- `src/lib/server/env.ts`: All validated environment variables
- `src/lib/config/playlists.ts`: Default playlist registry
- `drizzle.config.ts`: Database migration config

**Core Logic:**
- `src/lib/server/spotify.ts`: Spotify token management + API proxy
- `src/lib/server/auth/session.ts`: Session lifecycle
- `src/lib/server/db/schema.ts`: Full database schema
- `src/routes/api/spotify/songs/random/+server.ts`: Game core — random track selection with dedup

**Auth Flow:**
- `src/routes/auth/login/spotify/+server.ts`: OAuth start
- `src/routes/auth/callback/spotify/+server.ts`: OAuth complete, user upsert
- `src/routes/auth/logout/+server.ts`: Session teardown

**Testing:**
- Not present — no test files detected

## Naming Conventions

**Files:**
- SvelteKit conventions: `+page.svelte`, `+page.server.ts`, `+layout.svelte`, `+server.ts`
- Library files: `camelCase.ts` (e.g., `spotify.ts`, `session.ts`, `playlists.ts`)
- Components: `kebab-case.svelte` (e.g., `theme-toggle.svelte`, `button.svelte`)

**Directories:**
- Routes: `kebab-case` matching URL segments (e.g., `track-counts`, `play`)
- Library dirs: `kebab-case` (e.g., `lib/server`, `lib/components/ui`)

**Variables/Functions:**
- `camelCase` for functions and variables
- `PascalCase` for classes (`SpotifyPlayerService`, `SpotifyAuthError`) and interfaces
- `UPPER_SNAKE_CASE` for env var names

**localStorage Keys:**
- `mixster_session_id` — nanoid game session identifier
- `mixster_selected_defaults` — JSON array of default playlist IDs
- `mixster_custom_playlists` — JSON array of `{ id, name, uri, trackCount }`
- `mixster_default_track_counts` — cached track count map (24h TTL)
- `mixster_default_track_counts_timestamp` — cache timestamp

## Where to Add New Code

**New Spotify API proxy endpoint:**
- Create `src/routes/api/spotify/<resource>/+server.ts`
- Export named handler (`GET`, `POST`, `PUT`, `DELETE`)
- Check `locals.user`, call `spotifyFetch()`, catch `SpotifyAuthError`

**New page (auth-required):**
- Create `src/routes/<name>/+page.server.ts` with auth guard (see `src/routes/play/+page.server.ts` for pattern)
- Create `src/routes/<name>/+page.svelte`

**New DB table:**
- Add to `src/lib/server/db/schema.ts`
- Run `pnpm drizzle-kit generate` then `pnpm drizzle-kit migrate`

**New shared server utility:**
- `src/lib/server/<name>.ts`

**New reusable UI component:**
- `src/lib/components/ui/<name>/<name>.svelte` + `index.ts` barrel
- Or `src/lib/components/<name>.svelte` for non-primitive components

**New static config:**
- `src/lib/config/<name>.ts`

**New TypeScript types (shared):**
- `src/lib/types/<name>.ts` or `.d.ts` for ambient declarations

## Special Directories

**`.svelte-kit/`:**
- Purpose: SvelteKit build output and generated types
- Generated: Yes
- Committed: No

**`.vercel/`:**
- Purpose: Vercel deployment artifacts
- Generated: Yes
- Committed: No (typically)

**`.planning/`:**
- Purpose: GSD planning documents
- Generated: By GSD tooling
- Committed: Yes

---

*Structure analysis: 2026-05-18*
