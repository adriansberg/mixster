// Spotify Web Playback SDK types
declare global {
	interface Window {
		Spotify: typeof Spotify;
		onSpotifyWebPlaybackSDKReady: () => void;
	}
}

export interface SpotifyPlayer {
	connect(): Promise<boolean>;
	disconnect(): void;
	addListener(event: string, callback: (data: unknown) => void): void;
	removeListener(event: string, callback?: (data: unknown) => void): void;
	getCurrentState(): Promise<SpotifyPlayerState | null>;
	setName(name: string): Promise<void>;
	getVolume(): Promise<number>;
	setVolume(volume: number): Promise<void>;
	pause(): Promise<void>;
	resume(): Promise<void>;
	togglePlay(): Promise<void>;
	seek(position_ms: number): Promise<void>;
	previousTrack(): Promise<void>;
	nextTrack(): Promise<void>;
}

export interface SpotifyPlayerState {
	context: {
		uri: string;
		metadata: unknown;
	};
	disallows: {
		pausing: boolean;
		skipping_prev: boolean;
	};
	paused: boolean;
	position: number;
	repeat_mode: number;
	shuffle: boolean;
	track_window: {
		current_track: SpotifyTrack;
		previous_tracks: SpotifyTrack[];
		next_tracks: SpotifyTrack[];
	};
}

export interface SpotifyTrack {
	uri: string;
	id: string;
	type: string;
	media_type: string;
	name: string;
	is_playable: boolean;
	album: {
		uri: string;
		name: string;
		images: Array<{ url: string }>;
	};
	artists: Array<{ uri: string; name: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare namespace Spotify {
	class Player implements SpotifyPlayer {
		constructor(options: {
			name: string;
			getOAuthToken: (cb: (token: string) => void) => void;
			volume?: number;
		});
		connect(): Promise<boolean>;
		disconnect(): void;
		addListener(event: string, callback: (data: unknown) => void): void;
		removeListener(event: string, callback?: (data: unknown) => void): void;
		getCurrentState(): Promise<SpotifyPlayerState | null>;
		setName(name: string): Promise<void>;
		getVolume(): Promise<number>;
		setVolume(volume: number): Promise<void>;
		pause(): Promise<void>;
		resume(): Promise<void>;
		togglePlay(): Promise<void>;
		seek(position_ms: number): Promise<void>;
		previousTrack(): Promise<void>;
		nextTrack(): Promise<void>;
	}
}

export {};
