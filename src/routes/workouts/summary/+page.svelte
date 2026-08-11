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
	<title>{translate(lang, 'summary.title')} — Repdraft</title>
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
		<div class="summary-check mt-2 lg:mt-0" aria-hidden="true">
			<LucideIcon icon={CircleCheck} size={ICON_PRIMARY + 12} class="text-[var(--color-accent)]" />
		</div>
		<h1 class="page-title mt-4 hidden md:block">{translate(lang, 'summary.title')}</h1>
		<p class="mt-1 text-lg font-medium text-[var(--color-ink)]">{session.planName}</p>

		<dl class="summary-stats mt-8 grid grid-cols-3 gap-3">
			<div class="stat-card">
				<dt class="stat-card-label">{translate(lang, 'summary.duration')}</dt>
				<dd class="stat-card-value">{formatDurationMs(sessionDurationMs(session), { extended: true })}</dd>
			</div>
			<div class="stat-card">
				<dt class="stat-card-label">{translate(lang, 'summary.exercises')}</dt>
				<dd class="stat-card-value">{completedExerciseCount(session)}</dd>
			</div>
			<div class="stat-card">
				<dt class="stat-card-label">{translate(lang, 'summary.sets')}</dt>
				<dd class="stat-card-value">{completedSetCount(session)}</dd>
			</div>
		</dl>

		<a class="btn-primary btn-block mt-8 min-h-12" href="/workouts?tab=history">{translate(lang, 'summary.done')}</a>
	</section>
{/if}
