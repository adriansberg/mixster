<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { parsePlaylistState, STORAGE_KEY } from '$lib/config/playlist-state';

	let currentTrack: Track | null = $state(null);
	let isRevealed = $state(false);
	let loading = $state(false);
	let errorMessage = $state('');
	let requiresReauth = $state(false);
	let rateLimited = $state(false);
	let sessionId = $state('');
	let selectedDefaults: string[] = $state([]);
	let customPlaylistUris = $state<string[]>([]);
	let isPlaying = $state(false);
	let deviceId = $state<string | null>(null);
	let availableDevices = $state<SpotifyDevice[]>([]);
	let showDeviceSelector = $state(true);
	let songsPlayed = $state(0);
	let clearPending = $state(false);
	let clearSuccess = $state(false);

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

	onMount(async () => {
		// Get session data from localStorage
		sessionId = localStorage.getItem('shitster_session_id') || '';
		const state = parsePlaylistState(localStorage.getItem(STORAGE_KEY) ?? '');
		selectedDefaults = state.defaultSelected;
		customPlaylistUris = state.custom
			.filter((p) => p.enabled)
			.map((p) => p.uri);

		if (!sessionId) {
			goto('/setup');
			return;
		}

		// Get devices once at start
		try {
			const devicesResponse = await fetch('/api/spotify/devices');
			const data = await devicesResponse.json();

			// Check if re-authentication is required
			if (data.requiresReauth) {
				requiresReauth = true;
				return;
			}

			availableDevices = data.devices || [];

			if (availableDevices.length === 0) {
				errorMessage =
					'Ingen Spotify-enheter funnet. Åpne Spotify på en enhet først.';
				showDeviceSelector = true;
			} else if (availableDevices.length === 1) {
				// Auto-select if only one device
				deviceId = availableDevices[0].id;
			} else {
				// Show selector if multiple devices
				const activeDevice = availableDevices.find((d) => d.is_active);
				if (activeDevice) {
					deviceId = activeDevice.id;
				} else {
					showDeviceSelector = true;
				}
				showDeviceSelector = true;
			}
		} catch (error) {
			console.error('Failed to get devices:', error);
			errorMessage = 'Klarte ikke å hente Spotify-enheter. Prøv igjen.';
		}
	});

	async function getNextSong() {
		loading = true;
		errorMessage = '';
		requiresReauth = false;
		rateLimited = false;
		isRevealed = false;

		try {
			const response = await fetch('/api/spotify/songs/random', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					selectedDefaultPlaylists: selectedDefaults,
					customPlaylistUris
				})
			});

			if (response.status === 429) {
				rateLimited = true;
				return;
			}

			if (!response.ok) {
				const error = await response.json();

				if (error.requiresReauth) {
					requiresReauth = true;
					return;
				}

				errorMessage =
					error.error || 'Kunne ikke laste neste sang. Prøv igjen.';
				return;
			}

			const data = await response.json();
			currentTrack = data.track;
			songsPlayed += 1;

			if (currentTrack) {
				// Play the track
				await playSong(currentTrack.id);
			}
		} catch {
			errorMessage = 'Kunne ikke laste neste sang. Prøv igjen.';
		} finally {
			loading = false;
		}
	}

	async function playSong(trackId: string) {
		if (!deviceId) {
			errorMessage = 'Please select a device first';
			showDeviceSelector = true;
			return;
		}

		try {
			const playResponse = await fetch('/api/spotify/player/play', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ trackId, deviceId })
			});

			if (!playResponse.ok) {
				const error = await playResponse.json();

				if (error.requiresReauth) {
					requiresReauth = true;
					return;
				}

				errorMessage =
					'Avspilling feilet. Sjekk at Spotify er åpen på enheten.';
				return;
			}

			isPlaying = true;
			errorMessage = '';
		} catch (error) {
			console.error('Playback error:', error);
			errorMessage = 'Avspilling feilet. Sjekk at Spotify er åpen på enheten.';
		}
	}

	async function revealSong() {
		isRevealed = true;

		// Pause playback when revealing the song
		if (isPlaying) {
			try {
				const response = await fetch('/api/spotify/player/pause', {
					method: 'PUT'
				});

				if (response.ok) {
					isPlaying = false;
				}
			} catch (error) {
				console.error('Failed to pause on reveal:', error);
			}
		}
	}

	async function togglePlayback() {
		try {
			const action = isPlaying ? 'pause' : 'play';
			const response = await fetch('/api/spotify/player/' + action, {
				method: 'PUT'
			});

			if (response.ok) {
				isPlaying = !isPlaying;
			} else {
				const error = await response.json();
				errorMessage = error.error || 'Failed to control playback';
			}
		} catch {
			errorMessage = 'Failed to control playback';
		}
	}

	async function clearHistory() {
		if (!clearPending) {
			clearPending = true;
			return;
		}
		clearPending = false;
		try {
			const res = await fetch('/api/spotify/history/clear', { method: 'POST' });
			if (res.ok) {
				songsPlayed = 0;
				clearSuccess = true;
				setTimeout(() => {
					clearSuccess = false;
				}, 2000);
			} else {
				errorMessage = 'Klarte ikke å tømme historikk';
			}
		} catch {
			errorMessage = 'Klarte ikke å tømme historikk';
		}
	}

	function endGame() {
		localStorage.removeItem('shitster_session_id');
		goto('/');
	}
</script>

<svelte:head>
	<title>Play - Shitster</title>
</svelte:head>

<div class="min-h-screen p-4 md:p-8 bg-gray-950 relative">
	<!-- Decorative background gradient -->
	<div
		class="absolute inset-0 bg-linear-to-br from-purple-600/5 via-pink-500/5 to-orange-400/5 pointer-events-none"
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
			{#if songsPlayed > 0}
				<span class="text-base text-muted-foreground hidden sm:block"
					>{songsPlayed}
					{songsPlayed === 1 ? 'sang' : 'sanger'} spilt</span
				>
			{/if}
			<div class="hidden sm:flex gap-2">
				<Button
					variant={clearPending ? 'destructive' : 'outline'}
					size="sm"
					onclick={clearHistory}
					onblur={() => {
						clearPending = false;
					}}
				>
					{clearSuccess
						? 'Slettet!'
						: clearPending
							? 'Bekreft?'
							: 'TØM HISTORIKK'}
				</Button>
				<Button variant="outline" size="sm" onclick={endGame}
					>AVSLUTT SPILL</Button
				>
			</div>
		</div>

		<!-- Player Status -->
		<div class="text-center">
			{#if requiresReauth}
				<div
					class="bg-orange-500/10 border border-orange-500/50 rounded-lg p-4 space-y-3"
				>
					<p class="text-base font-semibold">Spotify-økt utløpt</p>
					<p class="text-sm text-muted-foreground">
						Logg inn på nytt for å fortsette.
					</p>
					<Button variant="outline" onclick={() => goto('/auth/login/spotify')}
						>Logg inn igjen</Button
					>
				</div>
			{:else if rateLimited}
				<div
					class="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 space-y-3"
				>
					<p class="text-base">
						Spotify er overbelastet. Vent litt og prøv igjen.
					</p>
					<Button
						variant="outline"
						size="sm"
						onclick={() => {
							rateLimited = false;
							getNextSong();
						}}>PRØV IGJEN</Button
					>
				</div>
			{:else if showDeviceSelector && availableDevices.length > 0}
				<div class="p-4 md:p-6 rounded-lg bg-card/50 space-y-4">
					<p class="text-lg font-semibold">Select a device:</p>
					<div class="space-y-2">
						{#each availableDevices as device (device.id)}
							<Button
								variant={deviceId === device.id ? 'default' : 'outline'}
								class="w-full"
								onclick={() => {
									deviceId = device.id;
									showDeviceSelector = false;
									errorMessage = '';
								}}
							>
								{device.name} ({device.type})
								{#if device.is_active}<span class="ml-2">🎵</span>{/if}
							</Button>
						{/each}
					</div>
				</div>
			{:else if errorMessage}
				<div
					class="p-4 md:p-6 rounded-lg bg-destructive/10 border border-destructive space-y-2"
				>
					<p class="text-destructive text-base">{errorMessage}</p>
				</div>
			{:else if !currentTrack}
				<div class="p-8 rounded-lg bg-card/50 space-y-4">
					<p class="text-lg text-muted-foreground">Klar til å spille!</p>
					<Button
						size="lg"
						onclick={getNextSong}
						disabled={loading || requiresReauth}
						class="bg-linear-to-r text-lg text-white from-purple-600 via-pink-500 to-orange-400 hover:shadow-xl transition-all hover:scale-105 active:scale-95 border-0 font-bold"
					>
						{loading ? 'LASTER...' : 'START FØRSTE SANG'}
					</Button>
				</div>
			{/if}
		</div>

		<!-- Current Track -->
		{#if currentTrack}
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

				<!-- Controls -->
				<div class="flex flex-col items-center">
					<!-- Play/Pause Control -->
					<Button
						size="lg"
						onclick={togglePlayback}
						variant="outline"
						class="text-2xl w-16 h-16 rounded-full mt-6 mb-6"
					>
						{isPlaying ? '⏸️' : '▶️'}
					</Button>

					<div class="flex gap-3">
						{#if !isRevealed}
							<Button
								size="lg"
								onclick={revealSong}
								class="bg-linear-to-r text-white from-purple-600 via-pink-500 to-orange-400 hover:shadow-xl transition-all hover:scale-105 active:scale-95 border-0 font-bold text-lg md:text-xl px-10 py-6"
							>
								VIS SANG
							</Button>
						{:else}
							<Button
								size="lg"
								onclick={getNextSong}
								disabled={loading || requiresReauth}
								class="bg-linear-to-r from-purple-600 via-pink-500 to-orange-400 hover:shadow-xl transition-all hover:scale-105 active:scale-95 border-0 font-bold text-lg md:text-xl px-10 py-6"
							>
								{loading ? 'LASTER...' : 'NESTE SANG'}
							</Button>
						{/if}
					</div>
				</div>

				<!-- Mobile-only bottom buttons -->
				<div
					class="sm:hidden flex flex-col items-center gap-2 pt-4 border-t border-border/50"
				>
					{#if songsPlayed > 0}
						<span class="text-sm text-muted-foreground"
							>{songsPlayed} {songsPlayed === 1 ? 'sang' : 'sanger'} spilt</span
						>
					{/if}
					<div class="flex gap-2">
						<Button
							variant={clearPending ? 'destructive' : 'outline'}
							size="sm"
							onclick={clearHistory}
							onblur={() => {
								clearPending = false;
							}}
						>
							{clearSuccess
								? 'Slettet!'
								: clearPending
									? 'Bekreft?'
									: 'TØM HISTORIKK'}
						</Button>
						<Button variant="outline" size="sm" onclick={endGame}
							>AVSLUTT SPILL</Button
						>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.perspective-card {
		perspective: 1000px;
		width: 100%;
		max-width: 480px;
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
