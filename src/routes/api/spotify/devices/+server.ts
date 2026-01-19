import { json, type RequestHandler } from '@sveltejs/kit';
import { spotifyFetch } from '$lib/server/spotify';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const data = await spotifyFetch<{ devices: unknown[] }>(
			user.id,
			'/me/player/devices'
		);

		if (!data) {
			return json({ error: 'Failed to fetch devices' }, { status: 500 });
		}

		return json({ devices: data.devices || [] });
	} catch (error) {
		console.error('Error fetching devices:', error);
		return json({ error: 'Failed to fetch devices' }, { status: 500 });
	}
};
