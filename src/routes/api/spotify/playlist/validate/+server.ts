import { json } from '@sveltejs/kit';
import { parseSpotifyPlaylistId, spotifyFetch } from '$lib/server/spotify';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { playlistInput } = await request.json();

		if (!playlistInput) {
			return json(
				{ error: 'Playlist URI or URL is required' },
				{ status: 400 }
			);
		}

		const playlistId = parseSpotifyPlaylistId(playlistInput);

		if (!playlistId) {
			return json(
				{ error: 'Invalid Spotify playlist URI or URL' },
				{ status: 400 }
			);
		}

		// Fetch playlist details using user's access token
		const playlist = await spotifyFetch<{
			id: string;
			name: string;
			uri: string;
			tracks?: { total: number };
			items?: { total: number };
		}>(
			locals.user.id,
			`/playlists/${playlistId}?fields=id,name,uri,tracks.total`
		);

		if (!playlist) {
			return json(
				{ error: 'Could not find playlist. Make sure it is public.' },
				{ status: 404 }
			);
		}

		return json({
			name: playlist.name,
			uri: playlist.uri,
			trackCount: playlist.tracks?.total ?? playlist.items?.total ?? 0
		});
	} catch (error) {
		console.error('Error validating playlist:', error);
		return json({ error: 'Failed to validate playlist' }, { status: 500 });
	}
};
