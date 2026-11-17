<script lang="ts">
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils.js';
	import type { BotMood } from './botMood';
	import { hasFinePointer, prefersReducedMotion } from './motion';

	type Props = {
		mood?: BotMood;
		size?: number;
		label?: string;
		/** Pupils follow the pointer (mouse only). */
		follow?: boolean;
		class?: string;
	};

	let {
		mood = 'idle',
		size = 64,
		label = 'Bot',
		follow = true,
		class: className = ''
	}: Props = $props();

	let rootEl: HTMLDivElement | null = $state(null);
	let look = $state({ x: 0, y: 0 });

	const mouth = $derived.by(() => {
		switch (mood) {
			case 'idle':
				return 'M22 42 Q32 46 42 42';
			case 'thinking':
				return 'M24 43 L38 41';
			case 'talking':
				return 'M24 41 Q32 49 40 41 Q32 44 24 41';
			case 'happy':
				return 'M20 39 Q32 52 44 39';
			case 'sad':
				return 'M22 46 Q32 38 42 46';
			default: {
				const _exhaustive: never = mood;
				return _exhaustive;
			}
		}
	});

	onMount(() => {
		if (!follow || !hasFinePointer() || prefersReducedMotion()) return;
		let raf = 0;
		let px = 0;
		let py = 0;
		const paint = () => {
			raf = 0;
			if (!rootEl) return;
			const r = rootEl.getBoundingClientRect();
			const dx = px - (r.left + r.width / 2);
			const dy = py - (r.top + r.height / 2);
			const d = Math.hypot(dx, dy) || 1;
			const k = Math.min(1, d / 240);
			look = { x: (dx / d) * 2.6 * k, y: (dy / d) * 2.2 * k };
		};
		const onMove = (e: PointerEvent) => {
			px = e.clientX;
			py = e.clientY;
			if (!raf) raf = requestAnimationFrame(paint);
		};
		window.addEventListener('pointermove', onMove, { passive: true });
		return () => {
			window.removeEventListener('pointermove', onMove);
			if (raf) cancelAnimationFrame(raf);
		};
	});
</script>

<div
	bind:this={rootEl}
	class={cn('fx-bot', `fx-bot--${mood}`, className)}
	style={`width:${size}px;height:${size}px`}
	role="img"
	aria-label={label}
>
	<svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
		<line class="fx-bot__antenna" x1="32" y1="9" x2="32" y2="3" />
		<circle class="fx-bot__antenna-tip" cx="32" cy="3" r="2.4" />
		<g class="fx-bot__head">
			<rect class="fx-bot__face" x="8" y="10" width="48" height="46" rx="16" />
			<g class="fx-bot__eyes" style={`transform:translate(${look.x}px, ${look.y}px)`}>
				<g class="fx-bot__eye">
					<ellipse cx="23" cy="30" rx="4.2" ry="5" />
				</g>
				<g class="fx-bot__eye">
					<ellipse cx="41" cy="30" rx="4.2" ry="5" />
				</g>
			</g>
			<path class="fx-bot__mouth" d={mouth} />
		</g>
	</svg>
</div>
