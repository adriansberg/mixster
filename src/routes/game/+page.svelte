<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';

	let { data } = $props();

	async function handlePlayGame() {
		// Check if user has Spotify connected
		if (!data.hasSpotify) {
			// Redirect to Spotify login
			window.location.href = '/auth/login/spotify';
			return;
		}

		// Go to game setup
		goto('/game/setup');
	}
</script>

<div
	class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5"
>
	<div class="max-w-2xl w-full text-center space-y-8">
		<!-- Logo/Title -->
		<div class="space-y-4">
			<h1
				class="text-6xl md:text-8xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent"
			>
				🎵 Shitster
			</h1>
			<p class="text-xl md:text-2xl text-muted-foreground">
				A music timeline guessing game
			</p>
		</div>

		<!-- Description -->
		<div class="bg-card border rounded-lg p-6 md:p-8 space-y-4 text-left">
			<h2 class="text-2xl font-semibold">How to Play</h2>
			<ul class="space-y-3 text-muted-foreground">
				<li class="flex items-start gap-3">
					<span class="text-2xl">1️⃣</span>
					<span>A song plays without showing you the title or artist</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="text-2xl">2️⃣</span>
					<span
						>Guess when the song was released and place it on your timeline</span
					>
				</li>
				<li class="flex items-start gap-3">
					<span class="text-2xl">3️⃣</span>
					<span>Reveal the answer to see the year, artist, and title</span>
				</li>
				<li class="flex items-start gap-3">
					<span class="text-2xl">4️⃣</span>
					<span>Keep building your chronological timeline!</span>
				</li>
			</ul>
		</div>

		<!-- Requirements -->
		<div
			class="bg-muted/50 border border-muted rounded-lg p-4 text-sm text-muted-foreground"
		>
			<p>
				<strong>Requirements:</strong> Spotify Premium account for playback
			</p>
		</div>

		<!-- Action Buttons -->
		<div class="flex flex-col sm:flex-row gap-4 justify-center">
			<Button size="lg" class="text-lg px-8 py-6" onclick={handlePlayGame}>
				{#if data.hasSpotify}
					Start Game
				{:else}
					Connect Spotify & Play
				{/if}
			</Button>

			<Button
				variant="outline"
				size="lg"
				class="text-lg px-8 py-6"
				onclick={() => goto('/dashboard')}
			>
				Back to Dashboard
			</Button>
		</div>
	</div>
</div>
