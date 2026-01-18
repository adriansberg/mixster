import type { Actions } from '@sveltejs/kit';
import { fail, type RequestEvent, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import {
	createSession,
	generateSessionToken,
	setSessionTokenCookie,
	verifyPassword
} from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

export const actions = {
	default: async (event: RequestEvent) => {
		const { request } = event;
		const data = await request.formData();
		const email = data.get('email');
		const password = data.get('password');

		// Validation
		if (!email || typeof email !== 'string') {
			return fail(400, { email, error: 'Email is required' });
		}

		if (!password || typeof password !== 'string') {
			return fail(400, { email, error: 'Password is required' });
		}

		// Find user
		const result = await db.select().from(users).where(eq(users.email, email));

		if (result.length === 0) {
			return fail(400, { email, error: 'Invalid email or password' });
		}

		const user = result[0];

		if (!user.passwordHash) {
			return fail(400, { email, error: 'Invalid email or password' });
		}

		// Verify password
		const validPassword = await verifyPassword(user.passwordHash, password);

		if (!validPassword) {
			return fail(400, { email, error: 'Invalid email or password' });
		}

		// Create session
		const sessionToken = generateSessionToken();
		const session = await createSession(sessionToken, user.id);
		setSessionTokenCookie(event, sessionToken, session.expiresAt);

		redirect(303, '/dashboard');
	}
} satisfies Actions;
