<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let deviceId: string = $state('');
	let availableDevices: SpotifyDevice[] = $state([]);
	let isReady = $state(false);
	let currentTrack: Track | null = $state(null);
	let isRevealed = $state(false);
	let isPlaying = $state(false);
	let loading = $state(false);
	let errorMessage = $state('');
	let sessionId = $state('');
	let selectedDefaults: string[] = $state([]);
	let playbackCheckInterval: number | null = $state(null);

	interface Track {
		id: string;
		name: string;
		artists: string[];
		releaseYear: number;
		albumArt?: string;
	}

	interface SpotifyDevice {
		id: string;
		name: string;
		type: string;
		is_active: boolean;
	}

	onMount(() => {
		// Get session data from localStorage
		sessionId = localStorage.getItem('shitster_session_id') || '';
		const stored = localStorage.getItem('shitster_selected_defaults');
		selectedDefaults = stored ? JSON.parse(stored) : [];

		if (!sessionId) {
			goto('/setup');
			return;
		}

		// Get available Spotify devices
		getAvailableDevices();

		// Start polling for playback state
		playbackCheckInterval = window.setInterval(checkPlaybackState, 2000);

		return () => {
			if (playbackCheckInterval) {
				clearInterval(playbackCheckInterval);
			}
		};
	});

	async function getAvailableDevices() {
		const token = await getAccessToken();
		if (!token) return;

		try {
			const response = await fetch(
				'https://api.spotify.com/v1/me/player/devices',
				{
					headers: { Authorization: `Bearer ${token}` }
				}
			);

			if (response.ok) {
				const data = await response.json();
				availableDevices = data.devices;

				// Find an active device or use the first available one
				const activeDevice = availableDevices.find((d) => d.is_active);
				if (activeDevice) {
					deviceId = activeDevice.id;
					isReady = true;
				} else if (availableDevices.length > 0) {
					deviceId = availableDevices[0].id;
					isReady = true;
				} else {
					errorMessage =
						'No Spotify devices found. Please open Spotify on your phone, computer, or other device.';
				}
			}
		} catch (error) {
			console.error('Failed to get devices:', error);
			errorMessage = 'Failed to get Spotify devices';
		}
	}

	async function checkPlaybackState() {
		const token = await getAccessToken();
		if (!token) return;

		try {
			const response = await fetch('https://api.spotify.com/v1/me/player', {
				headers: { Authorization: `Bearer ${token}` }
			});

			if (response.status === 204) {
				// No active playback
				return;
			}

			if (response.ok) {
				const data = await response.json();
				isPlaying = data.is_playing;

				// Update device if it changed
				if (data.device && data.device.id !== deviceId) {
					deviceId = data.device.id;
				}
			}
		} catch (error) {
			console.error('Failed to check playback state:', error);
		}
	}

	async function getAccessToken(): Promise<string | null> {
		try {
			const response = await fetch('/api/spotify/token');
			if (response.status === 401) {
				// Not authenticated - redirect to setup/login
				errorMessage = 'Please log in with Spotify to play music';
				setTimeout(() => goto('/setup'), 2000);
				return null;
			}
			if (!response.ok) return null;
			const data = await response.json();
			return data.accessToken;
		} catch {
			return null;
		}
	}

	async function getNextSong() {
		loading = true;
		errorMessage = '';
		isRevealed = false;

		try {
			// Get custom playlists from localStorage
			const storedCustom = localStorage.getItem('shitster_custom_playlists');
			const customPlaylists = storedCustom ? JSON.parse(storedCustom) : [];
			const customPlaylistUris = customPlaylists.map((p: any) => p.uri);

			const response = await fetch('/api/spotify/songs/random', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					selectedDefaultPlaylists: selectedDefaults,
					customPlaylistUris
				})
			});

			if (!response.ok) {
				const error = await response.json();
				errorMessage = error.error || 'Failed to get next song';
				return;
			}

			const data = await response.json();
			currentTrack = data.track;

			if (currentTrack) {
				// Play the track
				await playSong(currentTrack.id);
			}
		} catch {
			errorMessage = 'Failed to load next song';
		} finally {
			loading = false;
		}
	}

	async function playSong(trackId: string) {
		if (!deviceId) {
			errorMessage = 'Spotify player not ready';
			return;
		}

		const token = await getAccessToken();
		if (!token) {
			errorMessage = 'Failed to get access token';
			return;
		}

		try {
			await fetch(
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
		} catch {
			errorMessage = 'Failed to play song';
		}
	}

	function revealSong() {
		isRevealed = true;
		pausePlayback();
	}

	async function resumePlayback() {
		const token = await getAccessToken();
		if (!token) {
			errorMessage = 'Failed to get access token';
			return;
		}

		try {
			const url = deviceId
				? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
				: 'https://api.spotify.com/v1/me/player/play';

			await fetch(url, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				}
			});
			isPlaying = true;
		} catch {
			errorMessage = 'Failed to resume playback';
		}
	}

	async function pausePlayback() {
		const token = await getAccessToken();
		if (!token) {
			errorMessage = 'Failed to get access token';
			return;
		}

		try {
			await fetch('https://api.spotify.com/v1/me/player/pause', {
				method: 'PUT',
				headers: {
					Authorization: `Bearer ${token}`
				}
			});
			isPlaying = false;
		} catch {
			errorMessage = 'Failed to pause playback';
		}
	}

	async function clearHistory() {
		try {
			await fetch('/api/spotify/history/clear', { method: 'POST' });
			alert('Song history cleared!');
		} catch {
			alert('Failed to clear history');
		}
	}

	function endGame() {
		localStorage.removeItem('shitster_session_id');
		localStorage.removeItem('shitster_selected_defaults');
		goto('/');
	}
</script>

<svelte:head>
	<title>Play - Shitster</title>
</svelte:head>

<div class="min-h-screen p-4 md:p-8">
	<div class="max-w-2xl mx-auto space-y-6">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<h1 class="text-3xl font-bold">🎵 Shitster</h1>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={clearHistory}>
					Clear History
				</Button>
				<Button variant="outline" size="sm" onclick={endGame}>End Game</Button>
			</div>
		</div>

		<!-- Player Status -->
		<div class="text-center">
			{#if !isReady}
				<div class="p-4 rounded-lg bg-muted space-y-4">
					<p class="text-muted-foreground">Looking for Spotify devices...</p>
					{#if availableDevices.length > 0}
						<div class="space-y-2">
							<p class="text-sm">Select a device to play on:</p>
							<div class="flex flex-col gap-2">
								{#each availableDevices as device (device.id)}
									<Button
										variant={device.id === deviceId ? 'default' : 'outline'}
										onclick={() => {
											deviceId = device.id;
											isReady = true;
											errorMessage = '';
										}}
									>
										{device.name} ({device.type})
										{device.is_active ? '🎵' : ''}
									</Button>
								{/each}
							</div>
						</div>
					{:else}
						<Button size="sm" onclick={getAvailableDevices}
							>Refresh Devices</Button
						>
					{/if}
				</div>
			{:else if errorMessage}
				<div
					class="p-4 rounded-lg bg-destructive/10 border border-destructive space-y-2"
				>
					<p class="text-destructive">{errorMessage}</p>
					<Button size="sm" variant="outline" onclick={getAvailableDevices}>
						Retry
					</Button>
				</div>
			{:else if !currentTrack}
				<div class="p-8 rounded-lg border bg-card space-y-4">
					<p class="text-sm text-muted-foreground">
						Playing on: {availableDevices.find((d) => d.id === deviceId)
							?.name || 'Spotify Device'}
					</p>
					<p class="text-lg text-muted-foreground">Ready to play!</p>
					<Button size="lg" onclick={getNextSong} disabled={loading}>
						{loading ? 'Loading...' : 'Start First Song'}
					</Button>
				</div>
			{/if}
		</div>

		<!-- Current Track -->
		{#if currentTrack && isReady}
			<div class="space-y-4">
				<!-- Playback Card -->
				<div class="p-8 rounded-lg border bg-card text-center space-y-6">
					{#if !isRevealed}
						<div class="space-y-4">
							<div class="text-6xl">🎵</div>
							<p class="text-lg text-muted-foreground">
								{isPlaying ? 'Song is playing...' : 'Song paused'}
							</p>
							<p class="text-sm text-muted-foreground">
								Guess the year this song was released!
							</p>
							<div class="flex gap-2 justify-center">
								{#if isPlaying}
									<Button variant="outline" onclick={pausePlayback}
										>⏸️ Pause</Button
									>
								{:else}
									<Button variant="outline" onclick={resumePlayback}
										>▶️ Play</Button
									>
								{/if}
							</div>
						</div>
					{:else}
						<div class="space-y-4">
							{#if currentTrack.albumArt}
								<img
									src={currentTrack.albumArt}
									alt="Album art"
									class="w-48 h-48 mx-auto rounded-lg shadow-lg"
								/>
							{/if}
							<div class="space-y-2">
								<h2 class="text-3xl font-bold">{currentTrack.name}</h2>
								<p class="text-xl text-muted-foreground">
									{currentTrack.artists.join(', ')}
								</p>
								<p class="text-4xl font-bold text-primary mt-4">
									{currentTrack.releaseYear}
								</p>
							</div>
						</div>
					{/if}
				</div>

				<!-- Controls -->
				<div class="flex gap-2 justify-center">
					{#if !isRevealed}
						<Button size="lg" onclick={revealSong}>Reveal Song</Button>
					{:else}
						<Button size="lg" onclick={getNextSong} disabled={loading}>
							{loading ? 'Loading...' : 'Next Song'}
						</Button>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
