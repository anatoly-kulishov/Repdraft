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
		/** Stronger cycle on splash; chrome stays quieter. */
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

	onMount(() => {
		if (!browser) return;
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => {
			motionOk = !mq.matches;
		};
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	const dur = $derived(intensity === 'splash' ? '1.7s' : '2.6s');
</script>

<svg
	class="brand-mark {className}"
	class:brand-mark--splash={intensity === 'splash'}
	class:brand-mark--calm={intensity === 'calm'}
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
		<!-- Beam under the mark: cutout reveals it, so the pulse shape stays exact. -->
		<ellipse cx="60" cy="256" rx="72" ry="52" fill="url(#{beamId})" opacity="0">
			<animate
				attributeName="cx"
				values="60;420;460"
				keyTimes="0;0.5;1"
				calcMode="spline"
				keySplines="0.4 0 0.2 1; 0.4 0 1 1"
				dur={dur}
				repeatCount="indefinite"
			/>
			<animate
				attributeName="opacity"
				values="0;0.95;0.75;0;0"
				keyTimes="0;0.1;0.48;0.58;1"
				dur={dur}
				repeatCount="indefinite"
			/>
		</ellipse>
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
</style>
