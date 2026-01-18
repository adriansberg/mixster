<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let code = $state('');
	let isResending = $state(false);

	$effect(() => {
		if (form) {
			isResending = false;
		}
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-background px-4">
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<h1 class="text-3xl font-bold tracking-tight">Verify your email</h1>
			<p class="mt-2 text-muted-foreground">
				We've sent a verification code to <strong>{data.email}</strong>
			</p>
		</div>

		<div class="space-y-6">
			{#if form?.error}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{form.error}
				</div>
			{/if}

			{#if form?.success}
				<div
					class="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400"
				>
					{form.message}
				</div>
			{/if}

			<form method="POST" action="?/verify" class="space-y-4">
				<div class="space-y-2">
					<Label for="code">Verification Code</Label>
					<Input
						id="code"
						name="code"
						type="text"
						placeholder="Enter verification code"
						bind:value={code}
						required
						autocomplete="off"
					/>
				</div>

				<Button type="submit" class="w-full">Verify Email</Button>
			</form>

			<div class="text-center">
				<form
					method="POST"
					action="?/resend"
					onsubmit={() => (isResending = true)}
				>
					<Button
						type="submit"
						variant="link"
						class="text-sm"
						disabled={isResending}
					>
						{isResending ? 'Sending...' : "Didn't receive the code? Resend"}
					</Button>
				</form>
			</div>
		</div>
	</div>
</div>
