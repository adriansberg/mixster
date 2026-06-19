<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { parsePlaylistState, STORAGE_KEY } from '$lib/config/playlist-state';
	import { createSpotifyPlayer } from '$lib/client/spotify-player.svelte';

	let currentTrack: Track | null = $state(null);
	let isRevealed = $state(false);
	let loading = $state(false);
	let errorMessage = $state('');
	let requiresReauth = $state(false);
	let rateLimited = $state(false);
	let sessionId = $state('');
	let selectedDefaults: string[] = $state([]);
	let customPlaylistUris = $state<string[]>([]);
	let songsPlayed = $state(0);
	let clearPending = $state(false);
	let clearSuccess = $state(false);

	// Playback mode: 'sdk' = this browser tab is the Spotify device (audio plays
	// here); 'connect' = control an external Spotify device (fallback).
	let mode = $state<'sdk' | 'connect'>('sdk');
	const player = createSpotifyPlayer('Mixster');

	// Connect-mode device state (the old external-device flow, kept as fallback).
	let connectDeviceId = $state<string | null>(null);
	let connectIsPlaying = $state(false);
	let availableDevices = $state<SpotifyDevice[]>([]);
	let showDeviceSelector = $state(false);

	// The device we actually target, and the playback truth, per active mode.
	const activeDeviceId = $derived(
		mode === 'sdk' ? player.deviceId : connectDeviceId
	);
	const isPlaying = $derived(mode === 'sdk' ? player.isPlaying : connectIsPlaying);

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
		sessionId = localStorage.getItem('mixster_session_id') || '';
		const state = parsePlaylistState(localStorage.getItem(STORAGE_KEY) ?? '');
		selectedDefaults = state.defaultSelected;
		customPlaylistUris = state.custom
			.filter((p) => p.enabled)
			.map((p) => p.uri);

		if (!sessionId) {
			goto('/setup');
			return;
		}

		// Try the in-browser SDK player first. Connect-mode device loading happens
		// only if the SDK can't run (see the status effect below).
		await player.init();

		// iOS suspends the tab on lock; re-register the device when we return.
		document.addEventListener('visibilitychange', handleVisibility);
	});

	// Screen Wake Lock keeps the host screen awake during play so the tab is
	// never auto-suspended (which drops the SDK device from Spotify Connect).
	let wakeLock: WakeLockSentinel | null = null;

	async function requestWakeLock() {
		if (!browser || !('wakeLock' in navigator)) return;
		try {
			wakeLock = await navigator.wakeLock.request('screen');
		} catch {
			/* denied (e.g. low battery) — non-fatal */
		}
	}

	function releaseWakeLock() {
		wakeLock?.release().catch(() => {});
		wakeLock = null;
	}

	// Shown after returning from background (e.g. a manual phone lock) so the
	// user always has a one-tap way to restart playback, even when the SDK
	// didn't emit autoplay_failed.
	let needsResume = $state(false);

	function handleVisibility() {
		if (document.visibilityState !== 'visible') return;
		// Wake Lock auto-releases when the tab is hidden — re-acquire on return.
		if (!wakeLock) requestWakeLock();
		if (mode === 'sdk') {
			if (player.status === 'not_ready') player.reconnect();
			// A manual lock can have dropped the device while we were hidden.
			if (currentTrack && !player.isPlaying) needsResume = true;
		}
	}

	// Clear the resume prompt once audio is actually playing.
	$effect(() => {
		if (isPlaying) needsResume = false;
	});

	// One-tap recovery button. If audio was merely blocked (device still live),
	// a direct resume() works. Otherwise re-register the device and replay the
	// current track — iOS will then surface needsGesture for a final tap.
	async function tapToPlay() {
		if (mode === 'sdk') await player.activate();
		if (player.needsGesture) {
			await player.resume();
		} else if (currentTrack) {
			needsResume = false;
			await playSong(currentTrack.id);
		}
	}

	onDestroy(() => {
		// onDestroy also runs during SSR teardown — guard browser-only APIs.
		if (!browser) return;
		document.removeEventListener('visibilitychange', handleVisibility);
		releaseWakeLock();
		player.disconnect();
	});

	// Bridge SDK status into the page's mode/auth state. Guarded so it doesn't loop.
	$effect(() => {
		const s = player.status;
		if ((s === 'account_error' || s === 'init_error') && mode !== 'connect') {
			// SDK unavailable (not Premium / unsupported / blocked) — fall back.
			mode = 'connect';
			loadDevices();
		} else if (s === 'auth_error') {
			requiresReauth = true;
		}
	});

	// The browser tab is the device in SDK mode → no picker needed once ready.
	const showDeviceUi = $derived(mode === 'connect' && showDeviceSelector);
	const sdkConnecting = $derived(
		mode === 'sdk' && (player.status === 'idle' || player.status === 'loading')
	);

	// Fetch the current Spotify device list and reconcile the selected device.
	// iOS Spotify drops off Connect when backgrounded/paused, so the cached
	// deviceId can vanish — re-resolve it (keep current → active → fall back).
	// Returns true if a usable device is selected.
	async function loadDevices(): Promise<boolean> {
		try {
			const devicesResponse = await fetch('/api/spotify/devices');
			const data = await devicesResponse.json();

			// Check if re-authentication is required
			if (data.requiresReauth) {
				requiresReauth = true;
				return false;
			}

			availableDevices = data.devices || [];

			if (availableDevices.length === 0) {
				connectDeviceId = null;
				errorMessage =
					'Ingen Spotify-enheter funnet. Åpne Spotify på enheten og prøv igjen.';
				showDeviceSelector = true;
				return false;
			}

			// Keep current selection if it's still present
			const stillPresent =
				connectDeviceId && availableDevices.some((d) => d.id === connectDeviceId);

			if (stillPresent) {
				return true;
			}

			if (availableDevices.length === 1) {
				connectDeviceId = availableDevices[0].id;
				return true;
			}

			const activeDevice = availableDevices.find((d) => d.is_active);
			if (activeDevice) {
				connectDeviceId = activeDevice.id;
				return true;
			}

			// Multiple devices, none active — let the user pick
			connectDeviceId = null;
			showDeviceSelector = true;
			return false;
		} catch (error) {
			console.error('Failed to get devices:', error);
			errorMessage = 'Klarte ikke å hente Spotify-enheter. Prøv igjen.';
			return false;
		}
	}

	// Resolve the device to target for the current mode. In SDK mode that's the
	// browser tab itself; in connect mode it's a (re-resolved) external device.
	async function ensureDevice(): Promise<string | null> {
		if (mode === 'sdk') {
			// iOS suspends the tab on lock → device goes not_ready. Re-register it.
			if (player.status === 'not_ready') await player.reconnect();
			return player.status === 'ready' ? player.deviceId : null;
		}
		const ok = await loadDevices();
		return ok ? connectDeviceId : null;
	}

	async function getNextSong() {
		// Keep the screen awake (requested from the user gesture so it isn't denied).
		requestWakeLock();
		// iOS: unlock audio inside the user gesture. Await so the unlock completes
		// within the gesture before the async fetch/play that follows.
		if (mode === 'sdk') await player.activate();

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

	type PlayResult = 'ok' | 'reauth' | 'noDevice' | 'fail';

	// Issue a single play request. With trackId → start that track; without →
	// resume the current track on the device.
	async function sendPlay(deviceId: string, trackId?: string): Promise<PlayResult> {
		try {
			const res = await fetch('/api/spotify/player/play', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(trackId ? { trackId, deviceId } : { deviceId })
			});
			if (res.ok) return 'ok';
			const error = await res.json();
			if (error.requiresReauth) return 'reauth';
			if (error.noActiveDevice) return 'noDevice';
			return 'fail';
		} catch {
			return 'fail';
		}
	}

	async function playSong(trackId: string) {
		const targetDevice = await ensureDevice();
		if (requiresReauth) return;
		if (!targetDevice) {
			// No device: in connect mode show the picker; in SDK mode the player
			// isn't ready yet (rare) — surface a short message.
			if (mode === 'connect') showDeviceSelector = true;
			else errorMessage = 'Avspilling er ikke klar ennå. Prøv igjen.';
			return;
		}

		let result = await sendPlay(targetDevice, trackId);

		// SDK device can be dropped from Connect after an iOS suspend even though
		// it still reads ready. Re-register for a fresh device_id and retry once.
		if (result === 'noDevice' && mode === 'sdk') {
			const freshDevice = await player.recover();
			if (freshDevice) result = await sendPlay(freshDevice, trackId);
		}

		if (result === 'ok') {
			// In SDK mode the player_state_changed listener owns isPlaying.
			if (mode === 'connect') connectIsPlaying = true;
			errorMessage = '';
			return;
		}

		if (result === 'reauth') {
			requiresReauth = true;
			return;
		}

		if (result === 'noDevice') {
			if (mode === 'connect') {
				// External device vanished mid-game (typical on iOS app).
				connectDeviceId = null;
				errorMessage =
					'Spotify-enheten er ikke lenger tilgjengelig. Åpne Spotify på enheten igjen og velg den.';
				await loadDevices();
				showDeviceSelector = true;
			} else {
				errorMessage = 'Nettleser-avspilleren mistet tilkoblingen. Prøv igjen.';
			}
			return;
		}

		errorMessage = 'Avspilling feilet. Sjekk at Spotify er åpen på enheten.';
	}

	async function revealSong() {
		isRevealed = true;

		// Pause playback when revealing the song
		if (isPlaying) {
			try {
				const response = await fetch('/api/spotify/player/pause', {
					method: 'PUT'
				});

				// In SDK mode the player_state_changed listener owns isPlaying.
				if (response.ok && mode === 'connect') {
					connectIsPlaying = false;
				}
			} catch (error) {
				console.error('Failed to pause on reveal:', error);
			}
		}
	}

	async function togglePlayback() {
		// iOS: unlock audio inside the user gesture before any further await.
		if (mode === 'sdk') await player.activate();

		// Pause: simple — hits the currently active device (SDK device included).
		if (isPlaying) {
			try {
				const response = await fetch('/api/spotify/player/pause', {
					method: 'PUT'
				});
				if (response.ok) {
					if (mode === 'connect') connectIsPlaying = false;
				} else {
					const error = await response.json();
					errorMessage = error.error || 'Failed to control playback';
				}
			} catch {
				errorMessage = 'Failed to control playback';
			}
			return;
		}

		// Resume on the active device (re-resolved per mode).
		const targetDevice = await ensureDevice();
		if (requiresReauth) return;
		if (!targetDevice) {
			if (mode === 'connect') showDeviceSelector = true;
			else errorMessage = 'Avspilling er ikke klar ennå. Prøv igjen.';
			return;
		}

		let result = await sendPlay(targetDevice);

		// SDK device dropped after iOS suspend: re-register and restart the
		// current track on the fresh device (resume has nothing to resume there).
		if (result === 'noDevice' && mode === 'sdk') {
			const freshDevice = await player.recover();
			if (freshDevice && currentTrack) {
				result = await sendPlay(freshDevice, currentTrack.id);
			}
		}

		if (result === 'ok') {
			if (mode === 'connect') connectIsPlaying = true;
			errorMessage = '';
			return;
		}

		if (result === 'reauth') {
			requiresReauth = true;
			return;
		}

		if (result === 'noDevice') {
			if (mode === 'connect') {
				connectDeviceId = null;
				errorMessage =
					'Spotify-enheten er ikke lenger tilgjengelig. Åpne Spotify på enheten igjen og velg den.';
				await loadDevices();
				showDeviceSelector = true;
			} else {
				errorMessage = 'Nettleser-avspilleren mistet tilkoblingen. Prøv igjen.';
			}
			return;
		}

		errorMessage = 'Failed to control playback';
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
		player.disconnect();
		localStorage.removeItem('mixster_session_id');
		goto('/');
	}
</script>

<svelte:head>
	<title>Play - Mixster</title>
</svelte:head>

<div
	class="min-h-screen p-4 md:p-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-gray-950 relative"
>
	<!-- Decorative background gradient -->
	<div
		class="absolute inset-0 bg-linear-to-br from-purple-600/5 via-pink-500/5 to-orange-400/5 pointer-events-none"
	></div>

	<div class="max-w-2xl mx-auto space-y-6 relative z-10">
		<!-- Header -->
		<div class="flex items-center justify-center sm:justify-between">
			<div class="flex items-center gap-2">
				<h1
					class="text-3xl md:text-4xl font-bold bg-linear-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent"
					style="font-family: 'Monoton', sans-serif;"
				>
					mixster
				</h1>
				<!-- Always-visible reload: the only escape hatch in standalone PWA
				     mode, where there is no browser reload button. -->
				<Button
					variant="ghost"
					size="sm"
					onclick={() => location.reload()}
					title="Last inn på nytt"
					class="text-xl px-2"
				>
					↻
				</Button>
			</div>
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
			{:else if sdkConnecting}
				<div class="p-4 md:p-6 rounded-lg bg-card/50 space-y-2">
					<p class="text-base text-muted-foreground animate-pulse">
						Kobler til nettleser-avspilling…
					</p>
				</div>
			{:else if showDeviceUi && availableDevices.length > 0}
				<div class="p-4 md:p-6 rounded-lg bg-card/50 space-y-4">
					<p class="text-lg font-semibold">Velg en enhet:</p>
					<p class="text-xs text-muted-foreground">
						Nettleser-avspilling utilgjengelig — bruker tilkoblet enhet.
					</p>
					{#if errorMessage}
						<p class="text-sm text-destructive">{errorMessage}</p>
					{/if}
					<div class="space-y-2">
						{#each availableDevices as device (device.id)}
							<Button
								variant={connectDeviceId === device.id ? 'default' : 'outline'}
								class="w-full"
								onclick={() => {
									connectDeviceId = device.id;
									showDeviceSelector = false;
									errorMessage = '';
									// Resume the in-progress song on the newly picked device
									if (currentTrack && !isPlaying) {
										playSong(currentTrack.id);
									}
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
						disabled={loading || requiresReauth || sdkConnecting}
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
					{#if mode === 'sdk' && (player.needsGesture || needsResume)}
						<!-- iOS dropped/blocked audio after suspend — a gesture re-starts it -->
						<Button
							size="lg"
							onclick={tapToPlay}
							class="bg-linear-to-r text-white from-purple-600 via-pink-500 to-orange-400 font-bold mt-6 px-8 py-6 text-lg animate-pulse"
						>
							▶️ TRYKK FOR Å SPILLE
						</Button>
					{/if}

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
