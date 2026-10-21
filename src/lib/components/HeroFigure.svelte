<script lang="ts">
	import { HERO_VIEWBOX, heroZoneShapes } from '$lib/design/heroFigure';
	import type { QuestHeroSex } from '$lib/domain/questHeroProfile';
	import type { FigureZone } from '$lib/domain/sessionPayoff';

	let {
		sex = null,
		zones = [],
		size = 96
	}: {
		sex?: QuestHeroSex | null;
		zones?: readonly FigureZone[];
		size?: number;
	} = $props();

	const uid = $props.id();
	const box = HERO_VIEWBOX;
	let src = $derived(sex === 'f' ? '/images/hero/hero-f.png' : '/images/hero/hero-m.png');
	let shapes = $derived(heroZoneShapes(sex, zones));
	let figureHeight = $derived(Math.round((size * box.height) / box.width));
</script>

{#if shapes.length === 0}
	<!-- ponytail: two SVG <image> side by side can show the same bitmap (onboarding M/F). -->
	<img class="hero-figure" {src} alt="" width={size} height={figureHeight} decoding="async" />
{:else}
<svg
	class="hero-figure"
	viewBox="{box.x} {box.y} {box.width} {box.height}"
	width={size}
	height={figureHeight}
	aria-hidden="true"
>
	<defs>
		<radialGradient id="{uid}-glow">
			<stop offset="0%" class="hero-figure__glow" stop-opacity="0.95" />
			<stop offset="100%" class="hero-figure__glow" stop-opacity="0.35" />
		</radialGradient>
		<mask id="{uid}-body" maskUnits="userSpaceOnUse">
			<image href={src} x={box.x} y={box.y} width={box.width} height={box.height} />
		</mask>
	</defs>
	<image href={src} x={box.x} y={box.y} width={box.width} height={box.height} />
	{#if shapes.length > 0}
		<g mask="url(#{uid}-body)">
			{#each shapes as s, i (i)}
				<ellipse
					cx={s.cx}
					cy={s.cy}
					rx={s.rx}
					ry={s.ry}
					transform="rotate({s.rotate} {s.cx} {s.cy})"
					fill="url(#{uid}-glow)"
				/>
			{/each}
		</g>
	{/if}
</svg>
{/if}

<style>
	.hero-figure {
		display: block;
		flex-shrink: 0;
		object-fit: contain;
	}
	.hero-figure__glow {
		stop-color: var(--color-muscle);
	}
</style>
