# Coding Conventions

**Analysis Date:** 2026-05-18

## Naming Patterns

**Files:**
- SvelteKit routes: SvelteKit filesystem convention — `+page.svelte`, `+page.server.ts`, `+server.ts`, `+layout.svelte`
- Library files: `kebab-case.ts` — `spotify-player.ts`, `theme.ts`, `env.ts`
- UI components: `kebab-case.svelte` — `button.svelte`, `theme-toggle.svelte`
- DB schema: single file `src/lib/server/db/schema.ts`

**Functions:**
- camelCase throughout — `getSpotifyAccessToken`, `refreshSpotifyToken`, `validateSessionToken`, `deleteSpotifyTokens`
- Async server functions named for their HTTP verb in route files — `GET`, `POST`, `PUT` (exported named consts or named async functions)
- Two styles coexist: `export async function GET(event: RequestEvent)` and `export const GET: RequestHandler = async ({ locals }) => {}`

**Variables:**
- camelCase — `accessToken`, `refreshToken`, `expiresAt`, `sessionId`, `currentTrack`
- Boolean flags: `is`/`has` prefix — `isRevealed`, `isPlaying`, `needsRefresh`
- Svelte 5 runes: `$state()`, `$props()` (no Svelte 4 `let` reactivity)

**Types/Interfaces:**
- PascalCase — `SpotifyTokens`, `SpotifyAuthError`, `SessionValidationResult`, `SpotifyUser`
- Interfaces defined locally at bottom of file when file-scoped — `SpotifyPlaylistResponse`, `SpotifyTrack` in `songs/random/+server.ts`
- Shared types exported from module entry points — `Session`, `User` from `$lib/server/auth`

**DB schema:**
- Table names: camelCase export, snake_case SQL column — `spotifyTokens` exported, `'spotify_tokens'` in SQL
- Column names: camelCase TS, snake_case SQL — `userId` → `'user_id'`

## Code Style

**Formatter:** Prettier 3.x
- Tabs (not spaces), tab width 2
- Single quotes
- No trailing commas
- Print width: 80
- `prettier-plugin-svelte` for `.svelte` files

**Linter:** ESLint 9 flat config (`eslint.config.js`)
- `@typescript-eslint/recommended` rules
- `@typescript-eslint/no-explicit-any`: `warn` (not error)
- `svelte/no-navigation-without-resolve`: `off`
- `eslint-config-prettier` applied last to disable style conflicts
- `src/lib/components/ui/**` excluded from linting

**TypeScript:**
- `strict: true` in `tsconfig.json`
- `moduleResolution: "bundler"`
- `allowJs: true` with `checkJs: true` — JS files also type-checked
- Explicit `RequestEvent` typing on SvelteKit handlers

## Import Organization

**Order (observed pattern):**
1. SvelteKit framework imports — `import { json } from '@sveltejs/kit'`
2. ORM/query imports — `import { eq, and, gte } from 'drizzle-orm'`
3. Internal `$lib/server/` imports
4. Internal `$lib/` (non-server) imports
5. Type-only imports last — `import type { RequestEvent } from '@sveltejs/kit'`

**Path Aliases:**
- `$lib` → `src/lib/` (SvelteKit default)
- `$app/navigation`, `$env/dynamic/private`, `$env/dynamic/public` (SvelteKit virtual)
- No custom aliases defined beyond SvelteKit defaults

**No barrel re-exports** except:
- `src/lib/server/auth/index.ts` re-exports from `providers.ts` and `session.ts`
- `src/lib/components/ui/button/index.ts`, `input/index.ts`, `label/index.ts` (shadcn-style)

## Error Handling

**Server-side API routes:**
- Wrap in `try/catch`
- Check `instanceof SpotifyAuthError` first, return `json({ error, requiresReauth: true }, { status: 401 })`
- Fall through to generic `console.error` + `json({ error }, { status: 500 })`
- Auth guard at top of every handler: `if (!user) return json({ error: 'Unauthorized' }, { status: 401 })`

**Custom error class:**
```typescript
// src/lib/server/spotify.ts
export class SpotifyAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpotifyAuthError';
  }
}
```

**Client-side (Svelte):**
- `try/catch` around `fetch` calls
- Set `errorMessage` state string for display
- Check `data.requiresReauth` on response, call `alert()` then `goto('/auth/login/spotify')`
- `alert()` used for user feedback (no toast system)

**Environment:**
- Zod schema validation at startup in `src/lib/server/env.ts` — throws descriptive error listing missing vars

## Logging

- `console.error(...)` for errors throughout server code
- No structured logging library
- Debug `console.log` left in production code — `console.log('data', data)` in `play/+page.svelte:55`
- No log levels, no request IDs

## Comments

**JSDoc-style comments on exported functions** in `src/lib/server/spotify.ts`:
```typescript
/**
 * Get valid Spotify access token for a user, refreshing if necessary
 */
export async function getSpotifyAccessToken(userId: string): Promise<string | null>
```

**Inline comments** for non-obvious logic — token expiry math, 204 handling, re-auth logic.

**Dead code noted with comments** — `src/lib/server/db/schema.ts` line 47: `// Note: userPlaylists table is no longer used`

## Function Design

**Size:** Functions generally single-responsibility and short (10–40 lines). Exception: `POST` handler in `songs/random/+server.ts` (~150 lines, handles full song selection loop).

**Parameters:** Single object destructuring for SvelteKit handlers. Primitives for lib functions.

**Return values:** Consistent `T | null` for async operations that may fail — `Promise<string | null>`, `Promise<SpotifyTokens | null>`.

## Component Design (Svelte 5)

**Runes API used throughout** — `$state()`, `$props()`, `$derived` (if needed)

**Interfaces defined inside `<script lang="ts">`** for component-local types — `Track`, `SpotifyDevice` in `play/+page.svelte`

**`<style>` blocks** used for component-scoped CSS when Tailwind is insufficient (flip card animation in `play/+page.svelte`)

**UI primitives** in `src/lib/components/ui/` follow shadcn-svelte pattern:
- Props typed via `HTMLButtonAttributes & { ... }` intersection
- `cn()` utility from `$lib/utils` for class merging
- `$props()` destructuring with defaults

## Module Design

**Server-only code** in `src/lib/server/` — enforced by SvelteKit server-only import restriction

**Services pattern inconsistency:** `src/lib/services/spotify-player.ts` (static class) duplicates functionality already in `src/lib/server/spotify.ts` (standalone functions). The server routes use `spotifyFetch` from `$lib/server/spotify`, not `SpotifyPlayerService`.

---

*Convention analysis: 2026-05-18*
