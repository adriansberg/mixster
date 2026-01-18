<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	type FormData = {
		email?: string;
		name?: string;
		error?: string;
	};

	let { form }: { form: FormData | null | undefined } = $props();
</script>

<div class="min-h-screen flex items-center justify-center p-4">
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<h1 class="text-3xl font-bold">Create an account</h1>
			<p class="text-muted-foreground mt-2">
				Enter your details to get started
			</p>
		</div>

		<form method="POST" class="space-y-6">
			<div class="space-y-2">
				<Label for="email" required>Email</Label>
				<Input
					id="email"
					name="email"
					type="email"
					placeholder="you@example.com"
					required
					value={form?.email ?? ''}
				/>
			</div>

			<div class="space-y-2">
				<Label for="name">Name</Label>
				<Input
					id="name"
					name="name"
					type="text"
					placeholder="Your name"
					value={form?.name ?? ''}
				/>
			</div>

			<div class="space-y-2">
				<Label for="password" required>Password</Label>
				<Input
					id="password"
					name="password"
					type="password"
					placeholder="••••••••"
					required
				/>
			</div>

			<div class="space-y-2">
				<Label for="confirmPassword" required>Confirm Password</Label>
				<Input
					id="confirmPassword"
					name="confirmPassword"
					type="password"
					placeholder="••••••••"
					required
				/>
			</div>

			{#if form?.error}
				<p class="text-sm text-destructive">{form.error}</p>
			{/if}

			<Button type="submit" class="w-full">Sign up</Button>
		</form>

		<p class="text-center text-sm text-muted-foreground">
			Already have an account?
			<a href="/auth/login" class="text-primary hover:underline">Log in</a>
		</p>
	</div>
</div>
