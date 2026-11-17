<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { cn } from '$lib/utils.js';

	type Props = {
		src: string;
		alt?: string;
		width?: number | string;
		height?: number | string;
		class?: string;
	};

	let { src, alt = '', width, height, class: className = '' }: Props = $props();

	/** Src that finished loading; compared to `src` so a swap restarts the reveal. */
	let loadedSrc = $state<string | null>(null);
	const ready = $derived(loadedSrc === src);

	const cssSize = (v: number | string | undefined) =>
		v == null ? 'auto' : typeof v === 'number' ? `${v}px` : v;

	const style = $derived(
		width != null || height != null
			? `width:${cssSize(width)};height:${cssSize(height)}`
			: undefined
	);

	/** Cached images can finish before hydration attaches onload. */
	const catchCached: Attachment<HTMLImageElement> = (img) => {
		if (img.complete && img.naturalWidth > 0) loadedSrc = src;
	};
</script>

<div class={cn('fx-image', ready && 'is-ready', className)} {style}>
	<span class="fx-image__loader" aria-hidden="true"></span>
	<img
		class="fx-image__media"
		{src}
		{alt}
		loading="lazy"
		decoding="async"
		{@attach catchCached}
		onload={() => (loadedSrc = src)}
		onerror={() => (loadedSrc = src)}
	/>
</div>
