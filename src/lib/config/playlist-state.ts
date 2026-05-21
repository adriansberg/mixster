import { z } from 'zod';

export const STORAGE_KEY = 'mixster_playlists';

export const PlaylistStateSchema = z.object({
	version: z.literal(1),
	defaultSelected: z.array(z.string()),
	custom: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			uri: z.string(),
			trackCount: z.number(),
			enabled: z.boolean()
		})
	)
});

export type PlaylistState = z.infer<typeof PlaylistStateSchema>;

export const DEFAULT_PLAYLIST_STATE: PlaylistState = {
	version: 1,
	defaultSelected: [],
	custom: []
};

/**
 * Parse raw localStorage string into PlaylistState.
 * Returns DEFAULT_PLAYLIST_STATE on any failure — never throws.
 */
export function parsePlaylistState(raw: string): PlaylistState {
	try {
		const parsed = JSON.parse(raw);
		const result = PlaylistStateSchema.safeParse(parsed);
		if (!result.success) return DEFAULT_PLAYLIST_STATE;
		return result.data;
	} catch {
		return DEFAULT_PLAYLIST_STATE;
	}
}

/**
 * One-time migration from old localStorage keys to the consolidated schema.
 * Browser-only (no-op if window is undefined).
 * Always removes old keys at the end (even malformed ones).
 */
export function migrateOldKeys(): void {
	if (typeof window === 'undefined') return;

	const OLD_CUSTOM_KEY = 'mixster_custom_playlists';
	const OLD_DEFAULTS_KEY = 'mixster_selected_defaults';

	const alreadyMigrated = localStorage.getItem(STORAGE_KEY) !== null;

	if (!alreadyMigrated) {
		const migration: PlaylistState = { ...DEFAULT_PLAYLIST_STATE, custom: [], defaultSelected: [] };

		// Migrate old custom playlists
		const rawCustom = localStorage.getItem(OLD_CUSTOM_KEY);
		if (rawCustom !== null) {
			try {
				const oldCustom = JSON.parse(rawCustom) as Array<{
					id: string;
					name: string;
					uri: string;
					trackCount: number;
				}>;
				if (Array.isArray(oldCustom)) {
					migration.custom = oldCustom.map((entry) => ({ ...entry, enabled: true }));
				}
			} catch {
				// Malformed — fall through, old key will be removed below
			}
		}

		// Migrate old selected defaults
		const rawDefaults = localStorage.getItem(OLD_DEFAULTS_KEY);
		if (rawDefaults !== null) {
			try {
				const oldDefaults = JSON.parse(rawDefaults) as string[];
				if (Array.isArray(oldDefaults)) {
					migration.defaultSelected = oldDefaults;
				}
			} catch {
				// Malformed — fall through, old key will be removed below
			}
		}

		// Write migration result only if schema is valid
		const validated = PlaylistStateSchema.safeParse(migration);
		if (validated.success) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(validated.data));
		}
	}

	// Always clean up old keys
	localStorage.removeItem(OLD_CUSTOM_KEY);
	localStorage.removeItem(OLD_DEFAULTS_KEY);
}
