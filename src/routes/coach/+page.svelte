<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { buildCoachHints, suggestPlanReplace } from '$lib/domain/coachHints';
	import { computeProgressOverview } from '$lib/domain/progressOverview';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelBodyPart } from '$lib/domain/labels.ru';
	import { loadExerciseIndexWithCustoms } from '$lib/data/exerciseIndexWithCustoms';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { translate, translateError } from '$lib/i18n/messages';
	import { pluralRu } from '$lib/i18n/plural';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { appendExerciseToHomePlan, replaceExerciseInHomePlan } from '$lib/workout/planPatch';
	import { homeNextPlan } from '$lib/stores/homeNextPlan';
	import { live } from '$lib/stores/live';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);
	let indexById = $state(new Map<string, ExerciseIndexItem>());
	let indexReady = $state(false);

	onMount(() => {
		void loadExerciseIndexWithCustoms()
			.then((index) => {
				indexById = new Map(index.map((ex) => [ex.id, ex]));
			})
			.finally(() => {
				// Even a failed load must not leave the page stuck on the skeleton.
				indexReady = true;
			});
	});

	let homePlan = $derived.by(() => {
		const list = $plans;
		const pinned = $homeNextPlan;
		return (pinned ? list.find((p) => p.id === pinned) : null) ?? list[0] ?? null;
	});

	let overview = $derived(
		computeProgressOverview($live.history, new Date(), (id) => indexById.get(id)?.body_part ?? null)
	);

	let reviewedLine = $derived(
		lang === 'ru'
			? translate(lang, 'coach.reviewed', {
					n: `${overview.workouts30d} ${pluralRu(overview.workouts30d, [
						'тренировку',
						'тренировки',
						'тренировок'
					])}`
				})
			: translate(lang, 'coach.reviewed', {
					n: `${overview.workouts30d} ${overview.workouts30d === 1 ? 'workout' : 'workouts'}`
				})
	);

	let replace = $derived.by(() => {
		if (!homePlan || indexById.size === 0 || !overview.laggingBodyPart) return null;
		return suggestPlanReplace(
			homePlan.exercises.map((ex) => ex.exerciseId),
			[overview.laggingBodyPart],
			[...indexById.values()],
			(id) => indexById.get(id)?.body_part ?? null
		);
	});

	let replaceSharePct = $derived.by(() => {
		if (!replace) return null;
		return overview.bodyParts.find((part) => part.bodyPart === replace.bodyPart)?.sharePct ?? null;
	});

	let hints = $derived.by(() => {
		const finished = $live.history
			.filter((s) => s.finishedAt)
			.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
		const focus = finished[0];
		if (!focus || indexById.size === 0) return [];
		const catalog = [...indexById.values()];
		const bodyPartFor = (id: string) => indexById.get(id)?.body_part ?? null;
		return buildCoachHints(focus, finished, catalog, bodyPartFor);
	});

	async function replaceHint() {
		if (!replace) return;
		try {
			const planId = await replaceExerciseInHomePlan(replace.fromExerciseId, replace.toExerciseId);
			if (!planId) {
				toasts.show(translate(lang, 'coach.noPlan'), 'error');
				return;
			}
			toasts.show(translate(lang, 'coach.replaced'), 'success');
			await goto(`/builder/${planId}`);
		} catch (err) {
			toasts.show(translateError(lang, err, 'common.error'), 'error');
		}
	}

	async function addHint(exerciseId: string) {
		try {
			const planId = await appendExerciseToHomePlan(exerciseId);
			if (!planId) {
				toasts.show(translate(lang, 'coach.noPlan'), 'error');
				return;
			}
			toasts.show(translate(lang, 'coach.added'), 'success');
			await goto(`/builder/${planId}`);
		} catch (err) {
			toasts.show(translateError(lang, err, 'common.error'), 'error');
		}
	}
</script>

<SeoHead title={translate(lang, 'nav.coach')} noindex />

<section class="content-page content-page--narrow pb-mobile-actions">
	<ScreenHeader
		title={translate(lang, 'nav.coach')}
		backHref="/auth"
		backLabelVisible
		preferHistoryBack
	/>
	<p class="coach-lead">{translate(lang, 'coach.lead')}</p>
	{#if overview.workouts30d > 0}
		<p class="coach-lead">{reviewedLine}</p>
	{/if}
	{#if !indexReady}
		<PageSkeleton rows={2} />
	{:else if hints.length === 0 && !replace}
		<AppPanel class="text-left">
			<p class="coach-muted">
				{translate(lang, overview.workouts30d === 0 ? 'coach.empty' : 'coach.nothingYet')}
			</p>
			<a href="/" class="btn-primary coach-empty-cta">{translate(lang, 'coach.emptyCta')}</a>
		</AppPanel>
	{:else}
		{#each hints as hint (hint.id)}
			{@const meta = indexById.get(hint.exerciseId)}
			<AppPanel class="coach-card text-left">
				<p class="coach-card__title">
					{meta ? exerciseName(meta, lang) : hint.exerciseId}
				</p>
				<p class="coach-card__meta">
					{labelBodyPart(hint.bodyPart, lang)} · {translate(lang, hint.reasonKey)}
				</p>
				<AppButton onclick={() => void addHint(hint.exerciseId)}>
					{translate(lang, 'coach.addToPlan')}
				</AppButton>
			</AppPanel>
		{/each}
		{#if replace}
			{@const fromMeta = indexById.get(replace.fromExerciseId)}
			{@const toMeta = indexById.get(replace.toExerciseId)}
			<AppPanel class="coach-card text-left">
				<p class="coach-card__title">
					{fromMeta ? exerciseName(fromMeta, lang) : replace.fromExerciseId}
				</p>
				<p class="coach-card__meta">
					→ {toMeta ? exerciseName(toMeta, lang) : replace.toExerciseId}
				</p>
				<p class="coach-card__meta">{labelBodyPart(replace.bodyPart, lang)}</p>
				<p class="coach-why">
					{replaceSharePct != null
						? translate(lang, 'coach.replaceWhy', {
								part: labelBodyPart(replace.bodyPart, lang),
								pct: replaceSharePct
							})
						: translate(lang, 'coach.replaceWhyGeneric')}
				</p>
				<p class="coach-why">{translate(lang, 'coach.replaceWhat')}</p>
				<AppButton onclick={() => void replaceHint()}>{translate(lang, 'coach.replace')}</AppButton>
			</AppPanel>
		{/if}
	{/if}
</section>

<style>
	.coach-lead {
		margin: 0 0 1rem;
		font-size: 0.9375rem;
		opacity: 0.8;
		line-height: 1.4;
	}
	.coach-muted {
		margin: 0;
		opacity: 0.75;
		line-height: 1.4;
	}
	.coach-empty-cta {
		display: inline-flex;
		margin-top: 0.75rem;
		min-height: 3rem;
		align-items: center;
	}
	:global(.coach-card) {
		margin-bottom: 0.75rem;
	}
	.coach-card__title {
		margin: 0;
		font-weight: 800;
		font-size: 1.0625rem;
	}
	.coach-card__meta {
		margin: 0.35rem 0 0.75rem;
		font-size: 0.875rem;
		opacity: 0.75;
	}
	.coach-why {
		margin: 0 0 0.45rem;
		font-size: 0.8125rem;
		line-height: 1.35;
		opacity: 0.85;
	}
	.coach-why:last-of-type {
		margin-bottom: 0.85rem;
	}
</style>
