import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { defaultPlaylists } from '$lib/config/playlists';
import { db } from '$lib/server/db';
import { spotifyTokens } from '$lib/server/db/schema';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/auth/login/spotify');
	}

	// Check if user has Spotify tokens - required for playlist validation
	const tokens = await db.query.spotifyTokens.findFirst({
		where: eq(spotifyTokens.userId, locals.user.id)
	});

	if (!tokens) {
		redirect(302, '/auth/login/spotify');
	}

	return {
		defaultPlaylists,
		isAuthenticated: true
	};
};
