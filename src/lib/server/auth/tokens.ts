import { encodeBase32LowerCaseNoPadding } from '@oslojs/encoding';
import { eq } from 'drizzle-orm';

import { db } from '../db';
import { emailVerificationCodes, passwordResetTokens } from '../db/schema';

export function generateRandomOTP(): string {
	const bytes = new Uint8Array(5);
	crypto.getRandomValues(bytes);
	const code = encodeBase32LowerCaseNoPadding(bytes);
	return code;
}

export function generateIdFromEntropySize(size: number): string {
	const bytes = new Uint8Array(size);
	crypto.getRandomValues(bytes);
	return encodeBase32LowerCaseNoPadding(bytes);
}

export async function createEmailVerificationCode(
	userId: string,
	email: string
): Promise<string> {
	// Delete any existing codes for this user
	await db
		.delete(emailVerificationCodes)
		.where(eq(emailVerificationCodes.userId, userId));

	const code = generateRandomOTP();
	await db.insert(emailVerificationCodes).values({
		id: generateIdFromEntropySize(10),
		userId,
		email,
		code,
		expiresAt: new Date(Date.now() + 1000 * 60 * 15) // 15 minutes
	});

	return code;
}

export async function verifyEmailVerificationCode(
	userId: string,
	code: string
): Promise<boolean> {
	const result = await db
		.select()
		.from(emailVerificationCodes)
		.where(eq(emailVerificationCodes.userId, userId));

	if (result.length < 1) {
		return false;
	}

	const dbCode = result[0];

	if (dbCode.code !== code) {
		return false;
	}

	if (Date.now() >= dbCode.expiresAt.getTime()) {
		await db
			.delete(emailVerificationCodes)
			.where(eq(emailVerificationCodes.id, dbCode.id));
		return false;
	}

	await db
		.delete(emailVerificationCodes)
		.where(eq(emailVerificationCodes.id, dbCode.id));
	return true;
}

export async function createPasswordResetToken(
	userId: string
): Promise<string> {
	// Delete any existing tokens for this user
	await db
		.delete(passwordResetTokens)
		.where(eq(passwordResetTokens.userId, userId));

	const tokenId = generateIdFromEntropySize(25);
	await db.insert(passwordResetTokens).values({
		id: tokenId,
		userId,
		expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 2) // 2 hours
	});

	return tokenId;
}

export async function validatePasswordResetToken(
	tokenId: string
): Promise<string | null> {
	const result = await db
		.select()
		.from(passwordResetTokens)
		.where(eq(passwordResetTokens.id, tokenId));

	if (result.length < 1) {
		return null;
	}

	const token = result[0];

	if (Date.now() >= token.expiresAt.getTime()) {
		await db
			.delete(passwordResetTokens)
			.where(eq(passwordResetTokens.id, tokenId));
		return null;
	}

	return token.userId;
}
