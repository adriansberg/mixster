import { eq } from 'drizzle-orm';
import { db } from './db';
import { spotifyTokens } from './db/schema';
import { env } from './env';

export interface SpotifyTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: Date;
}

/**
 * Get valid Spotify access token for a user, refreshing if necessary
 */
export async function getSpotifyAccessToken(
	userId: string
): Promise<string | null> {
	const tokens = await db.query.spotifyTokens.findFirst({
		where: eq(spotifyTokens.userId, userId)
	});

	if (!tokens) {
		return null;
	}

	// Check if token is expired or will expire in the next minute
	const now = new Date();
	const expiresIn = tokens.expiresAt.getTime() - now.getTime();
	const needsRefresh = expiresIn < 60 * 1000; // Less than 1 minute

	if (!needsRefresh) {
		return tokens.accessToken;
	}

	// Refresh the token
	const refreshed = await refreshSpotifyToken(tokens.refreshToken);

	if (!refreshed) {
		return null;
	}

	// Update tokens in database
	await db
		.update(spotifyTokens)
		.set({
			accessToken: refreshed.accessToken,
			expiresAt: refreshed.expiresAt
		})
		.where(eq(spotifyTokens.userId, userId));

	return refreshed.accessToken;
}

/**
 * Refresh Spotify access token using refresh token
 */
async function refreshSpotifyToken(
	refreshToken: string
): Promise<Pick<SpotifyTokens, 'accessToken' | 'expiresAt'> | null> {
	if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
		console.error('Spotify credentials not configured');
		return null;
	}

	try {
		const response = await fetch('https://accounts.spotify.com/api/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
			},
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: refreshToken
			})
		});

		if (!response.ok) {
			console.error('Failed to refresh Spotify token:', await response.text());
			return null;
		}

		const data = await response.json();

		return {
			accessToken: data.access_token,
			expiresAt: new Date(Date.now() + data.expires_in * 1000)
		};
	} catch (error) {
		console.error('Error refreshing Spotify token:', error);
		return null;
	}
}

/**
 * Make authenticated Spotify API request
 */
export async function spotifyFetch<T = unknown>(
	userId: string,
	endpoint: string,
	options: RequestInit = {}
): Promise<T | null> {
	const accessToken = await getSpotifyAccessToken(userId);

	if (!accessToken) {
		console.error('No valid Spotify access token available');
		return null;
	}

	try {
		const url = endpoint.startsWith('http')
			? endpoint
			: `https://api.spotify.com/v1${endpoint}`;

		const response = await fetch(url, {
			...options,
			headers: {
				...options.headers,
				Authorization: `Bearer ${accessToken}`
			}
		});

		if (!response.ok) {
			console.error(
				`Spotify API error: ${response.status}`,
				await response.text()
			);
			return null;
		}

		// Handle 204 No Content and empty responses (play/pause endpoints)
		const contentType = response.headers.get('content-type');
		if (
			response.status === 204 ||
			!contentType ||
			!contentType.includes('application/json')
		) {
			return {} as T;
		}

		return (await response.json()) as T;
	} catch (error) {
		console.error('Error making Spotify API request:', error);
		return null;
	}
}

/**
 * Parse Spotify playlist URI or URL to extract playlist ID
 */
export function parseSpotifyPlaylistId(input: string): string | null {
	// Handle Spotify URI format: spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
	if (input.startsWith('spotify:playlist:')) {
		return input.split(':')[2];
	}

	// Handle Spotify URL format: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
	try {
		const url = new URL(input);
		if (
			url.hostname === 'open.spotify.com' &&
			url.pathname.startsWith('/playlist/')
		) {
			const id = url.pathname.split('/')[2];
			return id?.split('?')[0] ?? null; // Remove query params if present
		}
	} catch {
		// Not a valid URL, continue
	}

	// If it's just the ID itself
	if (/^[a-zA-Z0-9]{22}$/.test(input)) {
		return input;
	}

	return null;
}
