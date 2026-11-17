<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';
	import { fxPauseOffscreen } from './motion';

	type Props = {
		/** CSS radius of the wrapped control. Defaults to the button token. */
		radius?: string;
		class?: string;
		children?: Snippet;
	};

	let { radius, class: className = '', children }: Props = $props();
</script>

<div
	class={cn('fx-metal', className)}
	style={radius ? `--fx-metal-radius:${radius}` : undefined}
	{@attach fxPauseOffscreen}
>
	{@render children?.()}
	<span class="fx-metal__ring" aria-hidden="true"></span>
</div>
