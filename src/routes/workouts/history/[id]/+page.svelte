<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import { completedSetCount, sessionDurationMs } from '$lib/domain/session';
	import type { ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import { formatDurationMs, formatLongDate } from '$lib/i18n/format';
	import { translate, translateError } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { live } from '$lib/stores/live';
	import { toasts } from '$lib/stores/toasts';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { ChevronRight, Trash2 } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);
	let session = $state<WorkoutSession | null>(null);
	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let missing = $state(false);
	let loading = $state(true);
	let deleting = $state(false);
	let fromPath = $derived($page.url.pathname);

	onMount(() => {
		void (async () => {
			const id = $page.params.id;
			if (!id) {
				missing = true;
				loading = false;
				return;
			}
			const found = await live.getFinishedSession(id);
			if (!found) missing = true;
			else session = found;
			const index = await loadExerciseIndex();
			indexById = new Map(index.map((ex) => [ex.id, ex]));
			loading = false;
		})();
	});

	async function onDeleteSession() {
		if (!session) return;
		if (!confirm(translate(lang, 'workouts.confirmDeleteSession', { name: session.planName }))) {
			return;
		}
		deleting = true;
		try {
			await live.removeFromHistory(session.id);
			toasts.show(translate(lang, 'workouts.sessionDeleted'), 'info');
			void goto('/workouts');
		} catch (err) {
			toasts.show(translateError(lang, err, 'workouts.sessionDeleteFail'), 'error');
			deleting = false;
		}
	}
</script>

{#snippet deleteHeaderAction()}
	<button
		type="button"
		class="btn-ghost is-danger"
		disabled={deleting}
		aria-busy={deleting}
		aria-label={translate(lang, 'workouts.deleteSession')}
		title={translate(lang, 'workouts.deleteSession')}
		onclick={() => void onDeleteSession()}
	>
		{#if deleting}
			<Spinner size="sm" block={false} />
		{:else}
			<LucideIcon icon={Trash2} size={ICON_BUTTON} />
		{/if}
	</button>
{/snippet}

<svelte:head>
	<title
		>{session ? session.planName : translate(lang, 'workouts.historyDetail')} · Repdraft</title
	>
</svelte:head>

{#if loading}
	<PageSkeleton rows={4} />
{:else if missing || !session}
	<EmptyState
		title={translate(lang, 'live.noPlan')}
		description={translate(lang, 'workouts.emptyDesc')}
		actionHref="/workouts"
		actionLabel={translate(lang, 'nav.workouts')}
	/>
{:else}
	<section class="content-page content-page--narrow soft-enter history-detail">
		<div class="md:hidden">
			<ScreenHeader
				title={session.planName}
				backHref="/workouts"
				actions={deleteHeaderAction}
			/>
		</div>
		<div class="subroute-desktop-head hidden md:block">
			<SubrouteBack href="/workouts" label={translate(lang, 'builder.backWorkouts')} />
			<div class="history-detail__title-row">
				<h1 class="page-title">{session.planName}</h1>
				<button
					type="button"
					class="btn-ghost is-danger history-detail__delete inline-flex min-h-11 shrink-0 items-center gap-2 px-2"
					disabled={deleting}
					aria-busy={deleting}
					onclick={() => void onDeleteSession()}
				>
					{#if deleting}
						<Spinner size="sm" block={false} />
						{translate(lang, 'auth.wait')}
					{:else}
						<LucideIcon icon={Trash2} size={ICON_SMALL} />
						{translate(lang, 'workouts.deleteSession')}
					{/if}
				</button>
			</div>
		</div>
		<p class="page-lead mt-1 lg:mt-0">
			{formatLongDate(session.finishedAt ?? session.startedAt, lang)} · {formatDurationMs(
				sessionDurationMs(session)
			)} · {translate(lang, 'workouts.historySets', { n: completedSetCount(session) })}
		</p>

		<ul class="history-exercise-list">
			{#each session.exercises as ex (ex.exerciseId)}
				{@const meta = indexById.get(ex.exerciseId) ?? null}
				{@const done = ex.sets.filter((s) => s.completed)}
				<li class="history-exercise">
					{#if meta}
						<a
							class="history-exercise__head"
							href={`/exercise/${meta.id}?from=${encodeURIComponent(fromPath)}`}
						>
							<span class="media-well history-exercise__thumb">
								<img
									src={`/${meta.image}`}
									alt=""
									width="180"
									height="180"
									loading="lazy"
									decoding="async"
								/>
							</span>
							<div class="workout-preview-row-body">
								<p class="workout-preview-row-title">{exerciseName(meta, lang)}</p>
								<p class="workout-preview-row-sub">
									{labelTarget(meta.target, lang)} · {labelEquipment(meta.equipment, lang)}
								</p>
							</div>
							<span class="workout-preview-chevron" aria-hidden="true">
								<LucideIcon icon={ChevronRight} size={ICON_BUTTON} />
							</span>
						</a>
					{:else}
						<div class="history-exercise__head is-static">
							<span
								class="media-well history-exercise__thumb is-placeholder"
								aria-hidden="true"
							></span>
							<div class="workout-preview-row-body">
								<p class="workout-preview-row-title">{ex.exerciseId}</p>
							</div>
						</div>
					{/if}

					{#if done.length > 0}
						<ul
							class="history-exercise__sets"
							class:history-exercise__sets--grid={done.length >= 4}
						>
							{#each done as set, i (i)}
								<li class="history-exercise__set tabular-nums">
									<span class="history-exercise__set-i">{i + 1}</span>
									<span class="history-exercise__set-weight">{set.weightKg ?? '—'} kg</span>
									<span class="history-exercise__set-reps">× {set.reps ?? '—'}</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="history-exercise__empty">{translate(lang, 'workouts.noLoggedSets')}</p>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
