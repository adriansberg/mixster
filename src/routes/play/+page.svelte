<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let player: any = $state(null);
	let deviceId: string = $state('');
	let isReady = $state(false);
	let currentTrack: Track | null = $state(null);
	let isRevealed = $state(false);
	let isPlaying = $state(false);
	let loading = $state(false);
	let errorMessage = $state('');
	let sessionId = $state('');
	let selectedDefaults: string[] = $state([]);

	interface Track {
		id: string;
		name: string;
		artists: string[];
		releaseYear: number;
		albumArt?: string;
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

		// Load Spotify Web Playback SDK
		const script = document.createElement('script');
		script.src = 'https://sdk.scdn.co/spotify-player.js';
		script.async = true;
		document.body.appendChild(script);

		// @ts-expect-error - Spotify SDK callback
		window.onSpotifyWebPlaybackSDKReady = () => {
			initializePlayer();
		};

		return () => {
			if (player) {
				player.disconnect();
			}
		};
	});

	async function initializePlayer() {
		const token = await getAccessToken();

		if (!token) {
			errorMessage = 'Failed to get Spotify access token';
			return;
		}

		// @ts-expect-error - Spotify SDK
		player = new window.Spotify.Player({
			name: 'Shitster Game',
			getOAuthToken: (cb: (token: string) => void) => {
				cb(token);
			},
			volume: 0.5
		});

		player.addListener('ready', ({ device_id }: { device_id: string }) => {
			console.log('Ready with Device ID', device_id);
			deviceId = device_id;
			isReady = true;
		});

		player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
			console.log('Device ID has gone offline', device_id);
			isReady = false;
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		player.addListener('player_state_changed', (state: any) => {
			if (!state) {
				return;
			}
			isPlaying = !state.paused;
		});

		player.connect();
	}

	async function getAccessToken(): Promise<string | null> {
		try {
			const response = await fetch('/api/spotify/token');
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
			const response = await fetch('/api/spotify/songs/random', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					selectedDefaultPlaylists: selectedDefaults
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
		if (player) {
			player.pause();
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
				<div class="p-4 rounded-lg bg-muted">
					<p class="text-muted-foreground">Initializing Spotify player...</p>
				</div>
			{:else if errorMessage}
				<div class="p-4 rounded-lg bg-destructive/10 border border-destructive">
					<p class="text-destructive">{errorMessage}</p>
				</div>
			{:else if !currentTrack}
				<div class="p-8 rounded-lg border bg-card space-y-4">
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
