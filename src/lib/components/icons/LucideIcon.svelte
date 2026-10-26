<script lang="ts">
	import type { IconComponentProps, IconWeight } from 'phosphor-svelte';
	import type { Component } from 'svelte';
	import { ICON_STROKE } from './sizes';

	let {
		icon,
		size = 20,
		strokeWidth = ICON_STROKE,
		fill = 'none',
		weight: explicitWeight,
		class: className = ''
	}: {
		icon: Component<IconComponentProps>;
		size?: number;
		/** Kept for call-site compatibility; mapped to the closest Phosphor weight. */
		strokeWidth?: number;
		/** `currentColor` renders the filled glyph (bookmarks, ratings). */
		fill?: string;
		/** Explicit Phosphor weight for decorative/feature icons. */
		weight?: IconWeight;
		class?: string;
	} = $props();

	const Icon = $derived(icon);
	let weight = $derived<IconWeight>(
		explicitWeight ?? (fill !== 'none' ? 'fill' : strokeWidth >= 2 ? 'bold' : 'regular')
	);
</script>

<span class="lucide-icon-wrap {className}" aria-hidden="true">
	<Icon {size} {weight} />
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
