<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';
	import { fxPauseOffscreen } from './motion';

	/** Rotate family travels along the edge; pulse family breathes in place. */
	type BeamSize = 'md' | 'sm' | 'line' | 'pulse-inner' | 'pulse-outside';

	type Props = {
		size?: BeamSize;
		/** Seconds per lap (rotate) or per breath (pulse). */
		duration?: number;
		class?: string;
		children?: Snippet;
	};

	let { size = 'md', duration, class: className = '', children }: Props = $props();
</script>

<div
	class={cn('fx-beam', `fx-beam--${size}`, className)}
	style={duration ? `--fx-beam-duration:${duration}s` : undefined}
	{@attach fxPauseOffscreen}
>
	{@render children?.()}
	<span class="fx-beam__ring" aria-hidden="true"></span>
</div>
