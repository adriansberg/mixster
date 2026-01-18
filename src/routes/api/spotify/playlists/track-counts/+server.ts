import { json } from '@sveltejs/kit';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '$lib/server/env';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { playlistUris } = await request.json();

		if (!playlistUris || !Array.isArray(playlistUris)) {
			return json({ error: 'Invalid playlist URIs' }, { status: 400 });
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

		// Fetch track counts for all playlists
		const trackCounts: Record<string, number> = {};

		await Promise.all(
			playlistUris.map(async (uri: string) => {
				try {
					// Extract playlist ID from URI
					const playlistId = uri.split(':').pop();
					if (!playlistId) return;

					const response = await fetch(
						`https://api.spotify.com/v1/playlists/${playlistId}?fields=tracks.total`,
						{
							headers: {
								Authorization: `Bearer ${access_token}`
							}
						}
					);

					if (response.ok) {
						const data = await response.json();
						trackCounts[uri] = data.tracks?.total || 0;
					}
				} catch (error) {
					console.error(`Failed to fetch track count for ${uri}:`, error);
					trackCounts[uri] = 0;
				}
			})
		);

		return json({ trackCounts });
	} catch (error) {
		console.error('Error fetching track counts:', error);
		return json({ error: 'Failed to fetch track counts' }, { status: 500 });
	}
};
