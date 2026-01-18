import { redirect } from '@sveltejs/kit';
import { generateState, generateCodeVerifier } from 'arctic';

import { spotify } from '$lib/server/auth';

import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent): Promise<Response> {
	if (!spotify) {
		return new Response('Spotify OAuth not configured', { status: 500 });
	}

	const state = generateState();
	const codeVerifier = generateCodeVerifier();

	const url = spotify.createAuthorizationURL(state, codeVerifier, [
		'user-read-playback-state',
		'user-modify-playback-state',
		'streaming',
		'user-read-email',
		'user-read-private'
	]);

	event.cookies.set('spotify_oauth_state', state, {
		path: '/',
		secure: import.meta.env.PROD,
		httpOnly: true,
		maxAge: 60 * 10, // 10 minutes
		sameSite: 'lax'
	});

	event.cookies.set('spotify_code_verifier', codeVerifier, {
		path: '/',
		secure: import.meta.env.PROD,
		httpOnly: true,
		maxAge: 60 * 10, // 10 minutes
		sameSite: 'lax'
	});

	redirect(302, url.toString());
}
