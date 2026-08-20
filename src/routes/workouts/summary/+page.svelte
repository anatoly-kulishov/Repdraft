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
	import type { ExerciseIndexItem, LoggedSet, WorkoutSession } from '$lib/domain/types';
	import { formatDurationMs } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { live } from '$lib/stores/live';
	import { CircleCheck } from '@lucide/svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	const GUEST_SYNC_DISMISS_KEY = 'repdraft:guest-sync-hint-dismissed';

	let lang = $derived($resolvedLocale);
	let session = $state<WorkoutSession | null>(null);
	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let missing = $state(false);
	let loading = $state(true);
	let showAllExercises = $state(false);
	let guestHintDismissed = $state(false);

	const PREVIEW_LIMIT = 3;

	type PreviewItem = {
		ex: WorkoutSession['exercises'][number];
		completed: LoggedSet[];
	};

	let isGuest = $derived($auth.ready && $auth.configured && !$auth.user);
	let showGuestSyncHint = $derived(isGuest && !guestHintDismissed && !loading && session != null);

	let loggedExercises = $derived(
		!session
			? []
			: session.exercises
					.map((ex) => {
						const completed = ex.sets.filter((s) => s.completed);
						if (completed.length === 0) return null;
						return { ex, completed } satisfies PreviewItem;
					})
					.filter((v): v is PreviewItem => v !== null)
	);

	let previewExercises = $derived(
		showAllExercises ? loggedExercises : loggedExercises.slice(0, PREVIEW_LIMIT)
	);

	let moreCount = $derived(
		showAllExercises ? 0 : Math.max(0, loggedExercises.length - PREVIEW_LIMIT)
	);

	function formatSet(set: LoggedSet): string {
		if (set.weightKg != null) return `${set.weightKg} kg × ${set.reps ?? '—'}`;
		return `${set.reps ?? '—'} ${translate(lang, 'live.reps').toLowerCase()}`;
	}

	let authNextHref = $derived(
		session
			? `/auth?next=${encodeURIComponent(`/workouts/history/${session.id}`)}`
			: '/auth?next=%2F'
	);

	function dismissGuestHint() {
		guestHintDismissed = true;
		try {
			localStorage.setItem(GUEST_SYNC_DISMISS_KEY, '1');
		} catch {
			/* ignore */
		}
	}

	onMount(() => {
		try {
			guestHintDismissed = localStorage.getItem(GUEST_SYNC_DISMISS_KEY) === '1';
		} catch {
			guestHintDismissed = false;
		}
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
			<div class="summary-exercises-preview">
				<p class="summary-exercises-preview__heading">
					{translate(lang, 'summary.previewExercises')}
				</p>
				<div class="summary-exercises-preview__list">
					{#each previewExercises as item, i (item.ex.exerciseId + '-' + i)}
						{@const meta = indexById.get(item.ex.exerciseId) ?? null}
						{@const ex = item.ex}
						<div class="summary-exercises-preview__item">
							<p class="summary-exercises-preview__name">
								{meta ? exerciseName(meta, lang) : ex.exerciseId}
							</p>
							<p class="summary-exercises-preview__meta">
								{#each item.completed as set, si (si)}
									{#if si > 0}<span aria-hidden="true"> · </span>{/if}
									<span class="tabular-nums">{formatSet(set)}</span>
								{/each}
							</p>
						</div>
					{/each}
				</div>
				{#if moreCount > 0}
					<button
						type="button"
						class="summary-exercises-preview__more"
						onclick={() => (showAllExercises = true)}
					>
						{translate(lang, 'summary.moreExercises', { n: moreCount })}
					</button>
				{:else if loggedExercises.length > PREVIEW_LIMIT}
					<button
						type="button"
						class="summary-exercises-preview__more"
						onclick={() => (showAllExercises = false)}
					>
						{translate(lang, 'summary.showLess')}
					</button>
				{/if}
			</div>
		{/if}

		{#if showGuestSyncHint}
			<div
				class="summary-guest-hint panel text-left"
				role="region"
				aria-label={translate(lang, 'summary.guestSyncTitle')}
			>
				<p class="summary-guest-hint__title">{translate(lang, 'summary.guestSyncTitle')}</p>
				<p class="summary-guest-hint__lead">{translate(lang, 'summary.guestSyncLead')}</p>
				<div class="summary-guest-hint__actions">
					<a class="btn-secondary min-h-12 min-w-[48px] px-4" href={authNextHref}
						>{translate(lang, 'summary.guestSyncCta')}</a
					>
					<button
						type="button"
						class="btn-link min-h-12 min-w-[48px] px-3"
						onclick={dismissGuestHint}
					>
						{translate(lang, 'summary.guestSyncDismiss')}
					</button>
				</div>
			</div>
		{/if}

		<div class="summary-actions summary-page__done-inline">
			<a class="btn-primary btn-block min-h-12" href={`/workouts/history/${session.id}`}
				>{translate(lang, 'summary.done')}</a
			>
		</div>

		<div class="sticky-actions summary-page__done-sticky lg:hidden">
			<div class="sticky-actions__inner summary-actions">
				<a class="btn-primary btn-block min-h-12" href={`/workouts/history/${session.id}`}
					>{translate(lang, 'summary.done')}</a
				>
			</div>
		</div>
	</section>
{/if}
