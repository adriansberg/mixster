import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { userPlaylists } from '$lib/server/db/schema';

import type { RequestEvent } from '@sveltejs/kit';

export async function PATCH(event: RequestEvent) {
	const user = event.locals.user;

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { playlistId, isActive } = await event.request.json();

	if (
		!playlistId ||
		typeof playlistId !== 'string' ||
		typeof isActive !== 'boolean'
	) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	await db
		.update(userPlaylists)
		.set({ isActive })
		.where(eq(userPlaylists.id, playlistId));

	return json({ success: true });
}
