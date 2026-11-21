<script lang="ts">
	import type { CycleWeekSummary } from '$lib/domain/cycle';

	type Props = {
		weeks: readonly CycleWeekSummary[];
		/** Screen-reader description (localized by the page). */
		label: string;
		compact?: boolean;
	};

	let { weeks, label, compact = false }: Props = $props();

	const W = 320;
	const PAD_X = 10;
	const PAD_TOP = 8;
	const TICKS_H = 18;
	const MIN_PCT = 72;
	const MAX_PCT = 124;

	let height = $derived(compact ? 72 : 132);
	let plotH = $derived(height - PAD_TOP - (compact ? 0 : TICKS_H));
	let step = $derived(weeks.length > 0 ? (W - PAD_X * 2) / weeks.length : W);

	function y(pct: number): number {
		const ratio = (pct - MIN_PCT) / (MAX_PCT - MIN_PCT);
		return Math.round((PAD_TOP + (1 - ratio) * plotH) * 100) / 100;
	}

	function x(index: number): number {
		return Math.round((PAD_X + (index + 0.5) * step) * 100) / 100;
	}

	type Pt = { x: number; y: number };

	/** Catmull-Rom → cubic Bézier: the wave reads as a curve, not a zigzag. */
	function smoothPath(points: Pt[]): string {
		if (points.length === 0) return '';
		const first = points[0]!;
		if (points.length === 1) return `M ${first.x} ${first.y}`;
		const parts = [`M ${first.x} ${first.y}`];
		for (let i = 0; i < points.length - 1; i += 1) {
			const p0 = points[i - 1] ?? points[i]!;
			const p1 = points[i]!;
			const p2 = points[i + 1]!;
			const p3 = points[i + 2] ?? p2;
			const c1x = p1.x + (p2.x - p0.x) / 6;
			const c1y = p1.y + (p2.y - p0.y) / 6;
			const c2x = p2.x - (p3.x - p1.x) / 6;
			const c2y = p2.y - (p3.y - p1.y) / 6;
			parts.push(
				`C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x} ${p2.y}`
			);
		}
		return parts.join(' ');
	}

	let volumePts = $derived(
		weeks.map((week, index) => ({ x: x(index), y: y(week.volumePct) }))
	);
	let intensityPts = $derived(
		weeks.map((week, index) => ({ x: x(index), y: y(week.intensityPct) }))
	);
	let volumePath = $derived(smoothPath(volumePts));
	let intensityPath = $derived(smoothPath(intensityPts));
	let currentIndex = $derived(weeks.findIndex((week) => week.isCurrent));
	let baselineY = $derived(y(100));
</script>

<svg
	class="cycle-chart"
	class:cycle-chart--compact={compact}
	viewBox="0 0 {W} {height}"
	preserveAspectRatio="none"
	role="img"
	aria-label={label}
>
	<line
		class="cycle-chart__baseline"
		x1={PAD_X}
		x2={W - PAD_X}
		y1={baselineY}
		y2={baselineY}
	></line>

	{#if !compact && currentIndex >= 0}
		<rect
			class="cycle-chart__now"
			x={PAD_X + currentIndex * step}
			y={PAD_TOP}
			width={step}
			height={plotH}
			rx="6"
		></rect>
	{/if}

	<path class="cycle-chart__line cycle-chart__line--volume" d={volumePath}></path>
	<path class="cycle-chart__line cycle-chart__line--intensity" d={intensityPath}></path>

	{#each weeks as week, index (week.week)}
		{#if !compact}
			<circle
				class="cycle-chart__dot cycle-chart__dot--volume"
				cx={x(index)}
				cy={y(week.volumePct)}
				r="2.2"
			></circle>
			<circle
				class="cycle-chart__dot cycle-chart__dot--intensity"
				cx={x(index)}
				cy={y(week.intensityPct)}
				r="2.2"
			></circle>
		{/if}
	{/each}

	{#if !compact}
		{#each weeks as week, index (week.week)}
			<text
				class="cycle-chart__tick"
				class:cycle-chart__tick--now={week.isCurrent}
				x={x(index)}
				y={height - 3}
				text-anchor="middle"
			>
				{week.week}
			</text>
		{/each}
	{/if}
</svg>
