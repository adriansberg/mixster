import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { deleteSessionTokenCookie, invalidateUserSessions } from '$lib/server/auth';
import { deleteSpotifyTokens } from '$lib/server/spotify';

/**
 * Force re-authentication by clearing all user sessions and Spotify tokens
 */
export async function POST(event: RequestEvent) {
	const { locals } = event;
	
	if (!locals.user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		// Clear all user sessions
		await invalidateUserSessions(locals.user.id);
		
		// Delete Spotify tokens to force re-auth
		await deleteSpotifyTokens(locals.user.id);
		
		// Clear session cookie
		deleteSessionTokenCookie(event);

		return json({ success: true, message: 'Please log in again' });
	} catch (error) {
		console.error('Error during reauth:', error);
		return json({ error: 'Failed to clear authentication' }, { status: 500 });
	}
}
