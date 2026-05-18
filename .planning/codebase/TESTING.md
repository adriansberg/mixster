# Testing Patterns

**Analysis Date:** 2026-05-18

## Test Framework

**None.** No test framework is installed or configured.

- No `vitest`, `jest`, `playwright`, or `@testing-library` in `package.json`
- No `vitest.config.*` or `jest.config.*` files exist
- No `test` script in `package.json`
- No test files anywhere in the repository (`*.test.*`, `*.spec.*` — zero results)

## Test Coverage

**Zero test coverage across all code.**

No tests exist for any of the following:

**Server library functions** (`src/lib/server/`):
- `src/lib/server/spotify.ts` — `getSpotifyAccessToken`, `refreshSpotifyToken`, `spotifyFetch`, `parseSpotifyPlaylistId`, `deleteSpotifyTokens`
- `src/lib/server/auth/session.ts` — `generateSessionToken`, `createSession`, `validateSessionToken`, `invalidateSession`
- `src/lib/server/env.ts` — Zod env validation

**API route handlers** (`src/routes/api/`):
- `src/routes/api/spotify/songs/random/+server.ts`
- `src/routes/api/spotify/devices/+server.ts`
- `src/routes/api/spotify/player/play/+server.ts`
- `src/routes/api/spotify/player/pause/+server.ts`
- `src/routes/api/spotify/token/+server.ts`
- All playlist endpoints

**Auth flow** (`src/routes/auth/`):
- `src/routes/auth/callback/spotify/+server.ts` — OAuth callback with user creation/upsert logic
- `src/routes/auth/login/spotify/+server.ts`
- `src/routes/auth/logout/+server.ts`

**Client services** (`src/lib/services/`):
- `src/lib/services/spotify-player.ts` — `SpotifyPlayerService` static class

**Svelte components/pages** (`src/routes/`):
- `src/routes/play/+page.svelte`
- `src/routes/setup/+page.svelte`
- `src/routes/dashboard/+page.svelte`

## Risk Assessment

High-risk untested areas:

- **`parseSpotifyPlaylistId`** in `src/lib/server/spotify.ts` — pure function with URI/URL/bare-ID parsing logic, trivially testable, currently untested
- **`validateSessionToken`** in `src/lib/server/auth/session.ts` — session expiry and refresh logic, security-critical
- **Random song selection loop** in `src/routes/api/spotify/songs/random/+server.ts` — complex filtering + retry logic (10-attempt loop), no edge case coverage
- **OAuth callback** in `src/routes/auth/callback/spotify/+server.ts` — new user vs. existing user branching, token upsert logic

## Adding Tests

To add tests, install Vitest (matches existing Vite setup):

```bash
pnpm add -D vitest @vitest/coverage-v8
```

Add to `package.json` scripts:
```json
"test": "vitest",
"test:coverage": "vitest --coverage"
```

Pure utility functions are highest ROI starting point:
- `parseSpotifyPlaylistId` in `src/lib/server/spotify.ts`
- `generateSessionToken`, `validateSessionToken` in `src/lib/server/auth/session.ts` (with mocked DB)

---

*Testing analysis: 2026-05-18*
