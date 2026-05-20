import { json } from '@sveltejs/kit';
import { parseSpotifyPlaylistId, spotifyFetch } from '$lib/server/spotify';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { playlistUris } = await request.json();

		if (!playlistUris || !Array.isArray(playlistUris)) {
			return json({ error: 'Invalid playlist URIs' }, { status: 400 });
		}

		// Fetch track counts for all playlists using user's access token
		const trackCounts: Record<string, number> = {};
		const userId = locals.user.id;

		await Promise.all(
			playlistUris.map(async (uri: string) => {
				try {
					// Extract playlist ID from URI
					const playlistId = parseSpotifyPlaylistId(uri);
					if (!playlistId) return;

					const data = await spotifyFetch<{ items: { total: number } }>(
						userId,
						`/playlists/${playlistId}?fields=items.total`
					);

					if (data) {
						trackCounts[uri] = data.items?.total || 0;
					} else {
						trackCounts[uri] = 0;
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
