import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { spotifyTokens } from '$lib/server/db/schema';
import { env } from '$lib/server/env';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/auth/login');
	}

	// Check if user has Spotify tokens
	const tokens = await db.query.spotifyTokens.findFirst({
		where: eq(spotifyTokens.userId, locals.user.id)
	});

	if (!tokens) {
		redirect(302, '/auth/login/spotify');
	}

	return {
		spotifyClientId: env.SPOTIFY_CLIENT_ID || ''
	};
};
