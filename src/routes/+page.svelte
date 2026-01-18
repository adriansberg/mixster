<script lang="ts">
	import { cn } from '$lib/utils';

	const buttonStyles = {
		base: 'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
		variant: {
			default: 'bg-primary text-primary-foreground hover:bg-primary/90',
			outline:
				'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
			ghost: 'hover:bg-accent hover:text-accent-foreground'
		},
		size: {
			default: 'h-10 px-4 py-2',
			lg: 'h-11 rounded-md px-8'
		}
	};
</script>

<div class="min-h-screen bg-linear-to-b from-background to-muted/20">
	<!-- Header -->
	<header class="container mx-auto px-4 py-6">
		<nav class="flex justify-between items-center">
			<div class="text-2xl font-bold">Shitster</div>
			<div class="flex gap-4">
				<a
					href="/auth/login"
					class={cn(
						buttonStyles.base,
						buttonStyles.variant.ghost,
						buttonStyles.size.default
					)}
				>
					Sign In
				</a>
				<a
					href="/auth/signup"
					class={cn(
						buttonStyles.base,
						buttonStyles.variant.default,
						buttonStyles.size.default
					)}
				>
					Sign Up
				</a>
			</div>
		</nav>
	</header>

	<!-- Hero Section -->
	<main class="container mx-auto px-4 py-20">
		<div class="text-center max-w-3xl mx-auto">
			<h1
				class="text-5xl font-bold mb-6 bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent"
			>
				Welcome to Shitster
			</h1>
			<p class="text-xl text-muted-foreground mb-8">
				A modern, full-stack application with authentication, database, and
				beautiful UI components.
			</p>
			<div class="flex gap-4 justify-center">
				<a
					href="/auth/signup"
					class={cn(
						buttonStyles.base,
						buttonStyles.variant.default,
						buttonStyles.size.lg
					)}
				>
					Get Started
				</a>
				<a
					href="/dashboard"
					class={cn(
						buttonStyles.base,
						buttonStyles.variant.outline,
						buttonStyles.size.lg
					)}
				>
					View Dashboard
				</a>
			</div>
		</div>

		<!-- Features Grid -->
		<div class="mt-24 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
			<div class="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
				<div class="text-3xl mb-4">🔐</div>
				<h3 class="text-xl font-semibold mb-2">Authentication</h3>
				<p class="text-muted-foreground">
					Complete auth system with email verification, password reset, and
					session management.
				</p>
			</div>

			<div class="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
				<div class="text-3xl mb-4">🎨</div>
				<h3 class="text-xl font-semibold mb-2">Beautiful UI</h3>
				<p class="text-muted-foreground">
					Pre-built components with Tailwind CSS and dark mode support out of
					the box.
				</p>
			</div>

			<div class="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
				<div class="text-3xl mb-4">⚡</div>
				<h3 class="text-xl font-semibold mb-2">Modern Stack</h3>
				<p class="text-muted-foreground">
					Built with SvelteKit, TypeScript, Drizzle ORM, and PostgreSQL for
					maximum performance.
				</p>
			</div>
		</div>

		<!-- CTA Section -->
		<div class="mt-24 text-center p-12 rounded-lg border bg-card">
			<h2 class="text-3xl font-bold mb-4">Ready to build something amazing?</h2>
			<p class="text-muted-foreground mb-6">
				Sign up now and start building your next project with everything you
				need.
			</p>
			<a
				href="/auth/signup"
				class={cn(
					buttonStyles.base,
					buttonStyles.variant.default,
					buttonStyles.size.lg
				)}
			>
				Create Your Account
			</a>
		</div>
	</main>

	<!-- Footer -->
	<footer class="container mx-auto px-4 py-8 mt-20 border-t">
		<div class="text-center text-sm text-muted-foreground">
			<p>Built with SvelteKit • Ready to customize for your needs</p>
		</div>
	</footer>
</div>
