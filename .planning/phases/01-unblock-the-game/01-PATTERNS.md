# Phase 1: Unblock the Game - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 6 modified + 1 new
**Analogs found:** 6 / 6 (exact matches)

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/routes/api/spotify/songs/random/+server.ts` | API route (POST) | request-response CRUD | self (existing pattern) | exact |
| `src/routes/api/spotify/playlist/validate/+server.ts` | API route (POST) | request-response CRUD | `songs/random` | exact |
| `src/routes/api/spotify/playlists/track-counts/+server.ts` | API route (POST) | request-response CRUD | `songs/random` | exact |
| `src/lib/server/spotify.ts` | shared auth service | request-response | self (existing pattern) | exact |
| `src/routes/api/spotify/devices/+server.ts` | API route (GET) | request-response | existing file (commit-only) | exact |
| `src/routes/api/spotify/player/play/+server.ts` | API route (PUT) | request-response | existing file (commit-only) | exact |
| `src/routes/api/auth/reauth/+server.ts` | API route (POST) | request-response | existing file (commit-only) | exact |
| `src/lib/types/spotify-player.d.ts` | TypeScript types | N/A | existing file (commit-only) | exact |

## Pattern Assignments

### `src/routes/api/spotify/songs/random/+server.ts` (API route, request-response CRUD)

**Primary changes:** Migrate `/tracks` → `/items` endpoint, implement random offset strategy, include album metadata in fields query, fix URI parsing, update retry loop.

**Imports pattern** (lines 1-9):
```typescript
import { json } from '@sveltejs/kit';
import { and, eq, gte } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { playedSongs } from '$lib/server/db/schema';
import { spotifyFetch, SpotifyAuthError } from '$lib/server/spotify';
import { defaultPlaylists } from '$lib/config/playlists';
import type { RequestEvent } from '@sveltejs/kit';
```

**Auth guard + error boundary pattern** (lines 11-18):
```typescript
export async function POST(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		// handler body
	} catch (error) {
		if (error instanceof SpotifyAuthError) {
			return json({ 
				error: 'Spotify authentication failed', 
				requiresReauth: true 
			}, { status: 401 });
		}
		console.error('Error getting random song:', error);
		return json({ error: 'Failed to get random song' }, { status: 500 });
	}
}
```

**Request body parsing pattern** (lines 19-27):
```typescript
const {
	sessionId,
	selectedDefaultPlaylists = [],
	customPlaylistUris = []
} = await event.request.json();

if (!sessionId || typeof sessionId !== 'string') {
	return json({ error: 'Invalid session ID' }, { status: 400 });
}
```

**DB query pattern for dedup** (lines 46-55):
```typescript
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const recentlyPlayed = await db.query.playedSongs.findMany({
	where: and(
		eq(playedSongs.userId, user.id),
		gte(playedSongs.playedAt, sevenDaysAgo)
	)
});
const playedTrackIds = recentlyPlayed.map((s) => s.spotifyTrackId);
```

**Existing retry loop pattern to modify** (lines 58-132):
- Current: `while (attempts < maxAttempts) { ... attempts++ on skip }` at line 61
- Current: Line 65 uses `.split(':')[2]` for URI parsing — **REPLACE with `parseSpotifyPlaylistId(randomPlaylistUri)`**
- Current: Line 70 calls `/playlists/${playlistId}/tracks?limit=100&fields=...` — **REPLACE endpoint `/items` and update fields query**
- Current: Lines 100-107 make separate `/tracks/{id}` call for release_date — **ELIMINATE by including `album(release_date,images)` in /items fields**

**Spotify response types to update** (lines 153-176):
Replace existing `SpotifyPlaylistResponse` and `SpotifyTrack` with:
```typescript
interface SpotifyPlaylistResponse {
	items: Array<{
		track: {
			id: string;
			name: string;
			artists: Array<{ name: string }>;
			album: {
				release_date: string;
				images: Array<{ url: string }>;
			};
		} | null; // local files have null track
	}>;
	total: number;
}
```

**New fields query pattern (D-03)**:
```typescript
const fields = 'items(track(id,name,artists(name),album(release_date,images(url)))),total';
const playlistData = await spotifyFetch<SpotifyPlaylistResponse>(
	user.id,
	`/playlists/${playlistId}/items?offset=${offset}&limit=100&fields=${encodeURIComponent(fields)}`
);
```

**New random offset pattern (D-01)**:
```typescript
if (!playlistData || !playlistData.total) {
	attempts++;
	continue;
}
const total = playlistData.total;
const maxOffset = Math.max(1, total - 100);
const offset = Math.floor(Math.random() * maxOffset);
```

**Track filtering pattern (unchanged but filter by release_date)**:
```typescript
const availableTracks = playlistData.items
	.filter((item) => 
		item.track && 
		!playedTrackIds.includes(item.track.id) &&
		item.track.album?.release_date // NEW: filter nulls with release_date
	)
	.map((item) => item.track);
```

**Track selection and DB insert pattern** (lines 115-121 with album art from fields):
```typescript
await db.insert(playedSongs).values({
	userId: user.id,
	spotifyTrackId: randomTrack.id,
	sessionId,
	playedAt: new Date()
});

return json({
	track: {
		id: randomTrack.id,
		name: randomTrack.name,
		artists: randomTrack.artists.map((a: { name: string }) => a.name),
		releaseYear: parseInt(randomTrack.album.release_date.split('-')[0], 10),
		albumArt: randomTrack.album.images?.[0]?.url
	}
});
```

---

### `src/routes/api/spotify/playlist/validate/+server.ts` (API route, request-response CRUD)

**Change scope:** Surgical field rename only. Interface to client remains unchanged.

**Imports pattern** (lines 1-3):
```typescript
import { json } from '@sveltejs/kit';
import { parseSpotifyPlaylistId, spotifyFetch } from '$lib/server/spotify';
import type { RequestHandler } from './$types';
```

**Auth guard pattern** (lines 5-9):
```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
```

**URI parsing pattern (D-02)** (line 20):
```typescript
const playlistId = parseSpotifyPlaylistId(playlistInput);
// ALREADY CORRECT — do not change
```

**Spotify fetch with fields change (D-04)** (lines 30-38):
**Current** (line 37):
```typescript
`/playlists/${playlistId}?fields=name,id,uri,tracks.total`
```
**Change to:**
```typescript
`/playlists/${playlistId}?fields=id,name,uri,items.total`
```

**TypeScript type change (D-04)** (line 30-34):
**Current:**
```typescript
const playlist = await spotifyFetch<{
	name: string;
	id: string;
	uri: string;
	tracks: { total: number };
}>
```
**Change to:**
```typescript
const playlist = await spotifyFetch<{
	id: string;
	name: string;
	uri: string;
	items: { total: number };
}>
```

**Accessor change (D-04)** (line 50):
**Current:**
```typescript
trackCount: playlist.tracks?.total || 0
```
**Change to:**
```typescript
trackCount: playlist.items?.total || 0
```

**Error handling pattern** (lines 52-56, unchanged):
```typescript
} catch (error) {
	console.error('Error validating playlist:', error);
	return json({ error: 'Failed to validate playlist' }, { status: 500 });
}
```

---

### `src/routes/api/spotify/playlists/track-counts/+server.ts` (API route, request-response CRUD)

**Change scope:** Field rename only. Same pattern as validate endpoint.

**Imports pattern** (lines 1-3):
```typescript
import { json } from '@sveltejs/kit';
import { spotifyFetch } from '$lib/server/spotify';
import type { RequestHandler } from './$types';
```

**Auth guard + request parsing pattern** (lines 5-15):
```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { playlistUris } = await request.json();

		if (!playlistUris || !Array.isArray(playlistUris)) {
			return json({ error: 'Invalid playlist URIs' }, { status: 400 });
		}
```

**URI parsing pattern** (lines 25):
**Current** (needs fixing — positional split):
```typescript
const playlistId = uri.split(':').pop();
```
**Change to use helper:**
```typescript
import { parseSpotifyPlaylistId } from '$lib/server/spotify';
// Then:
const playlistId = parseSpotifyPlaylistId(uri);
if (!playlistId) continue; // guard
```

**Spotify fetch with fields change (D-04)** (lines 28-30):
**Current:**
```typescript
const data = await spotifyFetch<{ tracks: { total: number } }>(
	userId,
	`/playlists/${playlistId}?fields=tracks.total`
);
```
**Change to:**
```typescript
const data = await spotifyFetch<{ items: { total: number } }>(
	userId,
	`/playlists/${playlistId}?fields=items.total`
);
```

**Accessor change (D-04)** (line 34):
**Current:**
```typescript
trackCounts[uri] = data.tracks?.total || 0;
```
**Change to:**
```typescript
trackCounts[uri] = data.items?.total || 0;
```

**Error handling pattern** (lines 46-49):
```typescript
} catch (error) {
	console.error('Error fetching track counts:', error);
	return json({ error: 'Failed to fetch track counts' }, { status: 500 });
}
```

---

### `src/lib/server/spotify.ts` (shared auth service)

**Status:** Commit as-is (AUTH-01, complete). Extract pattern for reference.

**Imports pattern** (lines 1-4):
```typescript
import { eq } from 'drizzle-orm';
import { db } from './db';
import { spotifyTokens } from './db/schema';
import { env } from './env';
```

**SpotifyAuthError class (AUTH-01)** (lines 165-170):
```typescript
export class SpotifyAuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SpotifyAuthError';
	}
}
```

**spotifyFetch function signature** (lines 102-106):
```typescript
export async function spotifyFetch<T = unknown>(
	userId: string,
	endpoint: string,
	options: RequestInit = {}
): Promise<T | null>
```

**Auth error detection + token cleanup pattern** (lines 127-139):
```typescript
if (!response.ok) {
	// If token is invalid, throw auth error
	if (response.status === 401) {
		console.error('Spotify returned 401 - token invalid, cleaning up');
		await deleteSpotifyTokens(userId);
		throw new SpotifyAuthError('Re-authentication required');
	}

	console.error(
		`Spotify API error: ${response.status}`,
		await response.text()
	);
	return null;
}
```

**deleteSpotifyTokens function (AUTH-01)** (lines 175-177):
```typescript
export async function deleteSpotifyTokens(userId: string): Promise<void> {
	await db.delete(spotifyTokens).where(eq(spotifyTokens.userId, userId));
}
```

**parseSpotifyPlaylistId function (D-02)** (lines 182-208):
```typescript
export function parseSpotifyPlaylistId(input: string): string | null {
	// Handle Spotify URI format: spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
	if (input.startsWith('spotify:playlist:')) {
		return input.split(':')[2];
	}

	// Handle Spotify URL format: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
	try {
		const url = new URL(input);
		if (
			url.hostname === 'open.spotify.com' &&
			url.pathname.startsWith('/playlist/')
		) {
			const id = url.pathname.split('/')[2];
			return id?.split('?')[0] ?? null; // Remove query params if present
		}
	} catch {
		// Not a valid URL, continue
	}

	// If it's just the ID itself
	if (/^[a-zA-Z0-9]{22}$/.test(input)) {
		return input;
	}

	return null;
}
```

---

### `src/routes/api/spotify/devices/+server.ts` (API route, request-response)

**Status:** Commit as-is (AUTH-01, already complete with SpotifyAuthError pattern).

**SpotifyAuthError catch pattern** (lines 22-28):
```typescript
} catch (error) {
	if (error instanceof SpotifyAuthError) {
		return json({ 
			error: 'Spotify authentication failed', 
			requiresReauth: true 
		}, { status: 401 });
	}
	console.error('Error fetching devices:', error);
	return json({ error: 'Failed to fetch devices' }, { status: 500 });
}
```

---

### `src/routes/api/spotify/player/play/+server.ts` (API route, request-response)

**Status:** Commit as-is (AUTH-01, already complete with SpotifyAuthError pattern).

**SpotifyAuthError catch pattern** (lines 31-40):
```typescript
} catch (error) {
	if (error instanceof SpotifyAuthError) {
		return json({ 
			error: 'Spotify authentication failed', 
			requiresReauth: true 
		}, { status: 401 });
	}
	console.error('Error with playback:', error);
	return json({ error: 'Failed to control playback' }, { status: 500 });
}
```

---

### `src/routes/api/auth/reauth/+server.ts` (API route, request-response)

**Status:** Commit as-is (AUTH-01, new endpoint, complete).

**Pattern:** Session + token invalidation cascade.

**Imports** (lines 1-4):
```typescript
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { deleteSessionTokenCookie, invalidateUserSessions } from '$lib/server/auth';
import { deleteSpotifyTokens } from '$lib/server/spotify';
```

**Handler** (lines 9-31):
```typescript
export async function POST(event: RequestEvent) {
	const { locals } = event;
	
	if (!locals.user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		// Clear all user sessions
		await invalidateUserSessions(locals.user.id);
		
		// Delete Spotify tokens to force re-auth
		await deleteSpotifyTokens(locals.user.id);
		
		// Clear session cookie
		deleteSessionTokenCookie(event);

		return json({ success: true, message: 'Please log in again' });
	} catch (error) {
		console.error('Error during reauth:', error);
		return json({ error: 'Failed to clear authentication' }, { status: 500 });
	}
}
```

---

### `src/lib/types/spotify-player.d.ts` (TypeScript definitions)

**Status:** Commit as-is (AUTH-01, new type file, complete).

**Pattern:** Global window interface + namespace declarations for Spotify SDK.

```typescript
declare global {
	interface Window {
		Spotify: typeof Spotify;
		onSpotifyWebPlaybackSDKReady: () => void;
	}
}

export interface SpotifyPlayer { ... }
export interface SpotifyPlayerState { ... }
export interface SpotifyTrack { ... }

declare namespace Spotify {
	class Player implements SpotifyPlayer { ... }
}
```

---

## Shared Patterns

### Auth Error Handling
**Source:** `src/lib/server/spotify.ts` + all route handlers
**Apply to:** All routes that call `spotifyFetch`
**Pattern:**
```typescript
// In handler:
try {
	const data = await spotifyFetch<T>(user.id, endpoint);
	// ... use data
} catch (error) {
	if (error instanceof SpotifyAuthError) {
		return json({ 
			error: 'Spotify authentication failed', 
			requiresReauth: true 
		}, { status: 401 });
	}
	console.error('Error ...:', error);
	return json({ error: 'Failed to ...' }, { status: 500 });
}
```

### Request Handler Structure
**Source:** All route files (`src/routes/api/spotify/**/*.ts`)
**Pattern:**
```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		// validation & handler logic
		return json({ ... });
	} catch (error) {
		if (error instanceof SpotifyAuthError) { ... }
		console.error('Error ...:', error);
		return json({ error: '...' }, { status: 500 });
	}
};
```

### DB Query Pattern (7-day dedup)
**Source:** `src/routes/api/spotify/songs/random/+server.ts` lines 46-55
**Apply to:** Any route that deduplicates by recent activity
**Pattern:**
```typescript
import { and, eq, gte } from 'drizzle-orm';

const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const recentItems = await db.query.tableName.findMany({
	where: and(
		eq(table.userId, user.id),
		gte(table.timestamp, sevenDaysAgo)
	)
});
```

### URI Parsing
**Source:** `src/lib/server/spotify.ts:182-208` + `playlist/validate` line 20
**Apply to:** All routes handling Spotify URIs
**Pattern:**
```typescript
import { parseSpotifyPlaylistId } from '$lib/server/spotify';

const playlistId = parseSpotifyPlaylistId(userInput);
if (!playlistId) {
	return json({ error: 'Invalid Spotify playlist URI or URL' }, { status: 400 });
}
```

---

## Decision Gate: Third-Party Playlist Access (Critical)

**Context:** RESEARCH.md flagged that `GET /playlists/{id}/items` returns 403 for playlists the user does not own or collaborate on. All six default HITSTER playlists are owned by HITSTER company, not the user.

**Files affected:** `src/routes/api/spotify/songs/random/+server.ts`

**Problem statement:** After `/tracks` → `/items` migration, the endpoint will return 403 Forbidden for third-party playlists, blocking the game loop.

**Decision required (before implementation):**
1. **User copies HITSTER playlists to their Spotify library** — game works as-is. Zero code change beyond migration.
2. **Detect 403 and surface copy instructions** — `spotifyFetch` or `songs/random` catches 403 and returns actionable error.
3. **Remove hardcoded HITSTER playlists** — app becomes custom-playlist-only.

**Recommendation:** Defer decision until planner discusses with user. Assume option 1 (user copies playlists) for Phase 1 implementation. If option 2 or 3 chosen, additional error handling needed.

---

## No Analog Found

All Phase 1 files have exact analogs in the existing codebase. No new patterns needed beyond what is already established.

---

## Metadata

**Analog search scope:** `src/routes/api/spotify/`, `src/lib/server/`
**Files scanned:** 6 primary routes + 1 service + 1 type file
**Pattern extraction date:** 2026-05-21
**Confidence:** HIGH — all analogs are direct file reads from working tree

