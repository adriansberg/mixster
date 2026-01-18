import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { playedSongs } from '$lib/server/db/schema';

import type { RequestEvent } from '@sveltejs/kit';

export async function POST(event: RequestEvent) {
	const user = event.locals.user;

	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	await db.delete(playedSongs).where(eq(playedSongs.userId, user.id));

	return json({ success: true });
}
