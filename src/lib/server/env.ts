import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { z } from 'zod';

const envSchema = z.object({
	// Database
	DATABASE_URL: z.url(),

	// OAuth - Spotify
	SPOTIFY_CLIENT_ID: z.string(),
	SPOTIFY_CLIENT_SECRET: z.string(),

	// App
	PUBLIC_APP_URL: z.url(),
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
	try {
		return envSchema.parse({ ...privateEnv, ...publicEnv });
	} catch (error) {
		if (error instanceof z.ZodError) {
			const missingVars = error.issues
				.map((e) => `${e.path.join('.')}: ${e.message}`)
				.join('\n');
			throw new Error(`Environment validation failed:\n${missingVars}`);
		}
		throw error;
	}
}

export const env = validateEnv();

// Named exports for convenience
export const DATABASE_URL = env.DATABASE_URL;
export const SPOTIFY_CLIENT_ID = env.SPOTIFY_CLIENT_ID;
export const SPOTIFY_CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;
export const PUBLIC_APP_URL = env.PUBLIC_APP_URL;
