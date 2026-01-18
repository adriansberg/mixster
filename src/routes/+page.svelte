<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade, fly, scale } from 'svelte/transition';
	import { elasticOut } from 'svelte/easing';

	// Generate random background circles
	const circles = Array.from({ length: 20 }, (_, i) => ({
		id: i,
		width: Math.random() * 100 + 50,
		height: Math.random() * 100 + 50,
		left: Math.random() * 100,
		top: Math.random() * 100,
		duration: Math.random() * 3 + 2,
		delay: Math.random() * 2
	}));
</script>

<div
	class="min-h-screen flex items-center justify-center bg-linear-to-br from-purple-600 via-pink-500 to-orange-400 overflow-hidden relative"
>
	<!-- Animated background elements -->
	<div class="absolute inset-0 overflow-hidden">
		{#each circles as circle (circle.id)}
			<div
				class="absolute rounded-full bg-white/10 animate-float"
				style="width: {circle.width}px; height: {circle.height}px; left: {circle.left}%; top: {circle.top}%; animation-duration: {circle.duration}s; animation-delay: {circle.delay}s;"
			></div>
		{/each}
	</div>

	<!-- Main content -->
	<div
		class="relative z-10 flex flex-col items-center gap-6 md:gap-8 px-4 max-w-7xl mx-auto"
	>
		<!-- Music icon decoration -->
		<div
			in:scale={{ duration: 800, easing: elasticOut, start: 0 }}
			class="relative"
		>
			<div
				class="absolute inset-0 bg-yellow-300 rounded-full blur-3xl opacity-50"
			></div>
			<div
				class="relative bg-white/20 backdrop-blur-sm rounded-full p-4 md:p-8 border-2 md:border-4 border-white/30"
			>
				<svg
					class="w-12 h-12 md:w-20 md:h-20 text-white"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</div>
		</div>

		<!-- Logo text with neon font -->
		<div in:fly={{ y: 50, duration: 800, delay: 300 }} class="text-center">
			<h1
				class="text-5xl sm:text-7xl md:text-8xl lg:text-9xl text-white mb-2 tracking-tight drop-shadow-2xl px-4"
				style="font-family: 'Monoton', cursive; text-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2), 0 0 40px rgba(255,255,255,0.5); letter-spacing: 0.05em;"
			>
				SHITSTER
			</h1>
			<div
				class="h-1.5 md:h-2 bg-yellow-300 rounded-full mx-auto w-48 sm:w-56 md:w-64 shadow-lg animate-scale-x"
				style="animation-delay: 600ms;"
			></div>
		</div>

		<!-- Tagline -->
		<p
			in:fade={{ duration: 800, delay: 900 }}
			class="text-lg sm:text-xl md:text-2xl lg:text-3xl text-white/95 font-bold tracking-wide drop-shadow-lg px-4 text-center"
			style="font-family: 'Righteous', sans-serif;"
		>
			The Music Card Game
		</p>

		<!-- Play button -->
		<button
			in:fly={{ y: 30, duration: 800, delay: 1200 }}
			onclick={() => goto('/setup')}
			class="mt-4 md:mt-8 px-8 md:px-12 py-4 md:py-5 bg-white text-purple-600 rounded-full font-black text-base md:text-xl shadow-2xl hover:shadow-3xl transition-all flex items-center gap-2 md:gap-3 group hover:scale-105 active:scale-95"
		>
			<svg
				class="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform"
				fill="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M8 5v14l11-7z" />
			</svg>
			START GAME
		</button>

		<!-- Decorative sparkles -->
		<div
			class="absolute top-1/4 left-4 md:left-1/4 hidden sm:block animate-spin-sparkle"
		>
			<svg
				class="w-8 h-8 md:w-12 md:h-12 text-yellow-300"
				fill="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M9.813 3.875c.385-1.17 2.029-1.17 2.414 0l.76 2.303a3 3 0 0 0 2.835 2.082h2.362c1.19 0 1.685 1.522.726 2.235l-1.91 1.423a3 3 0 0 0-1.055 3.269l.76 2.303c.385 1.17-.962 2.14-1.977 1.425l-1.91-1.423a3 3 0 0 0-3.658 0l-1.91 1.423c-1.015.715-2.362-.255-1.977-1.425l.76-2.303a3 3 0 0 0-1.055-3.269l-1.91-1.423c-.959-.713-.464-2.235.726-2.235h2.362a3 3 0 0 0 2.835-2.082l.76-2.303Z"
				/>
			</svg>
		</div>

		<div
			class="absolute bottom-1/4 right-4 md:right-1/4 hidden sm:block animate-spin-sparkle-reverse"
			style="animation-delay: 1s;"
		>
			<svg
				class="w-6 h-6 md:w-10 md:h-10 text-pink-300"
				fill="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M9.813 3.875c.385-1.17 2.029-1.17 2.414 0l.76 2.303a3 3 0 0 0 2.835 2.082h2.362c1.19 0 1.685 1.522.726 2.235l-1.91 1.423a3 3 0 0 0-1.055 3.269l.76 2.303c.385 1.17-.962 2.14-1.977 1.425l-1.91-1.423a3 3 0 0 0-3.658 0l-1.91 1.423c-1.015.715-2.362-.255-1.977-1.425l.76-2.303a3 3 0 0 0-1.055-3.269l-1.91-1.423c-.959-.713-.464-2.235.726-2.235h2.362a3 3 0 0 0 2.835-2.082l.76-2.303Z"
				/>
			</svg>
		</div>
	</div>

	<!-- Bottom decoration -->
	<div
		in:fly={{ y: 100, duration: 800, delay: 1400 }}
		class="absolute bottom-6 md:bottom-8 text-white/70 text-xs sm:text-sm tracking-wider px-4 text-center"
	>
		GUESS THE YEAR • MAKE A TIMELINE • WIN!
	</div>
</div>
