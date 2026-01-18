import { OAuth2RequestError } from 'arctic';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { oauthAccounts, spotifyTokens, users } from '$lib/server/db/schema';
import {
	createSession,
	generateSessionToken,
	setSessionTokenCookie,
	spotify
} from '$lib/server/auth';

import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent): Promise<Response> {
	if (!spotify) {
		return new Response('Spotify OAuth not configured', { status: 500 });
	}

	const code = event.url.searchParams.get('code');
	const state = event.url.searchParams.get('state');
	const storedState = event.cookies.get('spotify_oauth_state') ?? null;
	const codeVerifier = event.cookies.get('spotify_code_verifier') ?? null;

	if (
		!code ||
		!state ||
		!storedState ||
		state !== storedState ||
		!codeVerifier
	) {
		return new Response('Invalid OAuth state', { status: 400 });
	}

	try {
		const tokens = await spotify.validateAuthorizationCode(code, codeVerifier);

		// Fetch Spotify user profile
		const spotifyUserResponse = await fetch('https://api.spotify.com/v1/me', {
			headers: {
				Authorization: `Bearer ${tokens.accessToken()}`
			}
		});

		if (!spotifyUserResponse.ok) {
			return new Response('Failed to fetch Spotify user', { status: 500 });
		}

		const spotifyUser: SpotifyUser = await spotifyUserResponse.json();

		// Check if account already exists
		const existingAccount = await db.query.oauthAccounts.findFirst({
			where: and(
				eq(oauthAccounts.providerId, 'spotify'),
				eq(oauthAccounts.providerUserId, spotifyUser.id)
			),
			with: {
				user: true
			}
		});

		let userId: string;

		if (existingAccount) {
			// Update existing user's tokens
			userId = existingAccount.userId;

			// Update or insert Spotify tokens
			await db
				.insert(spotifyTokens)
				.values({
					userId,
					accessToken: tokens.accessToken(),
					refreshToken: tokens.refreshToken() ?? '',
					expiresAt: new Date(
						Date.now() + tokens.accessTokenExpiresInSeconds() * 1000
					)
				})
				.onConflictDoUpdate({
					target: spotifyTokens.userId,
					set: {
						accessToken: tokens.accessToken(),
						refreshToken: tokens.refreshToken() ?? '',
						expiresAt: new Date(
							Date.now() + tokens.accessTokenExpiresInSeconds() * 1000
						)
					}
				});
		} else {
			// Create new user
			const [newUser] = await db
				.insert(users)
				.values({
					email: spotifyUser.email,
					emailVerified: true, // Spotify emails are verified
					name: spotifyUser.display_name,
					avatar: spotifyUser.images?.[0]?.url ?? null
				})
				.returning();

			userId = newUser.id;

			// Link OAuth account
			await db.insert(oauthAccounts).values({
				providerId: 'spotify',
				providerUserId: spotifyUser.id,
				userId
			});

			// Store Spotify tokens
			await db.insert(spotifyTokens).values({
				userId,
				accessToken: tokens.accessToken(),
				refreshToken: tokens.refreshToken() ?? '',
				expiresAt: new Date(
					Date.now() + tokens.accessTokenExpiresInSeconds() * 1000
				)
			});
		}

		// Create session
		const sessionToken = generateSessionToken();
		const session = await createSession(sessionToken, userId);
		setSessionTokenCookie(event, sessionToken, session.expiresAt);

		return new Response(null, {
			status: 302,
			headers: {
				Location: '/dashboard'
			}
		});
	} catch (e) {
		if (e instanceof OAuth2RequestError) {
			return new Response('Invalid authorization code', { status: 400 });
		}
		console.error('Spotify OAuth error:', e);
		return new Response('Internal server error', { status: 500 });
	}
}

interface SpotifyUser {
	id: string;
	email: string;
	display_name: string;
	images?: Array<{ url: string }>;
}
