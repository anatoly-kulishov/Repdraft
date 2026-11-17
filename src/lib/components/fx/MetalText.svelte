<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';
	import { fxPauseOffscreen } from './motion';

	type Props = {
		tag?: 'span' | 'strong' | 'h1' | 'h2' | 'p';
		class?: string;
		children?: Snippet;
	};

	let { tag = 'span', class: className = '', children }: Props = $props();
</script>

<svelte:element this={tag} class={cn('fx-metal-text', className)} {@attach fxPauseOffscreen}>
	{@render children?.()}
</svelte:element>
