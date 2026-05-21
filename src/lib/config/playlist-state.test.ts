import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	STORAGE_KEY,
	PlaylistStateSchema,
	DEFAULT_PLAYLIST_STATE,
	parsePlaylistState,
	migrateOldKeys
} from './playlist-state';

// In-memory localStorage shim
function makeLocalStorageShim(): Storage {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => store.clear(),
		get length() {
			return store.size;
		},
		key: (index: number) => Array.from(store.keys())[index] ?? null
	};
}

describe('STORAGE_KEY', () => {
	it('equals shitster_playlists', () => {
		expect(STORAGE_KEY).toBe('shitster_playlists');
	});
});

describe('DEFAULT_PLAYLIST_STATE', () => {
	it('has version 1', () => {
		expect(DEFAULT_PLAYLIST_STATE.version).toBe(1);
	});

	it('has empty defaultSelected', () => {
		expect(DEFAULT_PLAYLIST_STATE.defaultSelected).toEqual([]);
	});

	it('has empty custom', () => {
		expect(DEFAULT_PLAYLIST_STATE.custom).toEqual([]);
	});
});

describe('PlaylistStateSchema', () => {
	it('accepts valid schema with enabled field', () => {
		const result = PlaylistStateSchema.safeParse({
			version: 1,
			defaultSelected: ['norway'],
			custom: [{ id: 'abc', name: 'My Playlist', uri: 'spotify:playlist:123', trackCount: 50, enabled: true }]
		});
		expect(result.success).toBe(true);
	});

	it('rejects custom entries missing the enabled field', () => {
		const result = PlaylistStateSchema.safeParse({
			version: 1,
			defaultSelected: [],
			custom: [{ id: 'abc', name: 'My Playlist', uri: 'spotify:playlist:123', trackCount: 50 }]
		});
		expect(result.success).toBe(false);
	});

	it('rejects version 2 (wrong literal)', () => {
		const result = PlaylistStateSchema.safeParse({
			version: 2,
			defaultSelected: [],
			custom: []
		});
		expect(result.success).toBe(false);
	});
});

describe('parsePlaylistState', () => {
	it('returns DEFAULT_PLAYLIST_STATE for empty string', () => {
		const result = parsePlaylistState('');
		expect(result).toEqual(DEFAULT_PLAYLIST_STATE);
	});

	it('returns DEFAULT_PLAYLIST_STATE for invalid JSON', () => {
		const result = parsePlaylistState('not-json');
		expect(result).toEqual(DEFAULT_PLAYLIST_STATE);
	});

	it('returns DEFAULT_PLAYLIST_STATE for wrong version', () => {
		const result = parsePlaylistState('{"version":2}');
		expect(result).toEqual(DEFAULT_PLAYLIST_STATE);
	});

	it('never throws for any input', () => {
		expect(() => parsePlaylistState('')).not.toThrow();
		expect(() => parsePlaylistState('not-json')).not.toThrow();
		expect(() => parsePlaylistState('{"version":2}')).not.toThrow();
		expect(() => parsePlaylistState('null')).not.toThrow();
		expect(() => parsePlaylistState('[]')).not.toThrow();
	});

	it('returns parsed state for valid JSON matching schema', () => {
		const valid = {
			version: 1,
			defaultSelected: ['norway', 'sweden'],
			custom: [{ id: 'x1', name: 'Custom', uri: 'spotify:playlist:abc', trackCount: 100, enabled: false }]
		};
		const result = parsePlaylistState(JSON.stringify(valid));
		expect(result).toEqual(valid);
	});

	it('strips unknown fields and returns valid PlaylistState', () => {
		const withExtra = {
			version: 1,
			defaultSelected: ['norway'],
			custom: [],
			extraField: 'should-be-stripped'
		};
		const result = parsePlaylistState(JSON.stringify(withExtra));
		expect(result.version).toBe(1);
		expect(result.defaultSelected).toEqual(['norway']);
		expect(result.custom).toEqual([]);
		expect('extraField' in result).toBe(false);
	});
});

describe('migrateOldKeys', () => {
	let originalWindow: typeof globalThis.window;
	let originalLocalStorage: Storage;

	beforeEach(() => {
		originalWindow = globalThis.window;
		originalLocalStorage = globalThis.localStorage;
	});

	afterEach(() => {
		// Restore
		if (originalWindow === undefined) {
			// @ts-expect-error restore undefined
			delete globalThis.window;
		} else {
			globalThis.window = originalWindow;
		}
		globalThis.localStorage = originalLocalStorage;
	});

	it('is a no-op when window is undefined (SSR safety)', () => {
		// @ts-expect-error simulate SSR
		delete globalThis.window;
		// Should not throw ReferenceError
		expect(() => migrateOldKeys()).not.toThrow();
	});

	it('migrates old shitster_custom_playlists with enabled: true when shitster_playlists absent', () => {
		const shim = makeLocalStorageShim();
		globalThis.localStorage = shim;
		// Simulate window existing
		globalThis.window = globalThis as unknown as Window & typeof globalThis;

		const oldCustom = [
			{ id: 'c1', name: 'Old Custom', uri: 'spotify:playlist:old1', trackCount: 30 }
		];
		shim.setItem('shitster_custom_playlists', JSON.stringify(oldCustom));

		migrateOldKeys();

		const newVal = shim.getItem(STORAGE_KEY);
		expect(newVal).not.toBeNull();
		const parsed = JSON.parse(newVal!);
		expect(parsed.custom[0].enabled).toBe(true);
		expect(parsed.custom[0].id).toBe('c1');
		// Old key removed
		expect(shim.getItem('shitster_custom_playlists')).toBeNull();
	});

	it('migrates old shitster_selected_defaults when shitster_playlists absent', () => {
		const shim = makeLocalStorageShim();
		globalThis.localStorage = shim;
		globalThis.window = globalThis as unknown as Window & typeof globalThis;

		const oldDefaults = ['norway', 'sweden'];
		shim.setItem('shitster_selected_defaults', JSON.stringify(oldDefaults));

		migrateOldKeys();

		const newVal = shim.getItem(STORAGE_KEY);
		expect(newVal).not.toBeNull();
		const parsed = JSON.parse(newVal!);
		expect(parsed.defaultSelected).toEqual(oldDefaults);
		// Old key removed
		expect(shim.getItem('shitster_selected_defaults')).toBeNull();
	});

	it('leaves shitster_playlists alone when already present, still removes old keys', () => {
		const shim = makeLocalStorageShim();
		globalThis.localStorage = shim;
		globalThis.window = globalThis as unknown as Window & typeof globalThis;

		const existing = JSON.stringify({ version: 1, defaultSelected: ['norway'], custom: [] });
		shim.setItem(STORAGE_KEY, existing);
		shim.setItem('shitster_custom_playlists', JSON.stringify([{ id: 'c1', name: 'Old', uri: 'x', trackCount: 1 }]));
		shim.setItem('shitster_selected_defaults', JSON.stringify(['sweden']));

		migrateOldKeys();

		// New key unchanged
		expect(shim.getItem(STORAGE_KEY)).toBe(existing);
		// Old keys removed
		expect(shim.getItem('shitster_custom_playlists')).toBeNull();
		expect(shim.getItem('shitster_selected_defaults')).toBeNull();
	});

	it('deletes malformed old key and falls through to defaults for that slot', () => {
		const shim = makeLocalStorageShim();
		globalThis.localStorage = shim;
		globalThis.window = globalThis as unknown as Window & typeof globalThis;

		shim.setItem('shitster_custom_playlists', 'NOT VALID JSON');

		migrateOldKeys();

		// Malformed old key should be removed
		expect(shim.getItem('shitster_custom_playlists')).toBeNull();
	});
});
