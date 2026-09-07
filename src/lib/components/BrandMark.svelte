<script module lang="ts">
	let markSeq = 0;
</script>

<script lang="ts">
	import { browser } from '$app/environment';
	import markPulse from '$lib/assets/brand/mark-pulse.png';
	import { onMount } from 'svelte';

	let {
		class: className = '',
		size = 40,
		/** Splash: continuous beam. Calm: one pass then idle (~8s), paused off-screen. */
		intensity = 'calm'
	}: {
		class?: string;
		size?: number;
		intensity?: 'calm' | 'splash';
	} = $props();

	/** Unique ids per instance (avoid clashes when several marks mount). */
	const uid = ++markSeq;
	const gradId = `brand-mark-g-${uid}`;
	const beamId = `brand-mark-beam-${uid}`;
	let motionOk = $state(true);
	let live = $state(false);
	let rootEl = $state<SVGSVGElement | null>(null);
	let tabVisible = $state(true);

	onMount(() => {
		if (!browser) return;
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotion = () => {
			motionOk = !mq.matches;
		};
		syncMotion();
		mq.addEventListener('change', syncMotion);

		const syncTab = () => {
			tabVisible = document.visibilityState === 'visible';
		};
		syncTab();
		document.addEventListener('visibilitychange', syncTab);

		return () => {
			mq.removeEventListener('change', syncMotion);
			document.removeEventListener('visibilitychange', syncTab);
		};
	});

	$effect(() => {
		if (!browser) return;
		if (intensity === 'splash') {
			live = motionOk;
			return;
		}
		const el = rootEl;
		if (!el || !motionOk) {
			live = false;
			return;
		}
		const refresh = (onScreen: boolean) => {
			live = motionOk && tabVisible && onScreen;
		};
		if (typeof IntersectionObserver === 'undefined') {
			refresh(true);
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				refresh(entries.some((e) => e.isIntersecting));
			},
			{ threshold: 0.2 }
		);
		io.observe(el);
		refresh(true);
		return () => io.disconnect();
	});
</script>

<svg
	bind:this={rootEl}
	class="brand-mark {className}"
	class:brand-mark--splash={intensity === 'splash'}
	class:brand-mark--calm={intensity === 'calm'}
	class:brand-mark--live={live}
	viewBox="0 0 512 512"
	width={size}
	height={size}
	aria-hidden="true"
	focusable="false"
>
	<defs>
		<linearGradient id={gradId} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
			<stop offset="0%" stop-color="#8b5cf6" />
			<stop offset="62%" stop-color="#a78bfa" />
			<stop offset="100%" stop-color="#c4b5fd" />
		</linearGradient>
		<!-- Soft traveling highlight; only shows through the ECG cutout in the mark. -->
		<radialGradient id={beamId} cx="50%" cy="50%" r="50%">
			<stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
			<stop offset="45%" stop-color="#ede9fe" stop-opacity="0.55" />
			<stop offset="100%" stop-color="#c4b5fd" stop-opacity="0" />
		</radialGradient>
	</defs>
	<rect width="512" height="512" rx="114" fill="url(#{gradId})" />
	{#if motionOk}
		{#if intensity === 'splash'}
			<ellipse cx="60" cy="256" rx="72" ry="52" fill="url(#{beamId})" opacity="0">
				<animate
					attributeName="cx"
					values="60;420;460"
					keyTimes="0;0.5;1"
					calcMode="spline"
					keySplines="0.4 0 0.2 1; 0.4 0 1 1"
					dur="1.7s"
					repeatCount="indefinite"
				/>
				<animate
					attributeName="opacity"
					values="0;0.95;0.75;0;0"
					keyTimes="0;0.1;0.48;0.58;1"
					dur="1.7s"
					repeatCount="indefinite"
				/>
			</ellipse>
		{:else}
			<!-- Calm: CSS cycle (~1.4s pass + idle). Paused off-screen / hidden tab. -->
			<ellipse
				class="brand-mark__beam brand-mark__beam--calm"
				cx="60"
				cy="256"
				rx="72"
				ry="52"
				fill="url(#{beamId})"
			/>
		{/if}
	{/if}
	<!-- White RP with transparent pulse cutout sits on top of the beam. -->
	<image
		href={markPulse}
		x="0"
		y="0"
		width="512"
		height="512"
		preserveAspectRatio="xMidYMid meet"
	/>
</svg>

<style>
	.brand-mark {
		display: block;
		border-radius: 0.65rem;
		overflow: hidden;
	}

	.brand-mark--calm {
		transition: opacity 0.2s ease;
	}

	:global(.group:hover) .brand-mark--calm {
		opacity: 0.92;
	}

	.brand-mark__beam--calm {
		opacity: 0;
		transform: translateX(0);
		transform-box: fill-box;
		transform-origin: center;
		animation: brand-beam-calm 8s ease-in-out infinite;
		animation-play-state: paused;
		will-change: transform, opacity;
	}

	.brand-mark--live .brand-mark__beam--calm {
		animation-play-state: running;
	}

	@keyframes brand-beam-calm {
		0%,
		100% {
			transform: translateX(0);
			opacity: 0;
		}
		2% {
			opacity: 0.95;
		}
		16% {
			transform: translateX(360px);
			opacity: 0.7;
		}
		20%,
		100% {
			transform: translateX(400px);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.brand-mark__beam--calm {
			animation: none !important;
			opacity: 0 !important;
		}
	}
</style>
