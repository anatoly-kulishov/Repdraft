<script lang="ts">
	import AppPanel from '$lib/components/AppPanel.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelBodyPart } from '$lib/domain/labels.ru';
	import {
		computeProgressOverview,
		PROGRESS_PERIODS,
		type ProgressPeriod
	} from '$lib/domain/progressOverview';
	import { formatKgInt } from '$lib/domain/format';
	import { loadExerciseIndexWithCustoms } from '$lib/data/exerciseIndexWithCustoms';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { onMount } from 'svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
	let indexById = $state(new Map<string, ExerciseIndexItem>());
	let period: ProgressPeriod = $state(30);

	let overview = $derived(
		computeProgressOverview($live.history, new Date(), (id) => indexById.get(id)?.body_part ?? null, {
			period
		})
	);
	let maxWeekVol = $derived(Math.max(1, ...overview.weeks.map((w) => w.volumeKg)));
	let hasData = $derived(overview.weeks.length > 0);
	// Small samples make a "lagging" flag noisy: require enough groups and workouts.
	let laggingPart = $derived(
		overview.setShares.length >= 3 && overview.cards.workouts >= 4
			? overview.laggingBodyPart
			: null
	);

	function periodLabel(p: ProgressPeriod): string {
		return translate(lang, `progress.period.${p}`);
	}

	/** "за неделю" / "за 30 дней" caption for the workouts delta. */
	function periodNoun(p: ProgressPeriod): string {
		if (p === 7) return translate(lang, 'progress.periodPastWeek');
		if (p === 90 || p === 30) return translate(lang, 'progress.periodPastDays', { n: p });
		return '';
	}

	/** Signed delta caption for the workouts card. */
	function workoutsDeltaText(): string | null {
		const d = overview.cards.workoutsDelta;
		if (d == null) return null;
		if (d === 0) return translate(lang, 'progress.deltaNone');
		return translate(lang, 'progress.deltaWorkouts', {
			sign: deltaSign(d),
			n: Math.abs(d),
			p: periodNoun(period)
		});
	}

	/** Signed delta caption for the volume card. */
	function volumeDeltaText(): string | null {
		const d = overview.cards.volumeKgDelta;
		if (d == null) return null;
		if (d === 0) return translate(lang, 'progress.deltaNone');
		return translate(lang, 'progress.deltaVolume', {
			sign: deltaSign(d),
			n: formatKgInt(Math.abs(d))
		});
	}

	function deltaSign(d: number): string {
		return d > 0 ? '+' : d < 0 ? '−' : '';
	}

	/** Human range for a Monday-based weekKey: "21–27 сент." */
	function weekRange(weekKey: string): string {
		const monday = new Date(`${weekKey}T00:00:00`);
		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		const month = new Intl.DateTimeFormat(lang, { month: 'short' }).format(sunday);
		return `${monday.getDate()}–${sunday.getDate()} ${month}`;
	}

	function formatWeight(kg: number): string {
		return Number.isInteger(kg) ? String(kg) : String(Math.round(kg * 10) / 10);
	}

	function bestLiftValue(weightKg: number, reps: number): string {
		return `${formatWeight(weightKg)} ${translate(lang, 'pr.kg')} × ${reps} ${translate(lang, 'pr.repsShort')}`;
	}

	function trendSigned(deltaKg: number): string {
		return `${deltaKg > 0 ? '+' : ''}${formatWeight(deltaKg)} ${translate(lang, 'pr.kg')}`;
	}

	onMount(() => {
		void loadExerciseIndexWithCustoms().then((index) => {
			indexById = new Map(index.map((item) => [item.id, item]));
		});
	});
</script>

<SeoHead title={translate(lang, 'nav.progress')} noindex />

<section class="content-page content-page--narrow pb-mobile-actions">
	<ScreenHeader
		title={translate(lang, 'nav.progress')}
		backHref="/auth"
		backLabelVisible
		preferHistoryBack
	/>

	<!-- Block 1: period segmented control -->
	<div class="progress-tabs" role="tablist" aria-label={translate(lang, 'progress.sectionTitle')}>
		{#each PROGRESS_PERIODS as p (p)}
			<button
				type="button"
				role="tab"
				aria-selected={period === p}
				class="progress-tab"
				class:progress-tab--active={period === p}
				onclick={() => (period = p)}
			>
				{periodLabel(p)}
			</button>
		{/each}
	</div>

	<div class="progress-blocks">
		<!-- Block 2: metric cards -->
		<div class="progress-stats">
			<div class="progress-stat panel">
				<p class="progress-stat__label">{translate(lang, 'progress.cardWorkouts')}</p>
				<p class="progress-stat__value tabular-nums">{overview.cards.workouts}</p>
				{#if workoutsDeltaText() != null}
					<p
						class="progress-stat__delta"
						class:progress-stat__delta--up={(overview.cards.workoutsDelta ?? 0) > 0}
						class:progress-stat__delta--down={(overview.cards.workoutsDelta ?? 0) < 0}
					>
						{workoutsDeltaText()}
					</p>
				{/if}
			</div>
			<div class="progress-stat panel">
				<p class="progress-stat__label">{translate(lang, 'progress.cardVolume')}</p>
				<p class="progress-stat__value tabular-nums">{formatKgInt(overview.cards.volumeKg)}<span class="progress-stat__unit">{translate(lang, 'pr.kg')}</span></p>
				{#if volumeDeltaText() != null}
					<p
						class="progress-stat__delta"
						class:progress-stat__delta--up={(overview.cards.volumeKgDelta ?? 0) > 0}
						class:progress-stat__delta--down={(overview.cards.volumeKgDelta ?? 0) < 0}
					>
						{volumeDeltaText()}
					</p>
				{/if}
			</div>
		</div>

		<!-- Block 3: volume by week bar chart -->
		<AppPanel class="text-left">
			<p class="progress-section-title">{translate(lang, 'progress.barTitle')}</p>
			{#if !hasData}
				<p class="progress-muted">{translate(lang, 'progress.empty')}</p>
				<a href="/" class="btn-primary progress-empty-cta">{translate(lang, 'progress.emptyCta')}</a>
			{:else}
				{#each overview.weeks as w (w.weekKey)}
					{@const isNow = w.weekKey === overview.streak.thisWeekKey}
					<div class="progress-week" class:progress-week--now={isNow}>
						<span class="progress-week__label">{weekRange(w.weekKey)}</span>
						<div class="progress-week__track">
							<div
								class="progress-week__fill"
								style:width="{Math.round((w.volumeKg / maxWeekVol) * 100)}%"
							></div>
						</div>
						<span class="progress-week__meta tabular-nums">
							{translate(lang, 'progress.barMeta', {
								kg: formatKgInt(w.volumeKg),
								n: w.workouts
							})}
						</span>
					</div>
				{/each}
			{/if}
		</AppPanel>

		<!-- Block 4: share by muscle groups (by sets) -->
		{#if overview.setShares.length > 0}
			<AppPanel class="text-left">
				<p class="progress-section-title">{translate(lang, 'progress.sharesTitle')}</p>
				{#each overview.setShares as part (part.bodyPart)}
					<div class="progress-part">
						<div class="progress-part__top">
							<span class="progress-part__label">
								{labelBodyPart(part.bodyPart, lang)}
								{#if part.bodyPart === laggingPart}
									<span class="progress-part__lag">{translate(lang, 'progress.lagging')}</span>
								{/if}
							</span>
							<span class="progress-part__pct tabular-nums">{part.sharePct}%</span>
						</div>
						<div class="progress-week__track">
							<div
								class="progress-week__fill"
								class:progress-week__fill--lag={part.bodyPart === laggingPart}
								style:width="{part.sharePct}%"
							></div>
						</div>
					</div>
				{/each}
			</AppPanel>
		{/if}

		<!-- Block 5: best lifts -->
		{#if overview.bestLifts.length > 0}
			<AppPanel class="text-left">
				<p class="progress-section-title">
					{translate(lang, 'progress.bestLiftsNew', { n: period === 'all' ? '∞' : period })}
				</p>
				<p class="progress-panel-hint">{translate(lang, 'progress.bestLiftsHintNew')}</p>
				<ul class="progress-lifts">
					{#each overview.bestLifts as lift (lift.exerciseId)}
						{@const meta = indexById.get(lift.exerciseId)}
						<li class="progress-lift">
							<span class="progress-lift__name">{meta
									? exerciseName(meta, lang)
									: lift.exerciseId}</span>
							<span class="progress-lift__value tabular-nums">
								{bestLiftValue(lift.weightKg, lift.reps)}
							</span>
						</li>
					{/each}
				</ul>
			</AppPanel>
		{/if}

		<!-- Block 6: exercise progress with colored pills -->
		{#if overview.trends.length > 0}
			<AppPanel class="text-left">
				<p class="progress-section-title">{translate(lang, 'progress.trendsNew')}</p>
				<p class="progress-panel-hint">
					{translate(lang, 'progress.trendsHintNew', { n: period === 'all' ? 30 : period })}
				</p>
				<ul class="progress-trends">
					{#each overview.trends as row (row.exerciseId)}
						{@const meta = indexById.get(row.exerciseId)}
						<li class="progress-trend">
							<span class="progress-trend__name">{meta
									? exerciseName(meta, lang)
									: row.exerciseId}</span>
							<span
								class="progress-trend__pill"
								class:progress-trend__pill--up={row.deltaKg > 0}
								class:progress-trend__pill--down={row.deltaKg < 0}
							>
								{trendSigned(row.deltaKg)}
							</span>
						</li>
					{/each}
				</ul>
			</AppPanel>
		{/if}
	</div>
</section>

<style>
	.progress-blocks {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	/* Block 1: segmented control on the 16px inset, violet active plate. */
	.progress-tabs {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
		padding: 4px;
		margin: 0 0 16px;
		border-radius: var(--radius-control, 16px);
		background: var(--color-surface-muted, #2c2c2e);
	}
	.progress-tab {
		min-height: 40px;
		border: 0;
		border-radius: calc(var(--radius-control, 16px) - 4px);
		background: transparent;
		color: var(--color-muted, #8e8e93);
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease;
	}
	.progress-tab:hover {
		color: var(--color-ink, #ffffff);
	}
	.progress-tab--active {
		background: var(--color-accent, #a259ff);
		color: var(--color-accent-ink, #ffffff);
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.3),
			inset 0 0 0 1px rgba(255, 255, 255, 0.06);
	}
	.progress-tab--active:hover {
		color: var(--color-accent-ink, #ffffff);
	}
	/* Block 2: metric cards in a 2-up row, 16px inset each. */
	.progress-stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	.progress-stat {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 16px;
		/* Enable container-query font stepping so the 48px display value never
		   overflows the half-width card on narrow phones. */
		container-type: inline-size;
	}
	.progress-stat__label {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1rem;
		font-weight: 500;
		opacity: 0.75;
	}
	/*
	 * Display digits scale with the CARD width (cqw), not fixed breakpoints:
	 * `217 927 кг` measures ~4.4em incl. unit, so ~22cqw always fits the content
	 * box at any phone width (320 / SE 375 / Pro Max) while capping at 48px on
	 * wider cards. Guarantees no horizontal overflow.
	 */
	.progress-stat__value {
		margin: 0;
		font-size: min(3rem, 22cqw); /* 48px cap; auto-fits narrow cards */
		line-height: 1.17; /* 56/48 — scales with font-size */
		font-weight: 800;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}
	/* Unit suffix ("кг") scaled in em so it shrinks together with the digits.
	   No literal space between number and unit — the margin does that job. */
	.progress-stat__unit {
		margin-left: 0.14em;
		font-size: 0.32em;
		line-height: 1;
		font-weight: 600;
		letter-spacing: 0;
		opacity: 0.6;
	}
	.progress-stat__delta {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1rem;
		font-weight: 600;
		opacity: 0.85;
	}
	.progress-stat__delta--up {
		color: var(--color-success, #34d399);
		opacity: 1;
	}
	.progress-stat__delta--down {
		color: var(--color-danger, #f87171);
		opacity: 1;
	}
	/* Block 3 titles / hints. */
	.progress-section-title {
		margin: 0 0 12px;
		font-size: 0.75rem;
		line-height: 1rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.75;
	}
	.progress-panel-hint {
		margin: -4px 0 12px;
		font-size: 0.75rem;
		line-height: 1rem;
		opacity: 0.7;
	}
	.progress-muted {
		margin: 0;
		opacity: 0.75;
	}
	.progress-empty-cta {
		display: inline-flex;
		margin-top: 12px;
		min-height: 3rem;
		align-items: center;
	}
	/* Block 3: week bars — purple fill, right-aligned exact meta. */
	.progress-week {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}
	.progress-week__label {
		font-size: 0.8125rem;
		font-weight: 600;
		white-space: nowrap;
		opacity: 0.8;
	}
	.progress-week--now .progress-week__label {
		color: var(--color-accent, #a259ff);
		opacity: 1;
	}
	.progress-week__track {
		flex: 1;
		height: 10px;
		border-radius: var(--radius-sm, 6px);
		background: var(--color-border, #3a3a3c);
		overflow: hidden;
	}
	.progress-week__fill {
		height: 100%;
		background: var(--color-accent, #a259ff);
	}
	.progress-week__fill--lag {
		background: var(--color-danger, #f87171);
	}
	.progress-week__meta {
		font-size: 0.75rem;
		line-height: 1rem;
		font-weight: 500;
		white-space: nowrap;
		opacity: 0.8;
	}
	/* Block 4: muscle share rows. */
	.progress-part {
		margin-bottom: 10px;
	}
	.progress-part__top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.progress-part__label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		min-width: 0;
	}
	.progress-part__lag {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		border-radius: var(--radius-pill, 999px);
		background: color-mix(in srgb, var(--color-danger) 14%, transparent);
		color: var(--color-danger, #f87171);
		font-size: 0.6875rem;
		font-weight: 700;
		line-height: 1.2;
	}
	.progress-part__pct {
		flex-shrink: 0;
	}
	/* Block 5: best lifts. */
	.progress-lifts {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.progress-lift {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 0.875rem;
	}
	.progress-lift__name {
		min-width: 0;
		overflow: hidden;
		font-weight: 600;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.progress-lift__value {
		flex-shrink: 0;
		opacity: 0.8;
	}
	/* Block 6: exercise progress with colored pills. */
	.progress-trends {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.progress-trend {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		font-size: 0.875rem;
	}
	.progress-trend__name {
		min-width: 0;
		overflow: hidden;
		font-weight: 600;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.progress-trend__pill {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		padding: 4px 10px;
		border-radius: var(--radius-pill, 999px);
		font-size: 0.75rem;
		line-height: 1rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.progress-trend__pill--up {
		background: var(--color-success-bg, rgba(52, 211, 153, 0.16));
		color: var(--color-success, #34d399);
	}
	.progress-trend__pill--down {
		background: color-mix(in srgb, var(--color-danger) 14%, transparent);
		color: var(--color-danger, #f87171);
	}
</style>