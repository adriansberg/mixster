import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

export const users = pgTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	spotifyId: text('spotify_id').notNull().unique(),
	displayName: text('display_name'),
	email: text('email'),
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
