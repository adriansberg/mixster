# Mixster — Project Instructions

## Project

Spotify-powered party jukebox game (Hitster-style). One screen, social play, no scoring. SvelteKit 2 + Svelte 5 runes, Drizzle ORM + PostgreSQL, Tailwind CSS, Vercel.

## GSD Workflow

This project uses Get Shit Done (GSD) for structured planning and execution.

**Planning files:** `.planning/`
- `PROJECT.md` — project context and requirements
- `REQUIREMENTS.md` — v1 requirements with REQ-IDs
- `ROADMAP.md` — 4-phase plan
- `STATE.md` — current project state
- `config.json` — workflow settings (YOLO, coarse, parallel)
- `research/` — domain research
- `codebase/` — codebase analysis

**Current state:** Game loop working — Spotify Feb 2026 API migration done, Web Playback SDK embedded as primary playback, PWA + iOS playback hardening landed. Party-ready.

**Next command:** `/gsd:discuss-phase 1` or `/gsd:plan-phase 1`

## Tech Stack

- **Framework:** SvelteKit 2 + Svelte 5 (runes — use `$state`, `$derived`, `$effect`)
- **DB:** Drizzle ORM + PostgreSQL (postgres-js driver)
- **Auth:** Arctic OAuth (Spotify PKCE), @oslojs/crypto session tokens
- **Styling:** Tailwind CSS v4, lucide-svelte (UI components hand-rolled)
- **Playback:** Spotify Web Playback SDK primary (`src/lib/client/spotify-player.svelte.ts`), Spotify Connect fallback; PWA via `@vite-pwa/sveltekit`
- **Deploy:** Vercel (`@sveltejs/adapter-vercel`)

## Key Conventions

- All Spotify API calls proxied server-side — browser never holds tokens
- `spotifyFetch<T>()` in `src/lib/server/spotify.ts` is the one authenticated fetch wrapper
- `SpotifyAuthError` thrown on irrecoverable auth failure → caught at API route boundary → `{ requiresReauth: true, status: 401 }`
- Playlist state in localStorage (`mixster_playlists`) — NOT in DB
- Play history dedup in DB (`playedSongs` table, 7-day window)
- Svelte 5 runes only — no Svelte stores for server state

## Critical: Do Not Touch

- `src/routes/api/spotify/playlist/validate/+server.ts` — live caller in setup page
- `src/lib/server/db/` — schema changes require Drizzle migration
- `src/hooks.server.ts` — session validation middleware

## Spotify API gotchas

- Playlist **tracks sub-resource** (`/playlists/{id}/items`) is the migrated endpoint — `songs/random` uses it. Field access is `.items?.items`, not `.tracks.items`.
- Playlist **object metadata** (`/playlists/{id}?fields=...`) still exposes total at `tracks.total`, NOT `items.total` (the `items` rename applies only to the sub-resource). Read `tracks?.total ?? items?.total ?? 0` defensively.
