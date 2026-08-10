<script lang="ts">
	import type { Component } from 'svelte';
	import { ICON_STROKE } from './sizes';

	let {
		icon,
		size = 20,
		strokeWidth = ICON_STROKE,
		fill = 'none',
		class: className = ''
	}: {
		icon: Component<{
			size?: number | string;
			strokeWidth?: number | string;
			fill?: string;
			class?: string;
		}>;
		size?: number;
		strokeWidth?: number;
		fill?: string;
		class?: string;
	} = $props();

	const Icon = $derived(icon);
</script>

<span class="lucide-icon-wrap {className}" aria-hidden="true">
	<Icon {size} {strokeWidth} {fill} />
</span>

<style>
	.lucide-icon-wrap {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		line-height: 0;
	}

	.lucide-icon-wrap :global(svg) {
		display: block;
	}
</style>
