import { json, type RequestHandler } from '@sveltejs/kit';
import { spotifyFetch } from '$lib/server/spotify';

export const PUT: RequestHandler = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		// Pause playback on the currently active device
		await spotifyFetch(user.id, '/me/player/pause', {
			method: 'PUT'
		});

		return json({ success: true });
	} catch (error) {
		console.error('Error pausing playback:', error);
		return json({ error: 'Failed to pause playback' }, { status: 500 });
	}
};
