<script module lang="ts">
	let markSeq = 0;
</script>

<script lang="ts">
	import { browser } from '$app/environment';
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

	/** Unique gradient id per instance (avoid clashes when several marks mount). */
	const gradId = `brand-mark-g-${++markSeq}`;
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

	const dur = $derived(intensity === 'splash' ? '3.2s' : '5.5s');
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
		<linearGradient
			id={gradId}
			gradientUnits="userSpaceOnUse"
			x1="0"
			y1="0"
			x2="512"
			y2="512"
		>
			{#if motionOk}
				<animate attributeName="x1" values="0;420;0" dur={dur} repeatCount="indefinite" />
				<animate attributeName="y1" values="0;80;512;0" dur={dur} repeatCount="indefinite" />
				<animate attributeName="x2" values="512;80;512" dur={dur} repeatCount="indefinite" />
				<animate attributeName="y2" values="512;420;0;512" dur={dur} repeatCount="indefinite" />
			{/if}
			<!-- Brand plate: soft violet wash (matches app-icon-master). -->
			<stop offset="0%" stop-color="#8b5cf6">
				{#if motionOk}
					<animate
						attributeName="stop-color"
						values="#8b5cf6;#7c3aed;#a78bfa;#8b5cf6"
						dur={dur}
						repeatCount="indefinite"
					/>
				{/if}
			</stop>
			<stop offset="62%" stop-color="#a78bfa">
				{#if motionOk}
					<animate
						attributeName="stop-color"
						values="#a78bfa;#c4b5fd;#8b5cf6;#a78bfa"
						dur={dur}
						repeatCount="indefinite"
					/>
				{/if}
			</stop>
			<stop offset="100%" stop-color="#c4b5fd">
				{#if motionOk}
					<animate
						attributeName="stop-color"
						values="#c4b5fd;#a78bfa;#7c3aed;#c4b5fd"
						dur={dur}
						repeatCount="indefinite"
					/>
				{/if}
			</stop>
		</linearGradient>
	</defs>
	<rect width="512" height="512" rx="114" fill="url(#{gradId})" />
	<path
		d="M 0.00 340.00 L 66.00 340.00 L 75.00 335.00 L 81.00 327.00 L 144.00 211.00 L 146.00 209.00 L 149.00 209.00 L 234.00 330.00 L 238.00 334.00 L 247.00 339.00 L 265.00 340.00 L 269.00 342.00 L 269.00 345.00 L 231.00 431.00 L 231.00 437.00 L 294.00 437.00 L 305.00 426.00 L 374.00 267.00 L 379.00 263.00 L 468.00 263.00 L 475.00 262.00 L 489.00 258.00 L 502.00 252.00 L 518.00 241.00 L 530.00 229.00 L 540.00 215.00 L 548.00 199.00 L 552.00 187.00 L 553.00 179.00 L 555.00 178.00 L 555.00 140.00 L 553.00 139.00 L 549.00 123.00 L 539.00 105.00 L 522.00 87.00 L 510.00 79.00 L 491.00 71.00 L 474.00 68.00 L 370.00 68.00 L 369.00 72.00 L 372.00 84.00 L 372.00 111.00 L 368.00 127.00 L 369.00 132.00 L 464.00 132.00 L 476.00 138.00 L 482.00 144.00 L 486.00 151.00 L 488.00 158.00 L 488.00 169.00 L 486.00 176.00 L 476.00 190.00 L 461.00 198.00 L 455.00 199.00 L 349.00 199.00 L 337.00 203.00 L 331.00 207.00 L 323.00 216.00 L 294.00 284.00 L 290.00 290.00 L 287.00 290.00 L 222.00 203.00 L 221.00 198.00 L 223.00 196.00 L 276.00 195.00 L 295.00 189.00 L 317.00 175.00 L 334.00 156.00 L 344.00 139.00 L 351.00 120.00 L 354.00 102.00 L 354.00 87.00 L 352.00 72.00 L 347.00 56.00 L 340.00 42.00 L 333.00 32.00 L 320.00 19.00 L 310.00 12.00 L 298.00 6.00 L 285.00 2.00 L 281.00 2.00 L 280.00 0.00 L 33.00 0.00 L 33.00 3.00 L 73.00 56.00 L 80.00 63.00 L 84.00 65.00 L 93.00 67.00 L 101.00 66.00 L 104.00 67.00 L 265.00 67.00 L 276.00 72.00 L 282.00 78.00 L 287.00 87.00 L 289.00 98.00 L 288.00 105.00 L 283.00 116.00 L 274.00 125.00 L 262.00 130.00 L 131.00 130.00 L 122.00 132.00 L 111.00 138.00 L 103.00 147.00 L 93.00 167.00 L 87.00 176.00 L 2.00 334.00 L 0.00 335.00 Z"
		fill="#FFFFFF"
		fill-rule="evenodd"
		transform="translate(76.000 112.201) scale(0.647482)"
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
