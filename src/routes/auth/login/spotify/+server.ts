import { generateState, generateCodeVerifier } from 'arctic';
import { spotify } from '$lib/server/auth';
import { env } from '$lib/server/env';

import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent): Promise<Response> {
	if (!spotify) {
		return new Response('Spotify OAuth not configured', { status: 500 });
	}

	const state = generateState();
	const codeVerifier = generateCodeVerifier();

	console.log('Setting OAuth state:', state);

	const url = spotify.createAuthorizationURL(state, codeVerifier, [
		'user-read-email',
		'user-read-private',
		'streaming',
		'user-read-playback-state',
		'user-modify-playback-state'
	]);

	const isProduction = env.NODE_ENV === 'production';

	event.cookies.set('spotify_oauth_state', state, {
		path: '/',
		secure: isProduction,
		httpOnly: true,
		maxAge: 60 * 10,
		sameSite: 'lax'
	});

	event.cookies.set('spotify_code_verifier', codeVerifier, {
		path: '/',
		secure: isProduction,
		httpOnly: true,
		maxAge: 60 * 10,
		sameSite: 'lax'
	});

	return new Response(null, {
		status: 302,
		headers: {
			Location: url.toString()
		}
	});
}
