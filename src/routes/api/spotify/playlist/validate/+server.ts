import { json } from '@sveltejs/kit';
import { parseSpotifyPlaylistId } from '$lib/server/spotify';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '$lib/server/env';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
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

		// Get app access token (client credentials flow)
		const tokenResponse = await fetch(
			'https://accounts.spotify.com/api/token',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
				},
				body: 'grant_type=client_credentials'
			}
		);

		if (!tokenResponse.ok) {
			return json(
				{ error: 'Failed to authenticate with Spotify' },
				{ status: 500 }
			);
		}

		const { access_token } = await tokenResponse.json();

		// Fetch playlist details
		const playlistResponse = await fetch(
			`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,id,uri,tracks.total`,
			{
				headers: {
					Authorization: `Bearer ${access_token}`
				}
			}
		);

		if (!playlistResponse.ok) {
			return json(
				{ error: 'Could not find playlist. Make sure it is public.' },
				{ status: 404 }
			);
		}

		const playlist = await playlistResponse.json();

		return json({
			name: playlist.name,
			uri: playlist.uri,
			trackCount: playlist.tracks?.total || 0
		});
	} catch (error) {
		console.error('Error validating playlist:', error);
		return json({ error: 'Failed to validate playlist' }, { status: 500 });
	}
};
