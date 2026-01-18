import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

export const users = pgTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	passwordHash: text('password_hash'),
	name: text('name'),
	avatar: text('avatar'),
	createdAt: timestamp('created_at', { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
});

export const sessions = pgTable('sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

export const emailVerificationCodes = pgTable('email_verification_codes', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' })
		.unique(),
	email: text('email').notNull(),
	code: text('code').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' })
		.unique(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

export const oauthAccounts = pgTable('oauth_accounts', {
	providerId: text('provider_id').notNull(), // 'spotify'
	providerUserId: text('provider_user_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' })
});

export const spotifyTokens = pgTable('spotify_tokens', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	accessToken: text('access_token').notNull(),
	refreshToken: text('refresh_token').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

export const userPlaylists = pgTable('user_playlists', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	spotifyPlaylistUri: text('spotify_playlist_uri').notNull(),
	name: text('name').notNull(),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { withTimezone: true })
		.notNull()
		.defaultNow()
});

export const playedSongs = pgTable('played_songs', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	spotifyTrackId: text('spotify_track_id').notNull(),
	sessionId: text('session_id'),
	playedAt: timestamp('played_at', { withTimezone: true })
		.notNull()
		.defaultNow()
});
