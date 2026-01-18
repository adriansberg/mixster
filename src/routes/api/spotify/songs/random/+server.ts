import { json } from '@sveltejs/kit';
import { and, eq, gte } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { playedSongs } from '$lib/server/db/schema';
import { spotifyFetch } from '$lib/server/spotify';
import { defaultPlaylists } from '$lib/config/playlists';

import type { RequestEvent } from '@sveltejs/kit';

export async function POST(event: RequestEvent) {
	const user = event.locals.user;

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

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

	while (attempts < maxAttempts) {
		// Pick random playlist
		const randomPlaylistUri =
			allPlaylistUris[Math.floor(Math.random() * allPlaylistUris.length)];
		const playlistId = randomPlaylistUri.split(':')[2];

		// Fetch playlist tracks
		const playlistData = await spotifyFetch<SpotifyPlaylistResponse>(
			user.id,
			`/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,artists,album,external_ids)),total`
		);

		if (
			!playlistData ||
			!playlistData.items ||
			playlistData.items.length === 0
		) {
			attempts++;
			continue;
		}

		// Filter out already played songs
		const availableTracks = playlistData.items
			.filter((item) => item.track && !playedTrackIds.includes(item.track.id))
			.map((item) => item.track);

		if (availableTracks.length === 0) {
			attempts++;
			continue;
		}

		// Pick random track
		const randomTrack =
			availableTracks[Math.floor(Math.random() * availableTracks.length)];

		// Get release year from track
		let releaseYear: number | null = null;

		// Try to get full track details for release date
		const trackDetails = await spotifyFetch<SpotifyTrack>(
			user.id,
			`/tracks/${randomTrack.id}`
		);

		if (trackDetails?.album?.release_date) {
			releaseYear = parseInt(trackDetails.album.release_date.split('-')[0], 10);
		}

		// If no release year found, skip this track
		if (!releaseYear) {
			attempts++;
			continue;
		}

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
				artists: randomTrack.artists.map((a: { name: string }) => a.name),
				releaseYear,
				albumArt: trackDetails?.album?.images?.[0]?.url
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
}

interface SpotifyPlaylistResponse {
	items: Array<{
		track: {
			id: string;
			name: string;
			artists: Array<{ name: string }>;
			album: {
				name: string;
			};
		};
	}>;
	total: number;
}

interface SpotifyTrack {
	id: string;
	name: string;
	artists: Array<{ name: string }>;
	album: {
		name: string;
		release_date: string;
		images: Array<{ url: string }>;
	};
}
