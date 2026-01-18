import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { userPlaylists } from '$lib/server/db/schema';

import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent) {
	const user = event.locals.user;

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const playlists = await db.query.userPlaylists.findMany({
		where: eq(userPlaylists.userId, user.id),
		orderBy: (playlists, { desc }) => [desc(playlists.createdAt)]
	});

	return json({ playlists });
}

export async function DELETE(event: RequestEvent) {
	const user = event.locals.user;

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { playlistId } = await event.request.json();

	if (!playlistId || typeof playlistId !== 'string') {
		return json({ error: 'Invalid playlist ID' }, { status: 400 });
	}

	await db.delete(userPlaylists).where(eq(userPlaylists.id, playlistId));

	return json({ success: true });
}
