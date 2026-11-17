<script lang="ts">
	import { cn } from '$lib/utils.js';

	type Props = {
		src: string;
		alt?: string;
		width?: number | string;
		height?: number | string;
		class?: string;
	};

	let { src, alt = '', width, height, class: className = '' }: Props = $props();
	let ready = $state(false);

	$effect(() => {
		src;
		ready = false;
	});
</script>

<div
	class={cn('fx-image', ready && 'is-ready', className)}
	style={width != null || height != null
		? `width:${typeof width === 'number' ? `${width}px` : (width ?? 'auto')};height:${typeof height === 'number' ? `${height}px` : (height ?? 'auto')}`
		: undefined}
>
	<span class="fx-image__loader" aria-hidden="true"></span>
	<img
		class="fx-image__media"
		{src}
		{alt}
		loading="lazy"
		decoding="async"
		onload={() => {
			ready = true;
		}}
		onerror={() => {
			ready = true;
		}}
	/>
</div>
