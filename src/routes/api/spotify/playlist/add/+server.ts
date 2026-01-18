import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { userPlaylists } from '$lib/server/db/schema';
import { parseSpotifyPlaylistId, spotifyFetch } from '$lib/server/spotify';

import type { RequestEvent } from '@sveltejs/kit';

export async function POST(event: RequestEvent) {
	const user = event.locals.user;

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { playlistInput } = await event.request.json();

	if (!playlistInput || typeof playlistInput !== 'string') {
		return json({ error: 'Invalid playlist input' }, { status: 400 });
	}

	// Parse playlist ID
	const playlistId = parseSpotifyPlaylistId(playlistInput);

	if (!playlistId) {
		return json(
			{ error: 'Invalid Spotify playlist URI or URL' },
			{ status: 400 }
		);
	}

	// Fetch playlist metadata from Spotify
	const playlist = await spotifyFetch<SpotifyPlaylist>(
		user.id,
		`/playlists/${playlistId}?fields=id,name,public,owner,tracks.total`
	);

	if (!playlist) {
		return json(
			{
				error:
					'Failed to fetch playlist. Make sure the playlist is public or you have access to it.'
			},
			{ status: 400 }
		);
	}

	// Check if playlist is accessible
	if (!playlist.public && playlist.owner?.id !== user.id) {
		return json(
			{ error: 'This playlist is private and you do not own it.' },
			{ status: 403 }
		);
	}

	// Check if playlist already exists for this user
	const existing = await db.query.userPlaylists.findFirst({
		where: eq(
			userPlaylists.spotifyPlaylistUri,
			`spotify:playlist:${playlistId}`
		)
	});

	if (existing) {
		return json(
			{ error: 'This playlist has already been added' },
			{ status: 400 }
		);
	}

	// Add playlist to database
	const [newPlaylist] = await db
		.insert(userPlaylists)
		.values({
			userId: user.id,
			spotifyPlaylistUri: `spotify:playlist:${playlistId}`,
			name: playlist.name,
			isActive: true
		})
		.returning();

	return json({
		success: true,
		playlist: newPlaylist
	});
}

interface SpotifyPlaylist {
	id: string;
	name: string;
	public: boolean;
	owner?: {
		id: string;
	};
	tracks: {
		total: number;
	};
}
