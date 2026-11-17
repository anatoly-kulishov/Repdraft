<script lang="ts">
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from './motion';
	import type { ThinkingOrbState } from './thinkingOrbState';

	type Props = {
		mode?: ThinkingOrbState;
		size?: 20 | 48 | 64;
		label?: string;
		class?: string;
	};

	let { mode = 'working', size = 64, label = 'Thinking', class: className = '' }: Props =
		$props();

	type Dot = { x: number; y: number; a: number; s: number };
	type Line = { x1: number; y1: number; x2: number; y2: number; a: number };

	const TAU = Math.PI * 2;

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let paintStill: (() => void) | null = null;

	$effect(() => {
		void mode;
		paintStill?.();
	});

	function wrapAngle(a: number): number {
		return Math.atan2(Math.sin(a), Math.cos(a));
	}

	/** Radius factor of a regular n-gon at angle a (circle when n = 0). */
	function polygonRadius(n: number, a: number): number {
		if (n === 0) return 1;
		const seg = TAU / n;
		const local = ((a % seg) + seg) % seg;
		return Math.cos(Math.PI / n) / Math.cos(local - Math.PI / n);
	}

	function frame(m: ThinkingOrbState, t: number, r: number, small: boolean) {
		const dots: Dot[] = [];
		const lines: Line[] = [];
		const n = small ? 12 : 28;

		switch (m) {
			case 'working': {
				for (let i = 0; i < n; i++) {
					const orbit = i % 2;
					const dir = orbit ? 1 : -1.3;
					const ang = (i / n) * TAU * 2 + t * 0.0012 * dir;
					const rot = orbit ? 0.55 : -0.55;
					const ox = Math.cos(ang) * r;
					const oy = Math.sin(ang) * r * (orbit ? 0.42 : 0.7);
					const depth = (Math.sin(ang) + 1) / 2;
					dots.push({
						x: ox * Math.cos(rot) - oy * Math.sin(rot),
						y: ox * Math.sin(rot) + oy * Math.cos(rot),
						a: 0.35 + 0.65 * depth,
						s: 0.75 + 0.45 * depth
					});
				}
				break;
			}
			case 'searching': {
				const spin = t * 0.0004;
				const sweep = t * 0.0019;
				const lats = small ? [-0.6, 0, 0.6] : [-0.9, -0.45, 0, 0.45, 0.9];
				const per = small ? 5 : 9;
				for (const lat of lats) {
					for (let j = 0; j < per; j++) {
						const lon = (j / per) * TAU + spin;
						const front = Math.cos(lon);
						const near = Math.abs(wrapAngle(lon - sweep)) < 0.4;
						dots.push({
							x: Math.cos(lat) * Math.sin(lon) * r,
							y: Math.sin(lat) * r * 0.92,
							a: near ? 1 : front > 0 ? 0.55 : 0.16,
							s: near ? 1.35 : front > 0 ? 1 : 0.7
						});
					}
				}
				break;
			}
			case 'solving': {
				const p = (t % 2600) / 2600;
				const scramble = p < 0.62 ? Math.sin((p / 0.62) * Math.PI) : 0;
				const snap = p >= 0.62 && p < 0.72 ? 1 - (p - 0.62) / 0.1 : 0;
				const bands = [0.5, 0.78, 1];
				const per = small ? 4 : 9;
				bands.forEach((k, b) => {
					const off = scramble * (b + 1) * 1.15 * Math.sin(t * 0.004 + b * 2.1);
					for (let j = 0; j < per; j++) {
						const ang = (j / per) * TAU + off;
						dots.push({
							x: Math.cos(ang) * r * k,
							y: Math.sin(ang) * r * k,
							a: 0.5 + 0.5 * (1 - scramble) + 0.3 * snap,
							s: 1 + 0.5 * snap
						});
					}
				});
				break;
			}
			case 'listening': {
				const env = 0.55 + 0.45 * Math.sin(t * 0.0021);
				for (const k of small ? [1] : [0.62, 1]) {
					const per = small ? n : Math.round(n * k);
					for (let j = 0; j < per; j++) {
						const ang = (j / per) * TAU;
						const wave = Math.sin(ang * 4 - t * 0.008) * 0.16 * env;
						const rad = r * k * (1 + wave);
						dots.push({
							x: Math.cos(ang) * rad,
							y: Math.sin(ang) * rad,
							a: 0.45 + 0.55 * Math.max(0, wave / 0.16),
							s: 1
						});
					}
				}
				break;
			}
			case 'connecting': {
				const count = small ? 6 : 9;
				const nodes: { x: number; y: number }[] = [];
				for (let i = 0; i < count; i++) {
					const ang = (i / count) * TAU + t * 0.0003;
					const k = 0.55 + 0.45 * ((i * 37) % 10) / 10;
					nodes.push({ x: Math.cos(ang) * r * k, y: Math.sin(ang) * r * k });
				}
				const edges: [number, number][] = [];
				for (let i = 0; i < count; i++) {
					edges.push([i, (i + 1) % count]);
					if (!small && i % 2 === 0) edges.push([i, (i + 3) % count]);
				}
				const p = (t % 3400) / 3400;
				const shown = Math.floor(Math.min(1, p / 0.75) * edges.length);
				const fade = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
				edges.slice(0, shown).forEach(([a, b]) => {
					lines.push({ x1: nodes[a].x, y1: nodes[a].y, x2: nodes[b].x, y2: nodes[b].y, a: 0.4 * fade });
				});
				nodes.forEach((p2) => dots.push({ ...p2, a: 0.9, s: 1.25 }));
				break;
			}
			case 'weaving': {
				const per = small ? 4 : 10;
				for (let s = 0; s < 3; s++) {
					for (let j = 0; j < per; j++) {
						const ang = (j / per) * TAU + t * 0.0011;
						const phase = ang * 3 + (s * TAU) / 3 + t * 0.002;
						const rad = r * (0.82 + 0.18 * Math.sin(phase));
						dots.push({
							x: Math.cos(ang) * rad,
							y: Math.sin(ang) * rad,
							a: 0.35 + 0.65 * ((Math.cos(phase) + 1) / 2),
							s: 0.8 + 0.4 * ((Math.cos(phase) + 1) / 2)
						});
					}
				}
				break;
			}
			case 'composing': {
				const per = small ? 5 : 11;
				for (let b = 0; b < 3; b++) {
					for (let j = 0; j < per; j++) {
						const x = -r + (j / (per - 1)) * r * 2;
						const y =
							Math.sin((x / r) * 2.2 + t * 0.003 + b * 0.9) * r * 0.32 + (b - 1) * r * 0.26;
						if (x * x + y * y > r * r) continue;
						dots.push({ x, y, a: 0.45 + 0.4 * ((b + 1) / 3), s: 1 });
					}
				}
				break;
			}
			case 'breathing': {
				for (let i = 0; i < n; i++) {
					const ang = (i / n) * TAU;
					const rad = r * (0.84 + 0.1 * Math.sin(ang * 3 + t * 0.0015) + 0.06 * Math.sin(t * 0.0021));
					dots.push({
						x: Math.cos(ang) * rad,
						y: Math.sin(ang) * rad,
						a: 0.55 + 0.35 * Math.sin(t * 0.0021 + i * 0.3),
						s: 1
					});
				}
				break;
			}
			case 'shaping': {
				const shapes = [0, 3, 4];
				const cycle = 1900;
				const idx = Math.floor(t / cycle) % shapes.length;
				const local = (t % cycle) / cycle;
				const blend = local < 0.65 ? 0 : (local - 0.65) / 0.35;
				const from = shapes[idx];
				const to = shapes[(idx + 1) % shapes.length];
				const rot = t * 0.0005;
				for (let i = 0; i < n; i++) {
					const ang = (i / n) * TAU;
					const k = polygonRadius(from, ang) * (1 - blend) + polygonRadius(to, ang) * blend;
					dots.push({
						x: Math.cos(ang + rot) * r * k * 0.92,
						y: Math.sin(ang + rot) * r * k * 0.92,
						a: 0.85,
						s: 1
					});
				}
				break;
			}
			default: {
				const _exhaustive: never = m;
				return _exhaustive;
			}
		}
		return { dots, lines };
	}

	onMount(() => {
		const canvas = canvasEl;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const reduced = prefersReducedMotion();
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = size * dpr;
		canvas.height = size * dpr;

		let accent = '#a259ff';
		const readColors = () => {
			accent = getComputedStyle(canvas).getPropertyValue('--color-accent').trim() || accent;
		};
		readColors();
		const themeObserver = new MutationObserver(readColors);
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme', 'class']
		});

		const small = size <= 20;
		const paint = (t: number) => {
			const w = size * dpr;
			const c = w / 2;
			const r = w * 0.38;
			const dotR = (small ? 1.05 : 1.6) * dpr;
			ctx.clearRect(0, 0, w, w);
			const { dots, lines } = frame(mode, t, r, small);
			ctx.strokeStyle = accent;
			ctx.lineWidth = 0.75 * dpr;
			for (const l of lines) {
				ctx.globalAlpha = l.a;
				ctx.beginPath();
				ctx.moveTo(c + l.x1, c + l.y1);
				ctx.lineTo(c + l.x2, c + l.y2);
				ctx.stroke();
			}
			ctx.fillStyle = accent;
			for (const d of dots) {
				ctx.globalAlpha = d.a;
				ctx.beginPath();
				ctx.arc(c + d.x, c + d.y, dotR * d.s, 0, TAU);
				ctx.fill();
			}
			ctx.globalAlpha = 1;
		};

		let raf = 0;
		let visible = true;
		const loop = (t: number) => {
			paint(t);
			raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
		};
		const resume = () => {
			if (reduced) {
				paint(1200);
				return;
			}
			if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop);
		};

		if (reduced) paintStill = () => paint(1200);

		const io = new IntersectionObserver((entries) => {
			visible = entries.some((e) => e.isIntersecting);
			resume();
		});
		io.observe(canvas);
		document.addEventListener('visibilitychange', resume);
		resume();

		return () => {
			paintStill = null;
			io.disconnect();
			themeObserver.disconnect();
			document.removeEventListener('visibilitychange', resume);
			if (raf) cancelAnimationFrame(raf);
		};
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
