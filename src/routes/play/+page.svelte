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
	let visibilityState = $state<DocumentVisibilityState>('visible');
	let windowFocused = $state(true);

	// Stop/start polling based on page visibility AND window focus
	$effect(() => {
		const isActive = visibilityState === 'visible' && windowFocused;

		if (!isActive) {
			stopPolling();
		} else if (sessionId) {
			startPolling();
		}
	});

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
		startPolling();

		return () => {
			stopPolling();
		};
	});

	function startPolling() {
		if (!playbackCheckInterval) {
			playbackCheckInterval = window.setInterval(checkPlaybackState, 2000);
		}
	}

	function stopPolling() {
		if (playbackCheckInterval) {
			clearInterval(playbackCheckInterval);
			playbackCheckInterval = null;
		}
	}

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

<svelte:document bind:visibilityState />
<svelte:window
	onblur={() => (windowFocused = false)}
	onfocus={() => (windowFocused = true)}
/>

<div
	class="min-h-screen p-4 md:p-8 bg-linear-to-br from-purple-600/10 via-pink-500/10 to-orange-400/10 relative"
>
	<!-- Decorative background gradient -->
	<div
		class="absolute inset-0 bg-linear-to-br from-background/80 via-background/90 to-background pointer-events-none"
	></div>

	<div class="max-w-2xl mx-auto space-y-6 relative z-10">
		<!-- Header -->
		<div class="flex items-center justify-center sm:justify-between">
			<h1
				class="text-3xl md:text-4xl font-bold bg-linear-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent"
				style="font-family: 'Monoton', sans-serif;"
			>
				shitster
			</h1>
			<div class="hidden sm:flex gap-2">
				<Button variant="outline" size="sm" onclick={clearHistory}>
					TØM HISTORIKK
				</Button>
				<Button variant="outline" size="sm" onclick={endGame}
					>AVSLUTT SPILL</Button
				>
			</div>
		</div>

		<!-- Player Status -->
		<div class="text-center">
			{#if !isReady}
				<div
					class="p-4 md:p-6 rounded-lg bg-card/50 backdrop-blur-sm border shadow-lg space-y-4"
				>
					<p class="text-muted-foreground">Leter etter Spotify-enheter...</p>
					{#if availableDevices.length > 0}
						<div class="space-y-2">
							<p class="text-sm">Velg en enhet å spille på:</p>
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
							>Oppdater enheter</Button
						>
					{/if}
				</div>
			{:else if errorMessage}
				<div
					class="p-4 md:p-6 rounded-lg bg-destructive/10 border border-destructive space-y-2"
				>
					<p class="text-destructive">{errorMessage}</p>
					<Button size="sm" variant="outline" onclick={getAvailableDevices}>
						Prøv Igjen
					</Button>
				</div>
			{:else if !currentTrack}
				<div
					class="p-8 rounded-lg bg-card/50 space-y-4"
				>
					<p class="text-sm text-muted-foreground">
						Spiller på: {availableDevices.find((d) => d.id === deviceId)
							?.name || 'Spotify-enhet'}
					</p>
					<p class="text-lg text-muted-foreground">Klar til å spille!</p>
					<Button
						size="lg"
						onclick={getNextSong}
						disabled={loading}
						class="bg-linear-to-r text-lg text-white from-purple-600 via-pink-500 to-orange-400 hover:shadow-xl transition-all hover:scale-105 active:scale-95 border-0 font-bold"
					>
						{loading ? 'LASTER...' : 'START FØRSTE SANG'}
					</Button>
				</div>
			{/if}
		</div>

		<!-- Current Track -->
		{#if currentTrack && isReady}
			<div class="space-y-4">
				<!-- Hitster-style Card with Flip Effect -->
				<div class="perspective-card mt-4">
					<div class="card-container" class:flipped={isRevealed}>
						<!-- Back of Card (Hidden Song) -->
						<div
							class="card card-back bg-linear-to-br from-purple-600 via-pink-500 to-orange-400"
						>
							<div
								class="flex flex-col items-center justify-center h-full text-white space-y-6"
							>
								<div class="text-8xl md:text-9xl animate-pulse">🎵</div>
							</div>
						</div>

						<!-- Front of Card (Revealed Song) -->
						<div class="card card-front bg-white dark:bg-card">
							<div
								class="flex flex-col items-center justify-center h-full space-y-4 p-6"
							>
								{#if currentTrack.albumArt}
									<img
										src={currentTrack.albumArt}
										alt="Album art"
										class="w-40 h-40 md:w-48 md:h-48 rounded-lg shadow-2xl"
									/>
								{/if}
								<div class="space-y-2 text-center">
									<h2 class="text-2xl md:text-3xl font-bold">
										{currentTrack.name}
									</h2>
									<p class="text-lg md:text-xl text-muted-foreground">
										{currentTrack.artists.join(', ')}
									</p>
									<div class="pt-4">
										<div
											class="inline-block bg-linear-to-r from-purple-600 via-pink-500 to-orange-400 text-white px-8 py-3 rounded-full shadow-lg"
										>
											<p
												class="text-5xl md:text-6xl font-black"
												style="font-family: 'Righteous', cursive;"
											>
												{currentTrack.releaseYear}
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Play/Pause Button (Thumb-sized) -->
				<div class="flex justify-center mt-4">
					{#if isPlaying}
						<button
							onclick={pausePlayback}
							class="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white dark:bg-card shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform border-4 border-purple-500"
							aria-label="Pause"
						>
							<svg
								class="w-8 h-8 md:w-10 md:h-10 text-purple-600"
								fill="currentColor"
								viewBox="0 0 24 24"
							>
								<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
							</svg>
						</button>
					{:else}
						<button
							onclick={resumePlayback}
							class="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white dark:bg-card shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform border-4 border-purple-500"
							aria-label="Play"
						>
							<svg
								class="w-8 h-8 md:w-10 md:h-10 text-purple-600"
								fill="currentColor"
								viewBox="0 0 24 24"
							>
								<path d="M8 5v14l11-7z" />
							</svg>
						</button>
					{/if}
				</div>

				<!-- Controls -->
				<div class="flex gap-3 justify-center">
					{#if !isRevealed}
						<Button
							size="lg"
							onclick={revealSong}
							class="bg-linear-to-r text-white from-purple-600 via-pink-500 to-orange-400 hover:shadow-xl transition-all hover:scale-105 active:scale-95 border-0 font-bold text-base md:text-lg px-8 py-6"
						>
							VIS SANG
						</Button>
					{:else}
						<Button
							size="lg"
							onclick={getNextSong}
							disabled={loading}
							class="bg-linear-to-r from-purple-600 via-pink-500 to-orange-400 hover:shadow-xl transition-all hover:scale-105 active:scale-95 border-0 font-bold text-base md:text-lg px-8 py-6"
						>
							{loading ? 'LASTER...' : 'NESTE SANG'}
						</Button>
					{/if}
				</div>

				<!-- Mobile-only bottom buttons -->
				<div
					class="sm:hidden flex gap-2 justify-center pt-4 border-t border-border/50"
				>
					<Button variant="outline" size="sm" onclick={clearHistory}>
						TØM HISTORIKK
					</Button>
					<Button variant="outline" size="sm" onclick={endGame}
						>AVSLUTT SPILL</Button
					>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.perspective-card {
		perspective: 1000px;
		width: 100%;
		max-width: 400px;
		margin: 0 auto;
	}

	.card-container {
		position: relative;
		width: 100%;
		aspect-ratio: 3 / 4;
		transition: transform 0.8s;
		transform-style: preserve-3d;
	}

	.card-container.flipped {
		transform: rotateY(180deg);
	}

	.card {
		position: absolute;
		width: 100%;
		height: 100%;
		backface-visibility: hidden;
		border-radius: 1rem;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		overflow: hidden;
	}

	.card-back {
		transform: rotateY(0deg);
	}

	.card-front {
		transform: rotateY(180deg);
		border: 2px solid rgba(168, 85, 247, 0.3);
	}
</style>
