<script lang="ts">
	import '$lib/styles/blocks/progress.css';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import HelpButton from '$lib/components/HelpButton.svelte';
	import HelpPanel from '$lib/components/HelpPanel.svelte';
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
	let helpOpen = $state(false);

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
	>
		{#snippet actions()}
			<HelpButton label={translate(lang, 'progress.help')} bind:open={helpOpen} />
		{/snippet}
	</ScreenHeader>

	<HelpPanel
		open={helpOpen}
		title={translate(lang, 'progress.helpTitle')}
		body={translate(lang, 'progress.helpBody')}
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
