# Shitster

## What This Is

Shitster is a Spotify-powered party jukebox game inspired by the board game Hitster. One person hosts on a single screen — the app plays a random song from selected Spotify playlists, the group debates the release year, and the host flips the card to reveal the answer. No scoring, no phones needed — just music and social play.

## Core Value

Any party with a Spotify account can play a Hitster-style game with their own playlists — no physical cards, no preset content.

## Requirements

### Validated

- ✓ Spotify OAuth (PKCE) — existing
- ✓ Random song selection from playlists (default HITSTER playlists + custom) — existing
- ✓ 7-day play history dedup (same songs don't repeat) — existing
- ✓ Spotify device selection + playback control (play/pause) — existing
- ✓ Song reveal flip card (CSS 3D, artist + year shown on back) — existing
- ✓ Custom playlists stored in localStorage (add/toggle enabled state) — existing (partial — routes exist but UI is incomplete)
- ✓ Spotify re-auth flow (SpotifyAuthError → redirect to login) — existing (uncommitted)

### Active

- [ ] Custom playlist add UI — paste Spotify URL/URI, app resolves name + track count, stored in localStorage
- [ ] Playlist toggle UI — enable/disable individual playlists per session; state persists in localStorage
- [ ] Setup page UX polish — clear flow from playlist selection to starting game
- [ ] Play page UX polish — clean party display, mobile/TV-friendly layout
- [ ] Session management — hard-clear play history option; playlist selections retained across clears
- [ ] Dead code + DB cleanup — remove dead userPlaylists DB routes, SpotifyPlayerService, email scaffolding; fix IDOR bugs

### Out of Scope

- Per-player scoring or leaderboards — "just the jukebox" social game; no tracking needed
- Player phones / multi-device — single-screen experience
- Decade/era filtering within playlists — playlist selection is the filter
- Email/password auth — Spotify-only OAuth
- Playlist search by name — paste URL/URI is sufficient

## Context

- Built on SvelteKit 2 + Svelte 5 (runes), TypeScript, Tailwind CSS, Drizzle ORM + PostgreSQL, deployed to Vercel
- Spotify API used for: playlist metadata, track selection, playback control (all proxied server-side — browser never holds Spotify tokens)
- Playlist state (selected playlists, enabled/disabled, custom URIs) lives in localStorage — intentional, no per-user DB persistence needed
- Play history (dedup) lives in DB (`playedSongs` table) — persists across page reloads, manually clearable
- Default playlists: 6 official HITSTER playlists (Norway, Sweden, Nordics Rock, Soundtracks, UK Guilty Pleasures, Platinum)
- Technical debt to address before UX work: dead `userPlaylists` DB table + 3 routes with IDOR bugs; dead `SpotifyPlayerService` + token endpoint; dead email scaffolding
- App name in code: "shitster" (localStorage keys: `shitster_*`); Norwegian UI copy ("NESTE SANG", "VIS SANG", "START SPILL")

## Constraints

- **Tech stack**: SvelteKit + Svelte 5 runes — no React, no Svelte stores for server state
- **Spotify**: Requires active Spotify Premium account for playback control (Spotify API limitation)
- **Storage**: Playlist state in localStorage — tied to browser/device, acceptable for party use
- **Auth**: Spotify OAuth only — no email/password flows
- **Deployment**: Vercel (primary) — adapter-vercel configured

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Playlists in localStorage (not DB) | Single-device party use; simpler than DB per-user state | ✓ Good |
| Server-side Spotify API proxy | Tokens never in browser; security | ✓ Good |
| No scoring/player tracking | "Just the jukebox" — social game, host decides who wins | ✓ Good |
| SpotifyAuthError throw pattern | Clean error propagation from spotify.ts to API routes to client | ✓ Good |
| Remove dead DB playlist routes | IDOR bugs + architectural confusion — localStorage is the source of truth | — Pending |

---
*Last updated: 2026-05-18 after initial project initialization*
