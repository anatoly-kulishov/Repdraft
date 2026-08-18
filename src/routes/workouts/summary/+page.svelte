<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY } from '$lib/components/icons/sizes';
	import {
		completedExerciseCount,
		completedSetCount,
		sessionDurationMs
	} from '$lib/domain/session';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import type { ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import { formatDurationMs } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { live } from '$lib/stores/live';
	import { CircleCheck } from '@lucide/svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);
	let session = $state<WorkoutSession | null>(null);
	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let missing = $state(false);
	let loading = $state(true);

	type PreviewItem = {
		ex: WorkoutSession['exercises'][number];
		completedSets: number;
		lastSet: WorkoutSession['exercises'][number]['sets'][number];
	};

	let previewExercises = $derived(
		!session
			? []
			: session.exercises
					.map((ex) => {
						const completed = ex.sets.filter((s) => s.completed);
						if (completed.length === 0) return null;

						return {
							ex,
							completedSets: completed.length,
							lastSet: completed[completed.length - 1]
						} satisfies PreviewItem;
					})
					.filter((v): v is PreviewItem => v !== null)
					.slice(0, 3)
	);

	let moreCount = $derived(
		!session
			? 0
			: Math.max(
					0,
					session.exercises.filter((ex) => ex.sets.some((s) => s.completed)).length -
						previewExercises.length
				)
	);

	onMount(() => {
		void (async () => {
			const id = $page.url.searchParams.get('id');
			if (!id) {
				missing = true;
				loading = false;
				return;
			}
			const [found, index] = await Promise.all([live.getFinishedSession(id), loadExerciseIndex()]);
			if (!found) missing = true;
			else session = found;
			indexById = new Map(index.map((ex) => [ex.id, ex]));
			loading = false;
		})();
	});
</script>

<svelte:head>
	<title>{translate(lang, 'summary.title')} · Repdraft</title>
</svelte:head>

{#if loading}
	<PageSkeleton variant="summary" rows={3} />
{:else if missing || !session}
	<EmptyState
		title={translate(lang, 'live.noPlan')}
		description={translate(lang, 'workouts.emptyDesc')}
		actionHref="/workouts"
		actionLabel={translate(lang, 'nav.workouts')}
	/>
{:else}
	<section class="summary-page content-page content-page--narrow soft-enter pb-mobile-actions text-center lg:pb-0">
		<div class="md:hidden text-left">
			<ScreenHeader title={translate(lang, 'summary.title')} backHref="/workouts" />
		</div>
		<div class="subroute-desktop-head hidden text-left md:block">
			<SubrouteBack href="/workouts" label={translate(lang, 'builder.backWorkouts')} />
		</div>

		<div class="summary-hero">
			<div class="summary-check" aria-hidden="true">
				<LucideIcon icon={CircleCheck} size={ICON_PRIMARY + 12} />
			</div>
			<h1 class="summary-hero__title">{translate(lang, 'summary.title')}</h1>
			<p class="summary-hero__plan">{session.planName}</p>
		</div>

		<dl class="summary-stats">
			<div class="summary-stat">
				<dt class="summary-stat__label">{translate(lang, 'summary.duration')}</dt>
				<dd class="summary-stat__value">
					{formatDurationMs(sessionDurationMs(session), { extended: true })}
				</dd>
			</div>
			<div class="summary-stat">
				<dt class="summary-stat__label">{translate(lang, 'summary.exercises')}</dt>
				<dd class="summary-stat__value">{completedExerciseCount(session)}</dd>
			</div>
			<div class="summary-stat">
				<dt class="summary-stat__label">{translate(lang, 'summary.sets')}</dt>
				<dd class="summary-stat__value">{completedSetCount(session)}</dd>
			</div>
		</dl>

			{#if previewExercises.length > 0}
				<div class="summary-exercises-preview" aria-hidden="true">
					<p class="summary-exercises-preview__heading">
						{translate(lang, 'summary.previewExercises')}
					</p>
					<div class="summary-exercises-preview__list">
						{#each previewExercises as item (item.ex.exerciseId)}
							{@const meta = indexById.get(item.ex.exerciseId) ?? null}
							{@const ex = item.ex}
							{@const last = item.lastSet}
							<div class="summary-exercises-preview__item">
								<p class="summary-exercises-preview__name">
									{meta ? exerciseName(meta, lang) : ex.exerciseId}
								</p>
								<p class="summary-exercises-preview__meta">
									{#if last?.weightKg != null}
										{last.weightKg} kg × {last.reps ?? '—'}
									{:else}
										{last?.reps ?? '—'} {translate(lang, 'live.reps').toLowerCase()}
									{/if}
									<span class="summary-exercises-preview__sets">
										· {item.completedSets} {translate(lang, 'summary.sets')}
									</span>
								</p>
							</div>
						{/each}
					</div>
					{#if moreCount > 0}
						<p class="summary-exercises-preview__more">
							{translate(lang, 'summary.moreExercises', { n: moreCount })}
						</p>
					{/if}
				</div>
			{/if}

		<div class="summary-actions summary-page__done-inline">
			<a class="btn-primary btn-block min-h-12" href="/workouts?tab=history"
				>{translate(lang, 'summary.done')}</a
			>
			<a class="btn-ghost btn-block min-h-11" href={`/workouts/history/${session.id}`}
				>{translate(lang, 'summary.openSession')}</a
			>
		</div>

		<div class="sticky-actions sticky-actions--stack summary-page__done-sticky lg:hidden">
			<div class="sticky-actions__inner summary-actions">
				<a class="btn-primary btn-block min-h-12" href="/workouts?tab=history"
					>{translate(lang, 'summary.done')}</a
				>
				<a class="btn-ghost btn-block min-h-11" href={`/workouts/history/${session.id}`}
					>{translate(lang, 'summary.openSession')}</a
				>
			</div>
		</div>
	</section>
{/if}
