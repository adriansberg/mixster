import { json, type RequestHandler } from '@sveltejs/kit';
import { spotifyFetch, SpotifyAuthError } from '$lib/server/spotify';

export const PUT: RequestHandler = async ({ locals, request }) => {
	const user = locals.user;

	if (!user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const { trackId, deviceId } = body;

		let endpoint = '/me/player/play';
		let options: RequestInit = { method: 'PUT' };

		// If trackId and deviceId provided, start specific track
		if (trackId && deviceId) {
			endpoint = `/me/player/play?device_id=${deviceId}`;
			options = {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uris: [`spotify:track:${trackId}`] })
			};
		}

		await spotifyFetch(user.id, endpoint, options);

		return json({ success: true });
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
};
