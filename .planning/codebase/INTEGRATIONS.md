# External Integrations

**Analysis Date:** 2026-05-18

## APIs & External Services

**Spotify Web API:**
- Purpose: OAuth login, playback control, playlist/track fetching
- SDK/Client: `arctic` ^3.7.0 (OAuth/PKCE) + native `fetch` for API calls
- OAuth scopes: `user-read-email`, `user-read-private`, `streaming`, `user-read-playback-state`, `user-modify-playback-state`
- Auth env vars: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- OAuth provider init: `src/lib/server/auth/providers.ts`
- API wrapper: `src/lib/server/spotify.ts` (`spotifyFetch`, `getSpotifyAccessToken`, `refreshSpotifyToken`)
- Base URL: `https://api.spotify.com/v1`
- Token refresh URL: `https://accounts.spotify.com/api/token`
- Client-side SDK: Spotify Web Playback SDK loaded via browser (types at `src/lib/types/spotify-player.d.ts`); service at `src/lib/services/spotify-player.ts`

**Resend (Email):**
- Purpose: Transactional email — verification codes, password reset
- SDK: `resend` ^6.5.2
- Auth env vars: `RESEND_API_KEY`, `EMAIL_FROM`
- Implementation: `src/lib/server/email.ts`
- Dev mode: emails logged to console, not sent

## Data Storage

**Databases:**
- PostgreSQL
  - Connection env var: `DATABASE_URL` (format: `postgresql://user:pass@host:port/dbname`)
  - Client: `postgres` ^3.4.7 (postgres-js driver)
  - ORM: `drizzle-orm` ^0.44.7
  - DB client init: `src/lib/server/db/index.ts`
  - Schema: `src/lib/server/db/schema.ts`
  - Tables: `users`, `sessions`, `oauth_accounts`, `spotify_tokens`, `user_playlists`, `played_songs`
  - Migrations output: `./drizzle/`

**File Storage:**
- Local filesystem only — no cloud storage detected

**Caching:**
- None — no Redis or in-memory cache detected

## Authentication & Identity

**Auth Provider:**
- Spotify OAuth 2.0 with PKCE (only login method)
  - Login route: `src/routes/auth/login/spotify/+server.ts`
  - Callback route: `src/routes/auth/callback/spotify/+server.ts`
  - Logout route: `src/routes/auth/logout/+server.ts`
  - Re-auth route: `src/routes/api/auth/reauth/+server.ts`
- Session management: custom implementation in `src/lib/server/auth/session.ts`
  - Token: 20-byte random, base32-encoded; stored in `session` cookie (httpOnly, sameSite=lax)
  - Session ID: SHA-256 hash of token; stored in `sessions` DB table
  - Lifetime: 30 days, sliding (renewed past 15-day mark)
- Password hashing packages `@node-rs/argon2` and `@node-rs/bcrypt` are installed but not actively used in current auth flow (Spotify-only)

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry or similar detected

**Logs:**
- `console.error` / `console.log` used directly throughout server code

## CI/CD & Deployment

**Hosting:**
- Primary: Vercel — `vercel.json` (region `iad1`), `@sveltejs/adapter-vercel` ^6.1.2, `.vercel/project.json` present
- Secondary: Docker — `Dockerfile` (multi-stage, Node 22 Alpine), `docker-compose.yml`

**CI Pipeline:**
- None detected — no `.github/workflows/` or similar

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` — PostgreSQL connection string
- `SPOTIFY_CLIENT_ID` — Spotify app client ID
- `SPOTIFY_CLIENT_SECRET` — Spotify app client secret
- `PUBLIC_APP_URL` — Full app URL (e.g., `https://yourapp.com`); used for OAuth callback construction

**Optional env vars:**
- `NODE_ENV` — `development` | `production` | `test` (defaults to `development`)
- `RESEND_API_KEY` — Resend API key; email disabled if absent
- `EMAIL_FROM` — Sender address for transactional email

**Secrets location:**
- `.env` file (local dev, gitignored)
- `.env.example` documents all vars
- Validated at server startup via Zod in `src/lib/server/env.ts`

## Webhooks & Callbacks

**Incoming:**
- `GET /auth/callback/spotify` — Spotify OAuth PKCE callback (`src/routes/auth/callback/spotify/+server.ts`)

**Outgoing:**
- None detected

---

*Integration audit: 2026-05-18*
