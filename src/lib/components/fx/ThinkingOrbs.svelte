<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import type { ThinkingOrbState } from './thinkingOrbState';

	type Props = {
		mode?: ThinkingOrbState;
		size?: 20 | 48 | 64;
		label?: string;
		class?: string;
	};

	let { mode = 'working', size = 64, label = 'Thinking', class: className = '' }: Props =
		$props();

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let raf = 0;
	let reduced = false;
	let visible = true;

	function paint(ctx: CanvasRenderingContext2D, t: number, w: number, dpr: number) {
		ctx.clearRect(0, 0, w, w);
		const cx = w / 2;
		const cy = w / 2;
		const r = w * 0.36;
		const dots = size <= 20 ? 10 : 18;
		const accent = getComputedStyle(ctx.canvas).getPropertyValue('--color-accent').trim() || '#a259ff';
		const muted =
			getComputedStyle(ctx.canvas).getPropertyValue('--color-muted').trim() || '#8e8e93';

		ctx.strokeStyle = muted;
		ctx.globalAlpha = 0.35;
		ctx.lineWidth = 1 * dpr;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.stroke();
		ctx.globalAlpha = 1;

		for (let i = 0; i < dots; i++) {
			const base = (i / dots) * Math.PI * 2;
			let ang = base;
			let rad = r;
			let alpha = 0.85;
			let dotR = size <= 20 ? 1.1 * dpr : 1.7 * dpr;

			switch (mode) {
				case 'searching': {
					const sweep = (t * 0.0018) % (Math.PI * 2);
					const dist = Math.abs(Math.atan2(Math.sin(base - sweep), Math.cos(base - sweep)));
					alpha = dist < 0.55 ? 1 : 0.25;
					rad = r * (0.92 + 0.08 * Math.cos(t * 0.004 + i));
					break;
				}
				case 'breathing': {
					rad = r * (0.88 + 0.12 * Math.sin(t * 0.0022));
					alpha = 0.55 + 0.35 * Math.sin(t * 0.0022 + i * 0.3);
					break;
				}
				case 'composing': {
					rad = r * (0.75 + 0.2 * Math.sin(t * 0.003 + i * 0.55));
					ang = base + 0.25 * Math.sin(t * 0.0025 + i);
					break;
				}
				case 'connecting': {
					ang = base + t * 0.0007;
					rad = r * (i % 3 === 0 ? 0.7 : 1);
					break;
				}
				case 'working':
				default: {
					ang = base + t * 0.0011;
					rad = r * (0.82 + 0.18 * Math.sin(t * 0.002 + i * 0.7));
					break;
				}
			}

			if (reduced) {
				ang = base;
				rad = r;
				alpha = 0.7;
			}

			const x = cx + Math.cos(ang) * rad;
			const y = cy + Math.sin(ang) * rad * 0.72;
			ctx.beginPath();
			ctx.fillStyle = accent;
			ctx.globalAlpha = alpha;
			ctx.arc(x, y, dotR, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	onMount(() => {
		if (!browser || !canvasEl) return;
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const css = size;
		canvasEl.width = css * dpr;
		canvasEl.height = css * dpr;
		canvasEl.style.width = `${css}px`;
		canvasEl.style.height = `${css}px`;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const io = new IntersectionObserver(
			(entries) => {
				visible = entries.some((e) => e.isIntersecting);
			},
			{ threshold: 0.05 }
		);
		io.observe(canvasEl);

		const loop = (t: number) => {
			if (visible && !document.hidden) paint(ctx, reduced ? 0 : t, css * dpr, dpr);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);

		return () => {
			io.disconnect();
			cancelAnimationFrame(raf);
		};
	});

	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
	});
</script>

<div
	class={['fx-orbs', className].filter(Boolean).join(' ')}
	style={`width:${size}px;height:${size}px`}
	role="img"
	aria-label={label}
>
	<canvas bind:this={canvasEl}></canvas>
</div>
