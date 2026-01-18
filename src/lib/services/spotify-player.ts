interface SpotifyDevice {
	id: string;
	name: string;
	type: string;
	is_active: boolean;
}

interface PlaybackState {
	is_playing: boolean;
	device?: {
		id: string;
		name: string;
	};
}

export class SpotifyPlayerService {
	/**
	 * Fetches available Spotify devices for the authenticated user
	 */
	static async getDevices(token: string): Promise<SpotifyDevice[]> {
		try {
			const response = await fetch(
				'https://api.spotify.com/v1/me/player/devices',
				{
					headers: { Authorization: `Bearer ${token}` }
				}
			);

			if (!response.ok) {
				throw new Error('Failed to fetch devices');
			}

			const data = await response.json();
			return data.devices || [];
		} catch (error) {
			console.error('Failed to get devices:', error);
			throw error;
		}
	}

	/**
	 * Gets the current playback state
	 */
	static async getPlaybackState(token: string): Promise<PlaybackState | null> {
		try {
			const response = await fetch('https://api.spotify.com/v1/me/player', {
				headers: { Authorization: `Bearer ${token}` }
			});

			if (response.status === 204) {
				// No active playback
				return null;
			}

			if (response.ok) {
				return await response.json();
			}

			return null;
		} catch (error) {
			console.error('Failed to check playback state:', error);
			return null;
		}
	}

	/**
	 * Plays a track on the specified device
	 */
	static async playTrack(
		token: string,
		trackId: string,
		deviceId: string
	): Promise<void> {
		const response = await fetch(
			`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
			{
				method: 'PUT',
				body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				}
			}
		);

		if (!response.ok) {
			throw new Error('Failed to play track');
		}
	}

	/**
	 * Resumes playback
	 */
	static async resume(token: string, deviceId?: string): Promise<void> {
		const url = deviceId
			? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
			: 'https://api.spotify.com/v1/me/player/play';

		const response = await fetch(url, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			}
		});

		if (!response.ok) {
			throw new Error('Failed to resume playback');
		}
	}

	/**
	 * Pauses playback
	 */
	static async pause(token: string): Promise<void> {
		const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${token}`
			}
		});

		if (!response.ok) {
			throw new Error('Failed to pause playback');
		}
	}
}

export type { SpotifyDevice, PlaybackState };
