# Shitster — Project Instructions

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

**Current state:** Phase 1 ready to plan — game loop is broken due to Spotify Feb 2026 API changes.

**Next command:** `/gsd:discuss-phase 1` or `/gsd:plan-phase 1`

## Tech Stack

- **Framework:** SvelteKit 2 + Svelte 5 (runes — use `$state`, `$derived`, `$effect`)
- **DB:** Drizzle ORM + PostgreSQL (postgres-js driver)
- **Auth:** Arctic OAuth (Spotify PKCE), @oslojs/crypto session tokens
- **Styling:** Tailwind CSS v4, bits-ui, lucide-svelte
- **Deploy:** Vercel (`@sveltejs/adapter-vercel`)

## Key Conventions

- All Spotify API calls proxied server-side — browser never holds tokens
- `spotifyFetch<T>()` in `src/lib/server/spotify.ts` is the one authenticated fetch wrapper
- `SpotifyAuthError` thrown on irrecoverable auth failure → caught at API route boundary → `{ requiresReauth: true, status: 401 }`
- Playlist state in localStorage (`shitster_playlists`) — NOT in DB
- Play history dedup in DB (`playedSongs` table, 7-day window)
- Svelte 5 runes only — no Svelte stores for server state

## Critical: Do Not Touch

- `src/routes/api/spotify/playlist/validate/+server.ts` — live caller in setup page
- `src/lib/server/db/` — schema changes require Drizzle migration
- `src/hooks.server.ts` — session validation middleware

## Known Issues (to fix in Phase 1)

- `src/routes/api/spotify/songs/random/+server.ts` uses deprecated `/tracks` endpoint — must migrate to `/items`
- All `.tracks.items` field access must become `.items?.items`
