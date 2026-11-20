<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount, tick } from 'svelte';
	import { cn } from '$lib/utils.js';
	import { tweenBox, type FxBox } from './motion';

	type Props = {
		/** Index of the active `[data-fx-gooey-item]`. Use `-1` to hide the blob. */
		activeIndex?: number;
		class?: string;
		/** Class on the items row (e.g. existing chip strip). */
		itemsClass?: string;
		children?: Snippet;
	};

	let {
		activeIndex = 0,
		class: className = '',
		itemsClass = '',
		children
	}: Props = $props();
	const uid = $props.id();
	const filterId = `${uid}-goo`;

	let rootEl: HTMLDivElement | null = $state(null);
	let lead = $state<FxBox | null>(null);
	let trail = $state<FxBox | null>(null);
	let cancelLead = () => {};
	let cancelTrail = () => {};

	function targetBox(): FxBox | null {
		if (!rootEl || activeIndex < 0) return null;
		const items = rootEl.querySelectorAll<HTMLElement>('[data-fx-gooey-item]');
		const el = items[activeIndex];
		if (!el) return null;
		const parent = rootEl.getBoundingClientRect();
		const box = el.getBoundingClientRect();
		return { x: box.left - parent.left, y: box.top - parent.top, w: box.width, h: box.height };
	}

	async function moveTo(animate: boolean) {
		await tick();
		const to = targetBox();
		cancelLead();
		cancelTrail();
		if (!to) {
			lead = null;
			trail = null;
			return;
		}
		if (!animate || !lead || !trail) {
			lead = to;
			trail = to;
			return;
		}
		cancelLead = tweenBox(lead, to, 220, (b) => (lead = b));
		cancelTrail = tweenBox(trail, to, 480, (b) => (trail = b), 40);
	}

	$effect(() => {
		void activeIndex;
		void moveTo(true);
	});

	onMount(() => {
		if (!rootEl) return;
		const root = rootEl;

		/* Blob coordinates are relative to `root`, so anything that moves an item
		   inside it invalidates them: chip strip scroll, new/changed chips,
		   viewport rotation. Without this the highlight stayed behind while the
		   strip scrolled under it. Deliberately no per-item ResizeObserver: a chip
		   grows when it turns active (`font-weight`), and re-measuring there would
		   snap the blob instead of letting `moveTo(true)` animate it. */
		let frame = 0;
		const sync = () => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				void moveTo(false);
			});
		};

		const ro = new ResizeObserver(sync);
		ro.observe(root);

		const itemsEl = root.querySelector('.fx-gooey__items');
		const mo = itemsEl ? new MutationObserver(sync) : null;
		mo?.observe(itemsEl as Element, { childList: true, subtree: true, characterData: true });

		/* `scroll` doesn't bubble, but a capture listener on the root sees the
		   horizontal chip strip scroll. */
		root.addEventListener('scroll', sync, true);
		window.addEventListener('resize', sync);

		return () => {
			if (frame) cancelAnimationFrame(frame);
			ro.disconnect();
			mo?.disconnect();
			root.removeEventListener('scroll', sync, true);
			window.removeEventListener('resize', sync);
			cancelLead();
			cancelTrail();
		};
	});
</script>

<div class={cn('fx-gooey', className)} bind:this={rootEl}>
	<svg class="fx-gooey__svg" aria-hidden="true" focusable="false">
		<defs>
			<filter id={filterId} x="-20%" y="-60%" width="140%" height="220%">
				<feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
				<feColorMatrix
					in="blur"
					mode="matrix"
					values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
				/>
			</filter>
		</defs>
		{#if lead && trail}
			<g filter={`url(#${filterId})`}>
				<rect x={lead.x} y={lead.y} width={lead.w} height={lead.h} rx={lead.h / 2} />
				<rect
					x={trail.x + trail.w * 0.12}
					y={trail.y + trail.h * 0.12}
					width={trail.w * 0.76}
					height={trail.h * 0.76}
					rx={(trail.h * 0.76) / 2}
				/>
			</g>
		{/if}
	</svg>
	<div class={cn('fx-gooey__items', itemsClass)}>
		{@render children?.()}
	</div>
</div>
