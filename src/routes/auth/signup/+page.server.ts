import type { Actions } from '@sveltejs/kit';
import { fail, type RequestEvent, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import {
	createEmailVerificationCode,
	createSession,
	generateIdFromEntropySize,
	generateSessionToken,
	hashPassword,
	setSessionTokenCookie
} from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { sendVerificationEmail } from '$lib/server/email';

export const actions = {
	default: async (event: RequestEvent) => {
		const { request } = event;
		const data = await request.formData();
		const email = data.get('email');
		const password = data.get('password');
		const confirmPassword = data.get('confirmPassword');
		const name = data.get('name');

		// Validation
		if (!email || typeof email !== 'string' || !email.includes('@')) {
			return fail(400, { email, error: 'Invalid email address' });
		}

		if (!password || typeof password !== 'string' || password.length < 8) {
			return fail(400, {
				email,
				name,
				error: 'Password must be at least 8 characters'
			});
		}

		if (password !== confirmPassword) {
			return fail(400, { email, name, error: 'Passwords do not match' });
		}

		// Check if user already exists
		const existingUser = await db
			.select()
			.from(users)
			.where(eq(users.email, email));
		if (existingUser.length > 0) {
			return fail(400, { email, name, error: 'Email already registered' });
		}

		// Create user
		const userId = generateIdFromEntropySize(10);
		const passwordHash = await hashPassword(password);

		await db.insert(users).values({
			id: userId,
			email,
			passwordHash,
			name: typeof name === 'string' && name ? name : null,
			emailVerified: false,
			avatar: null
		});

		// Create session
		const sessionToken = generateSessionToken();
		const session = await createSession(sessionToken, userId);
		setSessionTokenCookie(event, sessionToken, session.expiresAt);

		// Send verification email
		const verificationCode = await createEmailVerificationCode(userId, email);
		await sendVerificationEmail(email, verificationCode);

		redirect(303, '/auth/verify-email');
	}
} satisfies Actions;
