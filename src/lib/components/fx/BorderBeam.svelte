<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	type Mode = 'spin' | 'pulse';

	type Props = {
		mode?: Mode;
		class?: string;
		contentClass?: string;
		/** Solid plate under the beam ring (matches panel / CTA). */
		fill?: string;
		children?: Snippet;
	};

	let {
		mode = 'spin',
		class: className = '',
		contentClass = '',
		fill,
		children
	}: Props = $props();
</script>

<div
	class={cn('fx-beam', mode === 'pulse' && 'fx-beam--pulse', className)}
	style={fill ? `--fx-beam-fill: ${fill}` : undefined}
>
	{#if mode === 'spin'}
		<span class="fx-beam__ring" aria-hidden="true"></span>
		<span class="fx-beam__fill" aria-hidden="true"></span>
	{:else}
		<span class="fx-beam__ring" aria-hidden="true"></span>
	{/if}
	<div class={cn('fx-beam__content', contentClass)}>
		{@render children?.()}
	</div>
</div>
