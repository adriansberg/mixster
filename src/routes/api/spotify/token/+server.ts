import { json } from '@sveltejs/kit';
import { getSpotifyAccessToken } from '$lib/server/spotify';

import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent) {
	const user = event.locals.user;

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const accessToken = await getSpotifyAccessToken(user.id);

	if (!accessToken) {
		return json(
			{ error: 'No Spotify access token available' },
			{ status: 400 }
		);
	}

	return json({ accessToken });
}
