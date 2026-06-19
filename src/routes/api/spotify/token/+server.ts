import { json, type RequestHandler } from '@sveltejs/kit';
import { getSpotifyAccessToken, SpotifyAuthError } from '$lib/server/spotify';

// DELIBERATE EXCEPTION to the "browser never holds tokens" rule (CLAUDE.md):
// the Spotify Web Playback SDK can only authenticate via a browser-side
// getOAuthToken callback, so the in-browser player needs the access token.
// We expose ONLY the short-lived access token (never the refresh token or
// client secret), gated on the same session as every other Spotify route,
// and mark it no-store so it is never cached by the SW, bfcache, or proxies.
export const GET: RequestHandler = async ({ locals, setHeaders }) => {
	const user = locals.user;

	if (!user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		// Reuses getSpotifyAccessToken, which refreshes + persists when the token
		// has < 5 min left — so the value handed to the SDK has real lifetime.
		const accessToken = await getSpotifyAccessToken(user.id);

		if (!accessToken) {
			return json(
				{ error: 'Spotify authentication failed', requiresReauth: true },
				{ status: 401 }
			);
		}

		setHeaders({ 'cache-control': 'no-store' });
		return json({ accessToken });
	} catch (error) {
		if (error instanceof SpotifyAuthError) {
			return json(
				{ error: 'Spotify authentication failed', requiresReauth: true },
				{ status: 401 }
			);
		}
		console.error('Error issuing Spotify token:', error);
		return json({ error: 'Failed to issue token' }, { status: 500 });
	}
};
