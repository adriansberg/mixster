<script lang="ts">
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import { Button } from '$lib/components/ui/button';

	type User = {
		id: string;
		email: string;
		name: string | null;
		emailVerified: boolean;
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

		<div class="bg-card p-6 rounded-lg border">
			<h2 class="text-xl font-semibold mb-4">
				Welcome, {data.user.name || data.user.email}!
			</h2>
			<p class="text-muted-foreground">
				This is your dashboard. Welcome to Shitster!
			</p>

			{#if !data.user.emailVerified}
				<div
					class="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded"
				>
					<p class="text-sm text-yellow-800 dark:text-yellow-200">
						Please verify your email address. Check your inbox for the
						verification code.
					</p>
					<a
						href="/auth/verify-email"
						class="text-sm text-primary hover:underline mt-2 inline-block"
					>
						Enter verification code →
					</a>
				</div>
			{/if}
		</div>
	</div>
</div>
