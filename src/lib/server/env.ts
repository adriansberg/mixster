import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { z } from 'zod';

const envSchema = z.object({
	// Database
	DATABASE_URL: z.url(),

	// Auth
	AUTH_SECRET: z.string().min(32),

	// OAuth - Google
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),

	// OAuth - GitHub
	GITHUB_CLIENT_ID: z.string().optional(),
	GITHUB_CLIENT_SECRET: z.string().optional(),

	// OAuth - Apple
	APPLE_CLIENT_ID: z.string().optional(),
	APPLE_TEAM_ID: z.string().optional(),
	APPLE_KEY_ID: z.string().optional(),
	APPLE_PRIVATE_KEY: z.string().optional(),

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
