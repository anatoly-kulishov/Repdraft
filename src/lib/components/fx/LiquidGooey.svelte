<script lang="ts">
	import type { Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import { cn } from '$lib/utils.js';

	type Props = {
		/** Index of the active item in the slot row. */
		activeIndex?: number;
		class?: string;
		children?: Snippet;
	};

	let { activeIndex = 0, class: className = '', children }: Props = $props();
	const uid = $props.id();
	const filterId = `${uid}-gooey`;

	let rootEl: HTMLDivElement | null = $state(null);
	let pill = $state({ x: 0, y: 0, w: 0, h: 0, ready: false });

	async function measure() {
		if (!browser || !rootEl) return;
		await tick();
		const items = rootEl.querySelectorAll<HTMLElement>('[data-fx-gooey-item]');
		const el = items[activeIndex] ?? items[0];
		if (!el) return;
		const parent = rootEl.getBoundingClientRect();
		const box = el.getBoundingClientRect();
		pill = {
			x: box.left - parent.left,
			y: box.top - parent.top,
			w: box.width,
			h: box.height,
			ready: true
		};
	}

	$effect(() => {
		activeIndex;
		void measure();
	});

	onMount(() => {
		void measure();
		const onResize = () => void measure();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});
</script>

<div class={cn('fx-gooey', className)} bind:this={rootEl}>
	<svg class="fx-gooey__svg" aria-hidden="true" focusable="false">
		<defs>
			<filter id={filterId}>
				<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
				<feColorMatrix
					in="blur"
					mode="matrix"
					values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
					result="goo"
				/>
				<feComposite in="SourceGraphic" in2="goo" operator="atop" />
			</filter>
		</defs>
	</svg>
	<div class="fx-gooey__layer" style={`filter:url(#${filterId})`} aria-hidden="true">
		{#if pill.ready}
			<span
				class="fx-gooey__pill"
				style={`transform:translate(${pill.x}px, ${pill.y}px);width:${pill.w}px;height:${pill.h}px`}
			></span>
		{/if}
	</div>
	<div class="fx-gooey__items">
		{@render children?.()}
	</div>
</div>
