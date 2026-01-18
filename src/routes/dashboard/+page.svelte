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

<div class="min-h-screen p-8">
	<div class="max-w-4xl mx-auto">
		<div class="flex justify-between items-center mb-8">
			<h1 class="text-3xl font-bold">Dashboard</h1>
			<div class="flex gap-2">
				<ThemeToggle />
				<form method="POST" action="/auth/logout">
					<Button variant="outline">Log out</Button>
				</form>
			</div>
		</div>

		<div class="bg-card p-6 rounded-lg border space-y-4">
			<h2 class="text-xl font-semibold mb-4">
				Welcome, {data.user.displayName || 'there'}!
			</h2>
			<p class="text-muted-foreground">
				This is your dashboard. Welcome to Shitster!
			</p>

			<div class="pt-4">
				<a href="/">
					<Button size="lg" class="w-full sm:w-auto">
						🎵 Play Shitster Game
					</Button>
				</a>
			</div>
		</div>
	</div>
</div>
