<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { goto } from '$app/navigation';
	import { nanoid } from 'nanoid';
	import { onMount } from 'svelte';

	let { data } = $props();

	let selectedDefaults = $state<string[]>(
		data.defaultPlaylists.map((p) => p.id)
	);
	let customPlaylists = $state<
		Array<{ id: string; name: string; uri: string; trackCount: number }>
	>([]);
	let playlistInput = $state('');
	let addingPlaylist = $state(false);
	let errorMessage = $state('');
	let defaultTrackCounts = $state<Record<string, number>>({});
	let loadingTrackCounts = $state(true);

	// Calculate total songs from selected playlists
	const totalCustomSongs = $derived(
		customPlaylists.reduce((sum, p) => sum + p.trackCount, 0)
	);
	const totalDefaultSongs = $derived(
		selectedDefaults.reduce((sum, id) => {
			const playlist = data.defaultPlaylists.find((p) => p.id === id);
			if (playlist) {
				return sum + (defaultTrackCounts[playlist.spotifyUri] || 0);
			}
			return sum;
		}, 0)
	);
	const totalSongs = $derived(totalCustomSongs + totalDefaultSongs);
	const totalSelectedPlaylists = $derived(
		selectedDefaults.length + customPlaylists.length
	);

	// Load custom playlists from localStorage on mount
	if (typeof window !== 'undefined') {
		const stored = localStorage.getItem('shitster_custom_playlists');
		if (stored) {
			try {
				customPlaylists = JSON.parse(stored);
			} catch {
				// Ignore parse errors
			}
		}
	}

	onMount(async () => {
		// Check cache first
		const cached = localStorage.getItem('shitster_default_track_counts');
		const cacheTimestamp = localStorage.getItem(
			'shitster_default_track_counts_timestamp'
		);

		// Use cache if less than 24 hours old
		if (
			cached &&
			cacheTimestamp &&
			Date.now() - parseInt(cacheTimestamp) < 24 * 60 * 60 * 1000
		) {
			try {
				defaultTrackCounts = JSON.parse(cached);
				loadingTrackCounts = false;
				return;
			} catch {
				// Fall through to fetch
			}
		}

		// Fetch track counts
		try {
			const playlistUris = data.defaultPlaylists.map((p) => p.spotifyUri);
			const response = await fetch('/api/spotify/playlists/track-counts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playlistUris })
			});

			if (response.ok) {
				const result = await response.json();
				defaultTrackCounts = result.trackCounts;

				// Cache the results
				localStorage.setItem(
					'shitster_default_track_counts',
					JSON.stringify(defaultTrackCounts)
				);
				localStorage.setItem(
					'shitster_default_track_counts_timestamp',
					Date.now().toString()
				);
			}
		} catch (error) {
			console.error('Failed to fetch track counts:', error);
		} finally {
			loadingTrackCounts = false;
		}
	});

	function toggleDefault(id: string) {
		if (selectedDefaults.includes(id)) {
			selectedDefaults = selectedDefaults.filter((x) => x !== id);
		} else {
			selectedDefaults = [...selectedDefaults, id];
		}
	}

	async function addCustomPlaylist() {
		if (!playlistInput.trim()) return;

		errorMessage = '';
		addingPlaylist = true;

		try {
			const response = await fetch('/api/spotify/playlist/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playlistInput: playlistInput.trim() })
			});

			const result = await response.json();

			if (!response.ok) {
				errorMessage = result.error || 'Failed to add playlist';
				return;
			}

			// Add to localStorage
			const newPlaylist = {
				id: nanoid(),
				name: result.name,
				uri: result.uri,
				trackCount: result.trackCount || 0
			};
			customPlaylists = [...customPlaylists, newPlaylist];
			localStorage.setItem(
				'shitster_custom_playlists',
				JSON.stringify(customPlaylists)
			);
			playlistInput = '';
		} catch {
			errorMessage = 'Failed to add playlist';
		} finally {
			addingPlaylist = false;
		}
	}

	function removePlaylist(playlistId: string) {
		customPlaylists = customPlaylists.filter((p) => p.id !== playlistId);
		localStorage.setItem(
			'shitster_custom_playlists',
			JSON.stringify(customPlaylists)
		);
	}

	function startGame() {
		const totalSelected = selectedDefaults.length + customPlaylists.length;

		if (totalSelected === 0) {
			errorMessage = 'Please select at least one playlist';
			return;
		}

		// Check if user is authenticated
		if (!data.isAuthenticated) {
			// Save session data before redirecting to login
			const sessionId = nanoid();
			localStorage.setItem('shitster_session_id', sessionId);
			localStorage.setItem(
				'shitster_selected_defaults',
				JSON.stringify(selectedDefaults)
			);
			localStorage.setItem(
				'shitster_custom_playlists',
				JSON.stringify(customPlaylists)
			);
			// Redirect to Spotify login
			goto('/auth/login/spotify');
			return;
		}

		const sessionId = nanoid();
		localStorage.setItem('shitster_session_id', sessionId);
		localStorage.setItem(
			'shitster_selected_defaults',
			JSON.stringify(selectedDefaults)
		);
		localStorage.setItem(
			'shitster_custom_playlists',
			JSON.stringify(customPlaylists)
		);

		goto('/play');
	}
</script>

<div
	class="min-h-screen p-4 md:p-8 bg-linear-to-br from-purple-600/10 via-pink-500/10 to-orange-400/10 relative"
>
	<!-- Decorative background gradient -->
	<div
		class="absolute inset-0 bg-linear-to-br from-background/80 via-background/90 to-background pointer-events-none"
	></div>

	<div class="max-w-4xl mx-auto space-y-6 relative z-10">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<h1
				class="text-3xl md:text-4xl font-bold bg-linear-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent"
				style="font-family: 'Righteous', sans-serif;"
			>
				Spilloppsett
			</h1>
			<Button variant="outline" onclick={() => goto('/')}>Tilbake</Button>
		</div>

		<!-- Default Playlists -->
		<div class="space-y-4">
			<div
				class="bg-card/50 backdrop-blur-sm rounded-lg p-4 md:p-6 border shadow-lg"
			>
				<h2 class="text-xl md:text-2xl font-semibold mb-2">
					Standard spillelister
				</h2>
				<p class="text-sm text-muted-foreground mb-4">
					Velg hvilke spillelister som skal inkluderes
				</p>

				<div
					class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3"
				>
					{#each data.defaultPlaylists as playlist (playlist.id)}
						<button
							class="p-3 md:p-4 rounded-lg border transition-all hover:scale-105 active:scale-95 {selectedDefaults.includes(
								playlist.id
							)
								? 'bg-linear-to-br from-purple-600 to-pink-500 text-white border-purple-400 shadow-lg'
								: 'bg-card hover:bg-accent'}"
							onclick={() => toggleDefault(playlist.id)}
						>
							<div class="font-medium text-sm md:text-base">
								{playlist.name}
							</div>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Custom Playlists -->
		<div class="space-y-4">
			<div
				class="bg-card/50 backdrop-blur-sm rounded-lg p-4 md:p-6 border shadow-lg"
			>
				<h2 class="text-xl md:text-2xl font-semibold mb-2">
					Egne spillelister
				</h2>
				<p class="text-sm text-muted-foreground mb-4">
					Legg til dine egne Spotify-spillelister
				</p>

				<form
					class="space-y-2"
					onsubmit={(e) => {
						e.preventDefault();
						addCustomPlaylist();
					}}
				>
					<Label for="playlist-input">Spotify-spilleliste URL</Label>
					<div class="flex flex-col sm:flex-row gap-2 mt-2">
						<Input
							id="playlist-input"
							bind:value={playlistInput}
							placeholder="https://open.spotify.com/playlist/..."
							class="flex-1"
						/>
						<Button
							type="submit"
							disabled={addingPlaylist || !playlistInput.trim()}
							class="w-full sm:w-auto"
						>
							{addingPlaylist ? 'Legger til...' : 'Legg til'}
						</Button>
					</div>
					{#if errorMessage}
						<p class="text-sm text-destructive">{errorMessage}</p>
					{/if}
				</form>

				{#if customPlaylists.length > 0}
					<div class="space-y-2 mt-4">
						{#each customPlaylists as playlist (playlist.id)}
							<div
								class="flex items-center justify-between p-3 rounded-lg border bg-card/80 hover:bg-card transition-colors"
							>
								<div class="flex flex-col min-w-0 flex-1 mr-2">
									<span class="font-medium truncate">{playlist.name}</span>
									<span class="text-xs text-muted-foreground">
										{playlist.trackCount}
										{playlist.trackCount === 1 ? 'sang' : 'sanger'}
									</span>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onclick={() => removePlaylist(playlist.id)}
								>
									Fjern
								</Button>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-muted-foreground italic mt-4">
						Ingen egne spillelister lagt til ennå
					</p>
				{/if}
			</div>
		</div>

		<!-- Start Button -->
		<div class="pt-4 space-y-3">
			{#if totalSelectedPlaylists > 0}
				<div
					class="text-center text-sm md:text-base text-muted-foreground bg-card/30 backdrop-blur-sm rounded-lg p-3 border"
				>
					<span>
						{totalSelectedPlaylists} spilleliste{totalSelectedPlaylists === 1
							? ''
							: 'r'} valgt
					</span>
					{#if loadingTrackCounts}
						<span> • Laster antall sanger... </span>
					{:else if totalSongs > 0}
						<span> • {totalSongs.toLocaleString()} sanger totalt</span>
					{/if}
				</div>
			{/if}
			<Button
				size="lg"
				class="w-full text-xl text-white md:text-lg py-6 bg-linear-to-r from-purple-600 via-pink-500 to-orange-400 hover:shadow-xl transition-all hover:scale-105 active:scale-95 border-0 font-bold"
				style="font-family: 'Righteous', sans-serif;"
				onclick={startGame}
			>
				START SPILL
			</Button>
		</div>
	</div>
</div>
