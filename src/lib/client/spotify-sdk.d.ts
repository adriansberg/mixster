// Minimal ambient types for the Spotify Web Playback SDK.
// Covers only the surface used by the in-browser player controller.
// Full types are available via @types/spotify-web-playback-sdk if ever installed.

interface SpotifyPlayerInit {
	name: string;
	getOAuthToken: (cb: (token: string) => void) => void;
	volume?: number;
}

interface SpotifyWebPlaybackError {
	message: string;
}

interface SpotifyWebPlaybackState {
	paused: boolean;
}

type SpotifyPlayerEvent =
	| 'ready'
	| 'not_ready'
	| 'player_state_changed'
	| 'autoplay_failed'
	| 'initialization_error'
	| 'authentication_error'
	| 'account_error'
	| 'playback_error';

interface SpotifyPlayerInstance {
	connect(): Promise<boolean>;
	disconnect(): void;
	resume(): Promise<void>;
	activateElement?(): Promise<void>;
	addListener(event: 'ready' | 'not_ready', cb: (d: { device_id: string }) => void): boolean;
	addListener(
		event: 'player_state_changed',
		cb: (state: SpotifyWebPlaybackState | null) => void
	): boolean;
	addListener(event: 'autoplay_failed', cb: () => void): boolean;
	addListener(
		event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
		cb: (err: SpotifyWebPlaybackError) => void
	): boolean;
	removeListener(event: SpotifyPlayerEvent): boolean;
}

interface SpotifyNamespace {
	Player: new (init: SpotifyPlayerInit) => SpotifyPlayerInstance;
}

interface Window {
	Spotify?: SpotifyNamespace;
	onSpotifyWebPlaybackSDKReady?: () => void;
}
