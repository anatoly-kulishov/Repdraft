<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';
	import { fxPauseOffscreen } from './motion';

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className = '', children }: Props = $props();
</script>

<span class={cn('fx-metal-badge', className)} {@attach fxPauseOffscreen}>
	<span class="fx-metal-badge__label">{@render children?.()}</span>
</span>
