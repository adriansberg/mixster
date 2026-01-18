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

<div class="min-h-screen p-4 md:p-8">
	<div class="max-w-4xl mx-auto space-y-6">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<h1 class="text-3xl font-bold">Game Setup</h1>
			<Button variant="outline" onclick={() => goto('/')}>Back</Button>
		</div>

		<!-- Default Playlists -->
		<div class="space-y-4">
			<div>
				<h2 class="text-2xl font-semibold mb-2">Default Playlists</h2>
				<p class="text-sm text-muted-foreground">
					Select which curated playlists to include
				</p>
			</div>

			<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
				{#each data.defaultPlaylists as playlist (playlist.id)}
					<button
						class="p-3 rounded-lg border transition-colors {selectedDefaults.includes(
							playlist.id
						)
							? 'bg-primary text-primary-foreground border-primary'
							: 'bg-card hover:bg-accent'}"
						onclick={() => toggleDefault(playlist.id)}
					>
						<div class="font-medium text-sm">{playlist.name}</div>
					</button>
				{/each}
			</div>
		</div>

		<!-- Custom Playlists -->
		<div class="space-y-4">
			<div>
				<h2 class="text-2xl font-semibold mb-2">Custom Playlists</h2>
				<p class="text-sm text-muted-foreground">
					Add your own Spotify playlists
				</p>
			</div>

			<form
				class="space-y-2"
				onsubmit={(e) => {
					e.preventDefault();
					addCustomPlaylist();
				}}
			>
				<Label for="playlist-input">Spotify Playlist URI or URL</Label>
				<div class="flex gap-2">
					<Input
						id="playlist-input"
						bind:value={playlistInput}
						placeholder="spotify:playlist:... or https://open.spotify.com/playlist/..."
						class="flex-1"
					/>
					<Button
						type="submit"
						disabled={addingPlaylist || !playlistInput.trim()}
					>
						{addingPlaylist ? 'Adding...' : 'Add'}
					</Button>
				</div>
				{#if errorMessage}
					<p class="text-sm text-destructive">{errorMessage}</p>
				{/if}
			</form>

			{#if customPlaylists.length > 0}
				<div class="space-y-2">
					{#each customPlaylists as playlist (playlist.id)}
						<div
							class="flex items-center justify-between p-3 rounded-lg border bg-card"
						>
							<div class="flex flex-col">
								<span class="font-medium">{playlist.name}</span>
								<span class="text-xs text-muted-foreground">
									{playlist.trackCount}
									{playlist.trackCount === 1 ? 'song' : 'songs'}
								</span>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onclick={() => removePlaylist(playlist.id)}
							>
								Remove
							</Button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-muted-foreground italic">
					No custom playlists added yet
				</p>
			{/if}
		</div>

		<!-- Start Button -->
		<div class="pt-4 space-y-3">
			{#if totalSelectedPlaylists > 0}
				<div class="text-center text-sm text-muted-foreground">
					{#if loadingTrackCounts}
						<p>
							{totalSelectedPlaylists} playlist{totalSelectedPlaylists === 1
								? ''
								: 's'} selected • Loading track counts...
						</p>
					{:else}
						<p>
							{totalSelectedPlaylists} playlist{totalSelectedPlaylists === 1
								? ''
								: 's'} selected
							{#if totalSongs > 0}
								• {totalSongs.toLocaleString()} total song{totalSongs === 1
									? ''
									: 's'}
							{/if}
						</p>
					{/if}
				</div>
			{/if}
			<Button size="lg" class="w-full text-lg" onclick={startGame}>
				Start Playing
			</Button>
		</div>
	</div>
</div>
