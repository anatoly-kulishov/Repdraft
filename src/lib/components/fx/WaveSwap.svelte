<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';
	import { holdUnder, waveReveal } from './transitions';

	type Props = {
		/** Changing the key swaps panes through a wave front. */
		key: string | number;
		direction?: 'forward' | 'back';
		duration?: number;
		class?: string;
		children?: Snippet;
	};

	let { key, direction = 'forward', duration = 560, class: className = '', children }: Props =
		$props();
</script>

<div class={cn('fx-wave', className)}>
	{#key key}
		<div
			class="fx-wave__pane"
			in:waveReveal={{ direction, duration }}
			out:holdUnder={{ duration }}
		>
			{@render children?.()}
		</div>
	{/key}
</div>
