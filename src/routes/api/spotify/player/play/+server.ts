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

		// If trackId and deviceId provided, start specific track on that device.
		// On iOS the Spotify app can drop off Connect when backgrounded/paused, so
		// first transfer playback to the target device to wake it, then play.
		if (trackId && deviceId) {
			await spotifyFetch(user.id, '/me/player', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ device_ids: [deviceId], play: false })
			});

			endpoint = `/me/player/play?device_id=${encodeURIComponent(deviceId)}`;
			options = {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uris: [`spotify:track:${trackId}`] })
			};
		} else if (deviceId) {
			// Resume on a specific device (no body = resume current track).
			// Targeting device_id also re-points playback to a device that may
			// have dropped off Connect since playback started.
			endpoint = `/me/player/play?device_id=${encodeURIComponent(deviceId)}`;
		}

		// spotifyFetch returns null on non-auth API errors (e.g. 404 device gone).
		// Treat that as a failed playback rather than reporting fake success.
		const result = await spotifyFetch(user.id, endpoint, options);

		if (result === null) {
			return json(
				{
					error: 'No active Spotify device. Reopen Spotify on the device and try again.',
					noActiveDevice: true
				},
				{ status: 404 }
			);
		}

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
