<script lang="ts">
	import { Moon, Sun } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { theme } from '$lib/stores/theme';
	import { onMount } from 'svelte';

	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});
</script>

<div
	class="transition-opacity duration-500"
	class:opacity-0={!mounted}
	class:opacity-100={mounted}
>
	<Button
		variant="ghost"
		size="icon"
		onclick={() => theme.toggle()}
		aria-label="Toggle theme"
	>
		{#if $theme === 'dark'}
			<Sun class="h-5 w-5" />
		{:else}
			<Moon class="h-5 w-5" />
		{/if}
	</Button>
</div>
