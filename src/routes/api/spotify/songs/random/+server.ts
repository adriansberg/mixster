import { json } from '@sveltejs/kit';
import { and, eq, gte } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { playedSongs } from '$lib/server/db/schema';
import { getSpotifyAccessToken, SpotifyAuthError, parseSpotifyPlaylistId } from '$lib/server/spotify';
import { defaultPlaylists } from '$lib/config/playlists';

import type { RequestEvent } from '@sveltejs/kit';

export async function POST(event: RequestEvent) {
	const user = event.locals.user;

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const {
			sessionId,
			selectedDefaultPlaylists = [],
			customPlaylistUris = []
		} = await event.request.json();

		if (!sessionId || typeof sessionId !== 'string') {
			return json({ error: 'Invalid session ID' }, { status: 400 });
		}

	// Combine default playlists and custom playlists from localStorage
	const allPlaylistUris = [
		...selectedDefaultPlaylists
			.map(
				(id: string) => defaultPlaylists.find((p) => p.id === id)?.spotifyUri
			)
			.filter(Boolean),
		...customPlaylistUris
	];

	if (allPlaylistUris.length === 0) {
		return json(
			{ error: 'No active playlists. Please select at least one playlist.' },
			{ status: 400 }
		);
	}

	// Get played songs from the last 7 days
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const recentlyPlayed = await db.query.playedSongs.findMany({
		where: and(
			eq(playedSongs.userId, user.id),
			gte(playedSongs.playedAt, sevenDaysAgo)
		)
	});

	const playedTrackIds = recentlyPlayed.map((s) => s.spotifyTrackId);

	// Try to get a random song from playlists
	let attempts = 0;
	const maxAttempts = 10;

	const fields = 'items(track(id,name,artists(name),album(release_date,images(url)))),total';

	while (attempts < maxAttempts) {
		// Pick random playlist
		const randomPlaylistUri =
			allPlaylistUris[Math.floor(Math.random() * allPlaylistUris.length)];

		// Parse playlist ID using parseSpotifyPlaylistId (handles URI and URL formats)
		const playlistId = parseSpotifyPlaylistId(randomPlaylistUri);
		if (!playlistId) {
			attempts++;
			continue;
		}

		// Get access token for raw fetch (needed to inspect HTTP status for 403 detection)
		const accessToken = await getSpotifyAccessToken(user.id);
		if (!accessToken) {
			throw new SpotifyAuthError('Re-authentication required');
		}

		// Fetch total count cheaply (offset=0, limit=1)
		const totalResponse = await fetch(
			`https://api.spotify.com/v1/playlists/${playlistId}/items?offset=0&limit=1&fields=total`,
			{ headers: { Authorization: `Bearer ${accessToken}` } }
		);

		if (totalResponse.status === 401) {
			throw new SpotifyAuthError('Re-authentication required');
		}
		if (totalResponse.status === 403) {
			return json(
				{ error: 'playlistInaccessible', message: 'Copy this playlist to your Spotify library to use it' },
				{ status: 403 }
			);
		}
		if (totalResponse.status === 429) {
			return json({ error: 'Rate limited by Spotify', rateLimited: true }, { status: 429 });
		}
		if (!totalResponse.ok) {
			attempts++;
			continue;
		}

		const totalData = await totalResponse.json();
		const total: number = totalData.total ?? 0;

		// Random offset strategy: spread access across the whole playlist
		const maxOffset = Math.max(1, total - 100);
		const offset = Math.floor(Math.random() * maxOffset);

		// Fetch 100-track window at random offset
		const windowResponse = await fetch(
			`https://api.spotify.com/v1/playlists/${playlistId}/items?offset=${offset}&limit=100&fields=${encodeURIComponent(fields)}`,
			{ headers: { Authorization: `Bearer ${accessToken}` } }
		);

		if (windowResponse.status === 401) {
			throw new SpotifyAuthError('Re-authentication required');
		}
		if (windowResponse.status === 403) {
			return json(
				{ error: 'playlistInaccessible', message: 'Copy this playlist to your Spotify library to use it' },
				{ status: 403 }
			);
		}
		if (windowResponse.status === 429) {
			return json({ error: 'Rate limited by Spotify', rateLimited: true }, { status: 429 });
		}
		if (!windowResponse.ok) {
			attempts++;
			continue;
		}

		const playlistData: SpotifyPlaylistResponse = await windowResponse.json();

		if (!playlistData.items || playlistData.items.length === 0) {
			attempts++;
			continue;
		}

		// Filter out played songs and tracks missing release_date
		const availableTracks = playlistData.items
			.filter(
				(item) =>
					item.track != null &&
					!playedTrackIds.includes(item.track.id) &&
					item.track.album?.release_date
			)
			.map((item) => item.track!);

		if (availableTracks.length === 0) {
			attempts++;
			continue;
		}

		// Pick random track
		const randomTrack =
			availableTracks[Math.floor(Math.random() * availableTracks.length)];

		// Extract release year and album art directly from /items response (no second /tracks call)
		const releaseYear = parseInt(randomTrack.album.release_date.split('-')[0], 10);
		const albumArt = randomTrack.album.images?.[0]?.url;

		// Record the played song
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
				artists: randomTrack.artists.map((a) => a.name),
				releaseYear,
				albumArt
			}
		});
	}

	return json(
		{
			error:
				'Could not find an unplayed song with release date. Try adding more playlists or clearing your history.'
		},
		{ status: 404 }
	);
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
		} | null;
	}>;
	total: number;
}
