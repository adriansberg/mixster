import { Apple, GitHub, Google } from 'arctic';

import { env } from '../env';

export const google =
	env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
		? new Google(
				env.GOOGLE_CLIENT_ID,
				env.GOOGLE_CLIENT_SECRET,
				`${env.PUBLIC_APP_URL}/auth/callback/google`
			)
		: null;

export const github =
	env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
		? new GitHub(
				env.GITHUB_CLIENT_ID,
				env.GITHUB_CLIENT_SECRET,
				`${env.PUBLIC_APP_URL}/auth/callback/github`
			)
		: null;

export const apple =
	env.APPLE_CLIENT_ID &&
	env.APPLE_TEAM_ID &&
	env.APPLE_KEY_ID &&
	env.APPLE_PRIVATE_KEY
		? new Apple(
				env.APPLE_CLIENT_ID,
				env.APPLE_TEAM_ID,
				env.APPLE_KEY_ID,
				new TextEncoder().encode(env.APPLE_PRIVATE_KEY),
				`${env.PUBLIC_APP_URL}/auth/callback/apple`
			)
		: null;
