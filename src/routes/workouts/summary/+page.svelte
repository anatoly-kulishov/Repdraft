<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SummaryPageSkeleton from '$lib/components/summary/SummaryPageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY } from '$lib/components/icons/sizes';
	import { WORKOUTS_HISTORY_HREF } from '$lib/domain/catalogLinks';
	import {
		completedExerciseCount,
		completedSetCount,
		sessionDurationMs,
		sessionVolumeKg
	} from '$lib/domain/session';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import type { ExerciseIndexItem, LoggedSet, WorkoutSession } from '$lib/domain/types';
	import { formatDurationMs } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { peekLocalSession } from '$lib/storage/localSessionRepository';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { live } from '$lib/stores/live';
	import { onboarding } from '$lib/stores/onboarding';
	import { CircleCheck } from '@lucide/svelte';
	import { page } from '$app/stores';
	import { readSearchParam } from '$lib/navigation/urlSearchParams';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	const GUEST_SYNC_DISMISS_KEY = 'repdraft:guest-sync-hint-dismissed';

	let lang = $derived($resolvedLocale);
	let session = $state<WorkoutSession | null>(null);
	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let missing = $state(false);
	let loading = $state(true);
	let showAllExercises = $state(true);
	let guestHintDismissed = $state(false);
	let showFirstFinish = $state(false);

	const PREVIEW_LIMIT = 6;

	type PreviewItem = {
		ex: WorkoutSession['exercises'][number];
		completed: LoggedSet[];
	};

	let isGuest = $derived($auth.ready && $auth.configured && !$auth.user);
	let showGuestSyncHint = $derived(
		isGuest && !guestHintDismissed && !loading && session != null && !showFirstFinish
	);

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

	let volumeKg = $derived(session ? sessionVolumeKg(session) : 0);
	let summarySessionId = $derived(readSearchParam($page.url, 'id') ?? '');
	let skeletonGuestHint = $derived(!$auth.user);

	function formatSet(set: LoggedSet): string {
		if (set.weightKg != null) {
			return `${set.weightKg} ${translate(lang, 'pr.kg')} × ${set.reps ?? '-'}`;
		}
		if (set.reps != null) {
			return `${set.reps} ${translate(lang, 'pr.repsShort')}`;
		}
		return '-';
	}

	let authNextHref = $derived(
		session ? `/auth?next=${encodeURIComponent('/')}` : '/auth?next=%2F'
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
			const id = readSearchParam(get(page).url, 'id');
			if (!id) {
				missing = true;
				loading = false;
				return;
			}
			const peeked = peekLocalSession(id);
			if (peeked?.finishedAt) session = peeked;
			const [found, index] = await Promise.all([
				session ? Promise.resolve(session) : live.getFinishedSession(id),
				loadExerciseIndex()
			]);
			if (!found) missing = true;
			else {
				session = found;
				if (!onboarding.activated()) {
					showFirstFinish = true;
					onboarding.markChecklist('sessionFinished');
				}
			}
			indexById = new Map(index.map((ex) => [ex.id, ex]));
			loading = false;
		})();
	});
</script>

<SeoHead title={translate(lang, 'summary.title')} noindex />

{#if loading}
	<SummaryPageSkeleton sessionId={summarySessionId} showGuestHint={skeletonGuestHint} />
{:else if missing || !session}
	<EmptyState
		title={translate(lang, 'live.noPlan')}
		description={translate(lang, 'workouts.emptyDesc')}
		actionHref={WORKOUTS_HISTORY_HREF}
		actionLabel={translate(lang, 'nav.workouts')}
	/>
{:else}
	<section class="summary-page content-page content-page--narrow soft-enter pb-mobile-actions text-center lg:pb-0">
		<ScreenHeader
			class="text-left"
			title={translate(lang, 'summary.title')}
			backHref={WORKOUTS_HISTORY_HREF}
			backLabelVisible
			backLabel={translate(lang, 'builder.backWorkouts')}
			preferHistoryBack={false}
		/>

		<div class="summary-hero">
			<div class="summary-check" aria-hidden="true">
				<LucideIcon icon={CircleCheck} size={ICON_PRIMARY + 12} />
			</div>
			<h1 class="summary-hero__title">{translate(lang, 'summary.title')}</h1>
			<p class="summary-hero__plan">{session.planName}</p>
		</div>

		{#if showFirstFinish}
			<AppPanel class="onboarding-first-finish text-left" role="status">
				<div class="onboarding-first-finish__copy min-w-0">
					<p class="onboarding-first-finish__title">
						{translate(lang, 'onboarding.firstFinishTitle')}
					</p>
					<p class="onboarding-first-finish__lead">
						{translate(lang, 'onboarding.firstFinishLead')}
					</p>
				</div>
			</AppPanel>
		{/if}

		<dl class="summary-stats" class:summary-stats--with-volume={volumeKg > 0}>
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
			{#if volumeKg > 0}
				<div class="summary-stat">
					<dt class="summary-stat__label" title={translate(lang, 'summary.volumeHint')}>
						{translate(lang, 'summary.volume')}
					</dt>
					<dd class="summary-stat__value tabular-nums">
						{Math.round(volumeKg)} {translate(lang, 'pr.kg')}
					</dd>
				</div>
			{/if}
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
							{#if meta}
								<div class="summary-exercises-preview__thumb media-well" aria-hidden="true">
									<img
										src={`/${meta.image}`}
										alt=""
										width="48"
										height="48"
										loading="lazy"
										decoding="async"
									/>
								</div>
							{:else}
								<div
									class="summary-exercises-preview__thumb media-well is-placeholder"
									aria-hidden="true"
								></div>
							{/if}
							<p class="summary-exercises-preview__name">
								{meta ? exerciseName(meta, lang) : ex.exerciseId}
							</p>
							<ul class="summary-exercises-preview__sets">
								{#each item.completed as set, si (si)}
									<li class="summary-exercises-preview__set">
										<span class="summary-exercises-preview__set-i tabular-nums" aria-hidden="true"
											>{si + 1}</span
										>
										<span class="summary-exercises-preview__set-val tabular-nums"
											>{formatSet(set)}</span
										>
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
				{#if moreCount > 0}
					<AppButton
						variant="link"
						class="summary-exercises-preview__more !h-auto !min-h-0 !min-w-0 w-auto p-0"
						onclick={() => (showAllExercises = true)}
					>
						{translate(lang, 'summary.moreExercises', { n: moreCount })}
					</AppButton>
				{:else if loggedExercises.length > PREVIEW_LIMIT}
					<AppButton
						variant="link"
						class="summary-exercises-preview__more !h-auto !min-h-0 !min-w-0 w-auto p-0"
						onclick={() => (showAllExercises = false)}
					>
						{translate(lang, 'summary.showLess')}
					</AppButton>
				{/if}
			</div>
		{/if}

		{#if showGuestSyncHint}
			<AppPanel
				class="summary-guest-hint text-left"
				role="region"
				aria-label={translate(lang, 'summary.guestSyncTitle')}
			>
				<p class="summary-guest-hint__title">{translate(lang, 'summary.guestSyncTitle')}</p>
				<p class="summary-guest-hint__lead">{translate(lang, 'summary.guestSyncLead')}</p>
				<div class="summary-guest-hint__actions">
					<AppButton variant="secondary" block href={authNextHref}>
						{translate(lang, 'summary.guestSyncCta')}
					</AppButton>
					<AppButton
						variant="link"
						class="summary-guest-hint__dismiss"
						onclick={dismissGuestHint}
					>
						{translate(lang, 'summary.guestSyncDismiss')}
					</AppButton>
				</div>
			</AppPanel>
		{/if}

		<div class="summary-actions summary-page__done-inline">
			<AppButton block href="/" data-sveltekit-replacestate>
				{translate(lang, 'summary.done')}
			</AppButton>
			<AppButton
				variant="link"
				class="summary-actions__details !h-auto !min-h-[48px] !min-w-[48px]"
				href={`/workouts/history/${session.id}`}
			>
				{translate(lang, 'summary.openSession')}
			</AppButton>
		</div>

		<div class="sticky-actions summary-page__done-sticky lg:hidden">
			<div class="sticky-actions__inner summary-actions summary-actions--stack">
				<AppButton block href="/" data-sveltekit-replacestate>
					{translate(lang, 'summary.done')}
				</AppButton>
				<AppButton
					variant="link"
					class="summary-actions__details !h-auto !min-h-[48px]"
					href={`/workouts/history/${session.id}`}
				>
					{translate(lang, 'summary.openSession')}
				</AppButton>
			</div>
		</div>
	</section>
{/if}
