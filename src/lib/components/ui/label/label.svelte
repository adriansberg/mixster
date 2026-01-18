<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLLabelAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = HTMLLabelAttributes & {
		required?: boolean;
		children?: Snippet;
	};

	const {
		class: className,
		required = false,
		children,
		...restProps
	}: Props = $props();
</script>

<label
	class={cn(
		'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
		className
	)}
	{...restProps}
>
	{@render children?.()}
	{#if required}
		<span class="text-destructive ml-1">*</span>
	{/if}
</label>
