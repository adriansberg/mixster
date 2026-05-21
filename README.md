# Mixster

A Spotify-powered party game inspired by [Hitster](https://hitstergame.com). One screen, no phones needed — the app plays a random song from your Spotify playlists, the group debates the release year, and the host flips the card to reveal the answer.

**The key difference from the original:** bring any Spotify playlist. No physical cards, no preset content.

## How it works

1. Host logs in with Spotify and picks playlists (default HITSTER playlists or your own)
2. Hit **START FØRSTE SANG** — the app picks a random song and starts playing it on your Spotify device
3. Group listens and guesses the release year
4. Host flips the card to reveal artist, song title, and year
5. Repeat

No scoring. No phones. Just music and social play.

## Requirements

- [Spotify Premium](https://spotify.com/premium) account (required for playback control via Spotify API)
- A Spotify app with OAuth credentials (see setup below)
- PostgreSQL database
- Node.js 20+

## Setup

### 1. Clone and install

```bash
git clone https://github.com/yourusername/mixster
cd mixster
npm install
```

### 2. Create a Spotify app

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://127.0.0.1:5173/auth/callback/spotify` as a Redirect URI (and your production URL when deploying)
4. Copy your **Client ID** and **Client Secret**

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mixster

SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret

PUBLIC_APP_URL=http://127.0.0.1:5173
```

### 4. Set up the database

```bash
npm run db:push
```

### 5. Run

```bash
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Deploying to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables (same as `.env`, with production values)
4. Add your Vercel deployment URL as a Redirect URI in your Spotify app

## Tech stack

- [SvelteKit 2](https://kit.svelte.dev) + Svelte 5 (runes)
- [Drizzle ORM](https://orm.drizzle.team) + PostgreSQL
- [Tailwind CSS v4](https://tailwindcss.com)
- [Arctic](https://arcticjs.dev) for Spotify OAuth (PKCE)
- Vercel

## Notes

- Playlist selections are stored in `localStorage` — tied to the browser, intentional for party use
- Play history (7-day dedup) is stored in the database so songs don't repeat within a session
- All Spotify API calls are proxied server-side — the browser never holds Spotify tokens
- Norwegian UI copy by design (the game is Norwegian in origin)
- Requires Spotify Premium for playback control (Spotify API limitation, not ours)
