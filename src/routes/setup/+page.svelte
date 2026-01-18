<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { goto } from '$app/navigation';
	import { nanoid } from 'nanoid';

	let { data } = $props();

	let selectedDefaults = $state<string[]>([]);
	let customPlaylists = $state<
		Array<{ id: string; name: string; uri: string }>
	>([]);
	let playlistInput = $state('');
	let addingPlaylist = $state(false);
	let errorMessage = $state('');

	const decades = data.defaultPlaylists.filter((p) => p.category === 'decade');
	const genres = data.defaultPlaylists.filter((p) => p.category === 'genre');

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
				uri: result.uri
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

			<!-- Decades -->
			<div class="space-y-2">
				<h3 class="font-medium">By Decade</h3>
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
					{#each decades as playlist (playlist.id)}
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

			<!-- Genres -->
			<div class="space-y-2">
				<h3 class="font-medium">By Genre</h3>
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
					{#each genres as playlist (playlist.id)}
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
		</div>

		<!-- Custom Playlists -->
		<div class="space-y-4">
			<div>
				<h2 class="text-2xl font-semibold mb-2">Custom Playlists</h2>
				<p class="text-sm text-muted-foreground">
					Add your own Spotify playlists
				</p>
			</div>

			<div class="space-y-2">
				<Label for="playlist-input">Spotify Playlist URI or URL</Label>
				<div class="flex gap-2">
					<Input
						id="playlist-input"
						bind:value={playlistInput}
						placeholder="spotify:playlist:... or https://open.spotify.com/playlist/..."
						class="flex-1"
					/>
					<Button
						onclick={addCustomPlaylist}
						disabled={addingPlaylist || !playlistInput.trim()}
					>
						{addingPlaylist ? 'Adding...' : 'Add'}
					</Button>
				</div>
				{#if errorMessage}
					<p class="text-sm text-destructive">{errorMessage}</p>
				{/if}
			</div>

			{#if customPlaylists.length > 0}
				<div class="space-y-2">
					{#each customPlaylists as playlist (playlist.id)}
						<div
							class="flex items-center justify-between p-3 rounded-lg border bg-card"
						>
							<span class="font-medium">{playlist.name}</span>
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
		<div class="pt-4">
			<Button size="lg" class="w-full text-lg" onclick={startGame}>
				Start Playing
			</Button>
		</div>
	</div>
</div>
