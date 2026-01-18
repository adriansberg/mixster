import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { z } from 'zod';

const envSchema = z.object({
	// Database
	DATABASE_URL: z.url(),

	// Auth
	AUTH_SECRET: z.string().min(32),

	// OAuth - Spotify
	SPOTIFY_CLIENT_ID: z.string().optional(),
	SPOTIFY_CLIENT_SECRET: z.string().optional(),

	// Email - Resend
	RESEND_API_KEY: z.string().optional(),
	EMAIL_FROM: z.email().optional(),

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
