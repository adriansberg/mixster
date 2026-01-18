import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import {
	verifyEmailVerificationCode,
	createEmailVerificationCode
} from '$lib/server/auth/tokens';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { sendVerificationEmail } from '$lib/server/email';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/auth/login');
	}

	if (locals.user.emailVerified) {
		redirect(302, '/dashboard');
	}

	return {
		email: locals.user.email
	};
};

export const actions = {
	verify: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const data = await request.formData();
		const code = data.get('code');

		if (!code || typeof code !== 'string') {
			return fail(400, { error: 'Verification code is required' });
		}

		const isValid = await verifyEmailVerificationCode(locals.user.id, code);

		if (!isValid) {
			return fail(400, { error: 'Invalid or expired verification code' });
		}

		// Update user's email verification status
		await db
			.update(users)
			.set({ emailVerified: true })
			.where(eq(users.id, locals.user.id));

		redirect(303, '/dashboard');
	},

	resend: async ({ locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not authenticated' });
		}

		if (locals.user.emailVerified) {
			return fail(400, { error: 'Email already verified' });
		}

		try {
			// Create new verification code
			const verificationCode = await createEmailVerificationCode(
				locals.user.id,
				locals.user.email
			);

			// Send verification email
			await sendVerificationEmail(locals.user.email, verificationCode);

			return { success: true, message: 'Verification code resent' };
		} catch (error) {
			console.error('Failed to resend verification email:', error);
			return fail(500, {
				error: 'Failed to resend verification code. Please try again.'
			});
		}
	}
} satisfies Actions;
