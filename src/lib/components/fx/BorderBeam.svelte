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
		/** 0..1 alpha of the effect layers only; the host and its children stay opaque. */
		strength?: number;
		class?: string;
		children?: Snippet;
	};

	let { size = 'md', duration, strength, class: className = '', children }: Props = $props();

	const styleVars = $derived(
		[
			duration !== undefined ? `--fx-beam-duration:${duration}s` : '',
			strength !== undefined ? `--fx-beam-strength:${strength}` : ''
		]
			.filter(Boolean)
			.join(';') || undefined
	);
</script>

<div
	class={cn('fx-beam', `fx-beam--${size}`, className)}
	style={styleVars}
	{@attach fxPauseOffscreen}
>
	{@render children?.()}
	<span class="fx-beam__ring" aria-hidden="true"></span>
</div>
