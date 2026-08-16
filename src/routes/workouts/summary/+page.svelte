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
	import type { WorkoutSession } from '$lib/domain/types';
	import { formatDurationMs } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { live } from '$lib/stores/live';
	import { CircleCheck } from '@lucide/svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);
	let session = $state<WorkoutSession | null>(null);
	let missing = $state(false);
	let loading = $state(true);

	onMount(() => {
		void (async () => {
			const id = $page.url.searchParams.get('id');
			if (!id) {
				missing = true;
				loading = false;
				return;
			}
			const found = await live.getFinishedSession(id);
			if (!found) missing = true;
			else session = found;
			loading = false;
		})();
	});
</script>

<svelte:head>
	<title>{translate(lang, 'summary.title')} · Repdraft</title>
</svelte:head>

{#if loading}
	<PageSkeleton rows={3} />
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
