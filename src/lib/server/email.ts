import { Resend } from 'resend';
import { dev } from '$app/environment';

import { env } from './env';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface EmailOptions {
	to: string;
	subject: string;
	html: string;
}

export async function sendEmail({
	to,
	subject,
	html
}: EmailOptions): Promise<void> {
	if (dev) {
		// In development, log to console instead of sending
		console.log('\n📧 Email (Development Mode)');
		console.log('━'.repeat(50));
		console.log(`To: ${to}`);
		console.log(`Subject: ${subject}`);
		console.log('Content:');
		console.log(html);
		console.log(`${'━'.repeat(50)}\n`);
		return;
	}

	if (!resend || !env.EMAIL_FROM) {
		throw new Error('Email service not configured');
	}

	await resend.emails.send({
		from: env.EMAIL_FROM,
		to,
		subject,
		html
	});
}

export async function sendVerificationEmail(
	email: string,
	code: string
): Promise<void> {
	const subject = 'Verify your email';
	const html = `
		<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
			<h2>Verify Your Email</h2>
			<p>Thank you for signing up! Please use the verification code below to verify your email address:</p>
			<div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
				${code}
			</div>
			<p>This code will expire in 15 minutes.</p>
			<p>If you didn't create an account, you can safely ignore this email.</p>
		</div>
	`;

	await sendEmail({ to: email, subject, html });
}

export async function sendPasswordResetEmail(
	email: string,
	token: string
): Promise<void> {
	const resetUrl = `${env.PUBLIC_APP_URL}/auth/reset-password/${token}`;
	const subject = 'Reset your password';
	const html = `
		<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
			<h2>Reset Your Password</h2>
			<p>We received a request to reset your password. Click the button below to create a new password:</p>
			<div style="margin: 30px 0; text-align: center;">
				<a href="${resetUrl}" style="background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
					Reset Password
				</a>
			</div>
			<p>Or copy and paste this link into your browser:</p>
			<p style="word-break: break-all; color: #666;">${resetUrl}</p>
			<p>This link will expire in 2 hours.</p>
			<p>If you didn't request a password reset, you can safely ignore this email.</p>
		</div>
	`;

	await sendEmail({ to: email, subject, html });
}
