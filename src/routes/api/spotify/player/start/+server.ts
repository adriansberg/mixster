import { json, type RequestHandler } from '@sveltejs/kit';
import { spotifyFetch } from '$lib/server/spotify';

export const PUT: RequestHandler = async ({ locals, request }) => {
	const user = locals.user;

	if (!user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const { trackId, deviceId } = await request.json();

	if (!trackId || !deviceId) {
		return json(
			{ error: 'Track ID and device ID are required' },
			{ status: 400 }
		);
	}

	try {
		await spotifyFetch(user.id, `/me/player/play?device_id=${deviceId}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ uris: [`spotify:track:${trackId}`] })
		});

		return json({ success: true });
	} catch (error) {
		console.error('Error starting playback:', error);
		return json({ error: 'Failed to start playback' }, { status: 500 });
	}
};
