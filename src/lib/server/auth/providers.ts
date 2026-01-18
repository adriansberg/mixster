import { Spotify } from 'arctic';

import { env } from '../env';

export const spotify =
	env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET
		? new Spotify(
				env.SPOTIFY_CLIENT_ID,
				env.SPOTIFY_CLIENT_SECRET,
				`${env.PUBLIC_APP_URL}/auth/callback/spotify`
			)
		: null;
