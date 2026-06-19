// In-browser Spotify Web Playback SDK controller.
// Turns the current browser tab into its own Spotify Connect device so audio
// plays from the host screen — no dependency on a separate (suspendable) app.

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';
const SDK_SCRIPT_ID = 'spotify-web-playback-sdk';

export type PlayerStatus =
	| 'idle'
	| 'loading'
	| 'ready'
	| 'not_ready'
	| 'auth_error'
	| 'account_error'
	| 'init_error'
	| 'playback_error';

/**
 * Load the Spotify Web Playback SDK script. Must be loaded from Spotify's CDN
 * (it pulls its own EME/worker resources) — cannot be bundled or self-hosted.
 * The global `onSpotifyWebPlaybackSDKReady` must be defined before the script
 * finishes loading, so we set it first, then append the tag.
 */
function loadSdkScript(): Promise<void> {
	if (window.Spotify) return Promise.resolve();

	return new Promise((resolve, reject) => {
		window.onSpotifyWebPlaybackSDKReady = () => resolve();

		if (document.getElementById(SDK_SCRIPT_ID)) return; // ready hook will still fire

		const script = document.createElement('script');
		script.id = SDK_SCRIPT_ID;
		script.src = SDK_SRC;
		script.async = true;
		script.onerror = () => reject(new Error('sdk-load-failed'));
		document.head.appendChild(script);
	});
}

export interface SpotifyPlayerController {
	readonly status: PlayerStatus;
	readonly deviceId: string | null;
	readonly isPlaying: boolean;
	readonly errorDetail: string;
	init(): Promise<void>;
	activate(): Promise<void>;
	disconnect(): void;
}

/**
 * Create a reactive ($state-backed) controller around a Spotify.Player.
 * Lives in a .svelte.ts module so it can hold runes.
 */
export function createSpotifyPlayer(playerName = 'Mixster'): SpotifyPlayerController {
	let status = $state<PlayerStatus>('idle');
	let deviceId = $state<string | null>(null);
	let isPlaying = $state(false);
	let errorDetail = $state('');
	let player: SpotifyPlayerInstance | null = null;

	async function fetchToken(): Promise<string | null> {
		try {
			const res = await fetch('/api/spotify/token');
			if (!res.ok) {
				status = 'auth_error';
				return null;
			}
			const data = await res.json();
			return data.accessToken ?? null;
		} catch {
			status = 'auth_error';
			return null;
		}
	}

	async function init(): Promise<void> {
		if (player) return;
		status = 'loading';

		try {
			await loadSdkScript();
		} catch {
			status = 'init_error';
			errorDetail = 'sdk-load-failed';
			return;
		}

		if (!window.Spotify) {
			status = 'init_error';
			errorDetail = 'sdk-unavailable';
			return;
		}

		player = new window.Spotify.Player({
			name: playerName,
			volume: 0.8,
			// Re-invoked by the SDK on token expiry; the endpoint refreshes
			// server-side, so no client-side token timer is needed.
			getOAuthToken: async (cb) => {
				const token = await fetchToken();
				if (token) cb(token);
			}
		});

		player.addListener('ready', ({ device_id }) => {
			deviceId = device_id;
			status = 'ready';
			errorDetail = '';
		});
		player.addListener('not_ready', () => {
			status = 'not_ready';
		});
		player.addListener('initialization_error', ({ message }) => {
			status = 'init_error';
			errorDetail = message;
		});
		player.addListener('authentication_error', ({ message }) => {
			status = 'auth_error';
			errorDetail = message;
		});
		player.addListener('account_error', ({ message }) => {
			status = 'account_error';
			errorDetail = message;
		});
		player.addListener('playback_error', ({ message }) => {
			status = 'playback_error';
			errorDetail = message;
		});
		player.addListener('player_state_changed', (state) => {
			// null = playback moved to another device
			isPlaying = state ? !state.paused : false;
		});

		const connected = await player.connect();
		if (!connected) {
			status = 'init_error';
			errorDetail = 'connect-failed';
		}
	}

	// iOS: the audio element must be unlocked inside a user gesture before any
	// programmatic playback. Idempotent and cheap — safe to call on every tap.
	async function activate(): Promise<void> {
		if (player && typeof player.activateElement === 'function') {
			try {
				await player.activateElement();
			} catch {
				/* non-fatal */
			}
		}
	}

	function disconnect(): void {
		try {
			player?.disconnect();
		} finally {
			player = null;
			status = 'idle';
			deviceId = null;
			isPlaying = false;
		}
	}

	return {
		get status() {
			return status;
		},
		get deviceId() {
			return deviceId;
		},
		get isPlaying() {
			return isPlaying;
		},
		get errorDetail() {
			return errorDetail;
		},
		init,
		activate,
		disconnect
	};
}
