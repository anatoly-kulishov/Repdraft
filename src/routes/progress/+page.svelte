<script lang="ts">
	import AppPanel from '$lib/components/AppPanel.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelBodyPart } from '$lib/domain/labels.ru';
	import { computeProgressOverview } from '$lib/domain/progressOverview';
	import { loadExerciseIndexWithCustoms } from '$lib/data/exerciseIndexWithCustoms';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { onMount } from 'svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';
	import { questState } from '$lib/stores/quest';

	let lang = $derived($resolvedLocale);
	let indexById = $state(new Map<string, ExerciseIndexItem>());
	let overview = $derived(
		computeProgressOverview($live.history, new Date(), (id) => indexById.get(id)?.body_part ?? null)
	);
	let maxWeekVol = $derived(Math.max(1, ...overview.weeks.map((w) => w.volumeKg)));
	let weeklyGoal = $derived(Math.max(1, $questState.weeklyGoal));
	let thisWeekDone = $derived(overview.streak.thisWeekCount);
	let goalMet = $derived(thisWeekDone >= weeklyGoal);
	// Small samples make a "lagging" flag noisy: require enough groups and workouts.
	let laggingPart = $derived(
		overview.bodyParts.length >= 3 && overview.workouts30d >= 4
			? overview.laggingBodyPart
			: null
	);

	function formatWeight(kg: number): string {
		return Number.isInteger(kg) ? String(kg) : String(Math.round(kg * 10) / 10);
	}

	function weekLabel(weekKey: string): string {
		if (weekKey === overview.streak.thisWeekKey) return translate(lang, 'progress.weekNow');
		return `${weekKey.slice(8, 10)}.${weekKey.slice(5, 7)}`;
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
	<p class="progress-lead">{translate(lang, 'progress.lead')}</p>
	<div class="progress-blocks">
		<div class="progress-stats">
			<div class="progress-stat panel">
				<p class="progress-stat__label">{translate(lang, 'progress.workouts30d')}</p>
				<p class="progress-stat__value tabular-nums">{overview.workouts30d}</p>
			</div>
			<div class="progress-stat panel">
				<p class="progress-stat__label">{translate(lang, 'progress.volume30d')}</p>
				<p class="progress-stat__value tabular-nums">{overview.volume30dKg}</p>
				{#if overview.workouts30d > 0}
					<p class="progress-stat__meta">
						{translate(lang, 'progress.avgPerWorkout', { kg: overview.avgVolumePerWorkoutKg })}
					</p>
				{/if}
			</div>
		</div>

		{#if overview.weeks.length > 0}
			<AppPanel class="text-left">
				<p class="progress-section-title">{translate(lang, 'progress.streakTitle')}</p>
				<div class="progress-streak">
					<p class="progress-streak__value tabular-nums">
						{overview.streak.streakWeeks > 0
							? translate(lang, 'progress.streakValue', { n: overview.streak.streakWeeks })
							: translate(lang, 'progress.streakNone')}
					</p>
					<p class="progress-streak__goal" class:progress-streak__goal--met={goalMet}>
						{goalMet
							? translate(lang, 'progress.goalMet')
							: translate(lang, 'progress.weekGoal', { done: thisWeekDone, goal: weeklyGoal })}
					</p>
				</div>
				<p class="progress-streak__hint">{translate(lang, 'progress.streakHint')}</p>
			</AppPanel>
		{/if}

		<AppPanel class="text-left">
			<p class="progress-section-title">{translate(lang, 'progress.volumeByWeek')}</p>
			{#if overview.weeks.length === 0}
				<p class="progress-muted">{translate(lang, 'progress.empty')}</p>
				<a href="/" class="btn-primary progress-empty-cta">{translate(lang, 'progress.emptyCta')}</a>
			{:else}
				{#each overview.weeks as w (w.weekKey)}
					{@const isNow = w.weekKey === overview.streak.thisWeekKey}
					<div class="progress-week" class:progress-week--now={isNow}>
						<span class="progress-week__label tabular-nums">{weekLabel(w.weekKey)}</span>
						<div class="progress-week__track">
							<div
								class="progress-week__fill"
								style:width="{Math.round((w.volumeKg / maxWeekVol) * 100)}%"
							></div>
						</div>
						<span class="progress-week__meta tabular-nums">{w.volumeKg} · {w.workouts}</span>
					</div>
				{/each}
			{/if}
		</AppPanel>

		{#if overview.bestLifts.length > 0}
			<AppPanel class="text-left">
				<p class="progress-section-title">{translate(lang, 'progress.bestLifts')}</p>
				<p class="progress-panel-hint">{translate(lang, 'progress.bestLiftsHint')}</p>
				<ul class="progress-lifts">
					{#each overview.bestLifts as lift (lift.exerciseId)}
						{@const meta = indexById.get(lift.exerciseId)}
						<li class="progress-lift">
							<span class="progress-lift__name">{meta
									? exerciseName(meta, lang)
									: lift.exerciseId}</span>
							<span class="progress-lift__value tabular-nums">
								{formatWeight(lift.weightKg)}
								{translate(lang, 'pr.kg')}
								×
								{lift.reps}
								{translate(lang, 'pr.repsShort')}
							</span>
						</li>
					{/each}
				</ul>
			</AppPanel>
		{/if}

		{#if overview.bodyParts.length > 0}
			<AppPanel class="text-left">
				<p class="progress-section-title">{translate(lang, 'progress.bodyParts')}</p>
				{#each overview.bodyParts as part (part.bodyPart)}
					<div class="progress-part">
						<div class="progress-part__top">
							<span class="progress-part__label">
								{labelBodyPart(part.bodyPart, lang)}
								{#if part.bodyPart === laggingPart}
									<span class="progress-part__lag">{translate(lang, 'progress.lagging')}</span>
								{/if}
							</span>
							<span class="tabular-nums">{part.sharePct}%</span>
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

		{#if overview.trends.length > 0}
			<AppPanel class="text-left">
				<p class="progress-section-title">{translate(lang, 'progress.trends')}</p>
				{#each overview.trends as row (row.exerciseId)}
					{@const meta = indexById.get(row.exerciseId)}
					<p class="progress-muted">
						{meta ? exerciseName(meta, lang) : row.exerciseId}
						· {row.deltaKg > 0 ? '+' : ''}{row.deltaKg} {translate(lang, 'pr.kg')}
					</p>
				{/each}
			</AppPanel>
		{/if}
	</div>
</section>

<style>
	.progress-lead {
		margin: 0 0 1rem;
		font-size: 0.9375rem;
		opacity: 0.8;
		line-height: 1.4;
	}
	.progress-stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
	}
	.progress-blocks {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.progress-stat__meta {
		margin: 0.2rem 0 0;
		font-size: 0.75rem;
		opacity: 0.7;
	}
	.progress-panel-hint {
		margin: -0.35rem 0 0.6rem;
		font-size: 0.75rem;
		opacity: 0.7;
	}
	.progress-streak {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.4rem 0.75rem;
	}
	.progress-streak__value {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 800;
	}
	.progress-streak__goal {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		opacity: 0.8;
	}
	.progress-streak__goal--met {
		color: var(--color-accent);
		opacity: 1;
	}
	.progress-streak__hint {
		margin: 0.35rem 0 0;
		font-size: 0.75rem;
		opacity: 0.65;
	}
	.progress-lifts {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.progress-lift {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
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
	}
	.progress-week--now .progress-week__label {
		color: var(--color-accent);
		opacity: 1;
	}
	.progress-stat {
		padding: 0.85rem 1rem;
	}
	.progress-stat__label {
		margin: 0;
		font-size: 0.75rem;
		opacity: 0.75;
	}
	.progress-stat__value {
		margin: 0.25rem 0 0;
		font-size: 1.5rem;
		font-weight: 800;
	}
	.progress-section-title {
		margin: 0 0 0.65rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.75;
	}
	.progress-muted {
		margin: 0;
		opacity: 0.75;
	}
	.progress-empty-cta {
		display: inline-flex;
		margin-top: 0.75rem;
		min-height: 3rem;
		align-items: center;
	}
	.progress-week {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.65rem;
	}
	.progress-week__label {
		width: 3rem;
		font-size: 0.8125rem;
		font-weight: 600;
		opacity: 0.75;
	}
	.progress-week__track {
		flex: 1;
		height: 0.625rem;
		border-radius: var(--radius-sm, 6px);
		background: var(--color-border);
		overflow: hidden;
	}
	.progress-week__fill {
		height: 100%;
		background: var(--color-accent);
	}
	.progress-week__fill--lag {
		background: var(--color-danger);
	}
	.progress-part {
		margin-bottom: 0.75rem;
	}
	.progress-part__top {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.3rem;
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.progress-part__label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
		min-width: 0;
	}
	.progress-part__lag {
		display: inline-flex;
		align-items: center;
		padding: 0.12rem 0.4rem;
		border-radius: var(--radius-sm, 6px);
		background: color-mix(in srgb, var(--color-danger) 14%, transparent);
		color: var(--color-danger);
		font-size: 0.6875rem;
		font-weight: 700;
		line-height: 1.2;
	}
	.progress-week__meta {
		width: 4.5rem;
		text-align: right;
		font-size: 0.75rem;
		opacity: 0.75;
	}
</style>
