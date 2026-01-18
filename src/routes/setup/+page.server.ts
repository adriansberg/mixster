import { db } from '$lib/server/db';
import { userPlaylists } from '$lib/server/db/schema';
import { defaultPlaylists } from '$lib/config/playlists';
import { eq } from 'drizzle-orm';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	let customPlaylists: (typeof userPlaylists.$inferSelect)[] = [];

	// Only load custom playlists if user is logged in
	if (locals.user) {
		customPlaylists = await db.query.userPlaylists.findMany({
			where: eq(userPlaylists.userId, locals.user.id),
			orderBy: (playlists, { desc }) => [desc(playlists.createdAt)]
		});
	}

	return {
		defaultPlaylists,
		customPlaylists,
		hasUser: !!locals.user
	};
};
