<script lang="ts">
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import { Button } from '$lib/components/ui/button';

	type User = {
		id: string;
		spotifyId: string;
		displayName: string | null;
		email: string | null;
		avatar: string | null;
	};

	let { data }: { data: { user: User } } = $props();
</script>

<div
	class="min-h-screen p-4 md:p-8 bg-linear-to-br from-purple-600/10 via-pink-500/10 to-orange-400/10 relative"
>
	<!-- Decorative background gradient -->
	<div
		class="absolute inset-0 bg-linear-to-br from-background/80 via-background/90 to-background pointer-events-none"
	></div>

	<div class="max-w-4xl mx-auto relative z-10">
		<div
			class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 gap-4"
		>
			<h1
				class="text-3xl md:text-4xl font-bold bg-linear-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent"
				style="font-family: 'Righteous', sans-serif;"
			>
				Dashboard
			</h1>
			<div class="flex gap-2 w-full sm:w-auto">
				<ThemeToggle />
				<form method="POST" action="/auth/logout" class="flex-1 sm:flex-none">
					<Button variant="outline" class="w-full sm:w-auto">Logg ut</Button>
				</form>
			</div>
		</div>

		<div
			class="bg-card/50 backdrop-blur-sm p-6 md:p-8 rounded-lg border space-y-4 shadow-lg"
		>
			<h2 class="text-xl md:text-2xl font-semibold mb-4">
				Velkommen, {data.user.displayName || 'der'}!
			</h2>
			<p class="text-muted-foreground text-sm md:text-base">
				Dette er dashboardet ditt. Velkommen til Shitster!
			</p>

			<div class="pt-4">
				<a href="/" class="block">
					<Button
						size="lg"
						class="w-full sm:w-auto text-base md:text-lg py-6 px-8 bg-linear-to-r from-purple-600 via-pink-500 to-orange-400 hover:shadow-xl transition-all hover:scale-105 active:scale-95 border-0 font-bold"
					>
						🎵 Spill Shitster
					</Button>
				</a>
			</div>
		</div>
	</div>
</div>
