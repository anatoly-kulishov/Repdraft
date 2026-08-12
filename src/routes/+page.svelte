<script lang="ts">
	import ArticleTeaserList from '$lib/components/ArticleTeaserList.svelte';
	import HomePageSkeleton from '$lib/components/HomePageSkeleton.svelte';
	import HomeRecordsWidget from '$lib/components/HomeRecordsWidget.svelte';
	import HomeStatsStack from '$lib/components/HomeDesktopAside.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import {
		completedExerciseCount,
		completedSetCount,
		sessionDurationMs
	} from '$lib/domain/session';
	import { planTargetSummary } from '$lib/domain/workout';
	import { dayGreetingPeriod, homeGreetingMessageKey } from '$lib/domain/greeting';
	import { userDisplayName } from '$lib/domain/authFlow';
	import { formatDurationMinutes, formatRelativeDay } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { live } from '$lib/stores/live';
	import { plans } from '$lib/stores/plans';
	import { records } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { ChevronRight, LogIn, Play, Plus } from '@lucide/svelte';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let active = $derived($live.session);
	let recent = $derived($live.history.slice(0, 6));
	let homePlans = $derived($plans.slice(0, 8));
	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let indexReady = $state(false);
	let historyReady = $state(false);

	let hasActive = $derived(Boolean(active && !active.finishedAt));
	let hasPlans = $derived($plans.length > 0);
	let hasSessionHistory = $derived(recent.length > 0);
	let isFirstTimeHome = $derived(!hasPlans && !hasSessionHistory);
	let isGuest = $derived($auth.ready && $auth.configured && !$auth.user);
	let authHref = '/auth?next=%2F';
	let pageReady = $derived(
		$auth.ready &&
			$auth.dataBootstrap &&
			$live.ready &&
			historyReady &&
			indexReady
	);

	type HomeMode = 'continue' | 'create' | 'start';
	let homeMode = $derived.by((): HomeMode => {
		if (hasActive) return 'continue';
		if (!hasPlans) return 'create';
		return 'start';
	});

	let createHeroTitle = $derived(
		isGuest
			? translate(lang, 'home.guestTitle')
			: isFirstTimeHome
				? translate(lang, 'home.welcomeTitle')
				: translate(lang, 'home.noPlansTitle')
	);
	let createHeroLead = $derived(
		isGuest
			? translate(lang, 'home.guestLead')
			: isFirstTimeHome
				? translate(lang, 'home.welcomeLead')
				: translate(lang, 'home.noPlansLead')
	);

	let greetingText = $derived.by(() => {
		const period = dayGreetingPeriod();
		const key = homeGreetingMessageKey(period, Boolean(displayName));
		return displayName ? translate(lang, key, { name: displayName }) : translate(lang, key);
	});

	let displayName = $derived(userDisplayName($auth.user));

	/** Guests get the sign-in hero instead of a redundant time-of-day greeting. */
	let showGreeting = $derived($auth.ready && !isGuest);

	let progressPct = $derived.by(() => {
		if (!active || active.exercises.length === 0) return 0;
		return Math.round((completedExerciseCount(active) / active.exercises.length) * 100);
	});

	onMount(() => {
		void (async () => {
			while (!$auth.ready || !$auth.dataBootstrap) {
				await new Promise((r) => setTimeout(r, 20));
			}
			await Promise.all([
				loadExerciseIndex()
					.then((items) => {
						indexById = new Map(items.map((item) => [item.id, item]));
					})
					.finally(() => {
						indexReady = true;
					}),
				live.refreshHistory().finally(() => {
					historyReady = true;
				}),
				records.refresh()
			]);
		})();
	});

	function onResume() {
		if (!active) return;
		void goto(`/live/${active.planId}`);
	}
</script>

<svelte:head>
	<title>{translate(lang, 'home.title')} — Repdraft</title>
</svelte:head>

<section
	class="home-page content-page"
	class:home-page--start={pageReady && homeMode === 'start'}
	class:home-page--create={pageReady && homeMode === 'create'}
	class:home-page--guest={pageReady && isGuest}
	aria-labelledby="home-heading"
>
	{#if !(pageReady && isGuest && homeMode === 'create')}
	<header class="home-header" class:home-header--compact={pageReady && homeMode === 'create'}>
		<div class="home-header__intro">
			<h1 id="home-heading" class="page-title home-header__title">{translate(lang, 'home.title')}</h1>
			{#if showGreeting}
				<p class="home-lead home-header__greeting">{greetingText}</p>
			{:else if !$auth.ready}
				<p class="home-lead home-header__greeting" aria-hidden="true">
					<span
						class="home-lead-skeleton inline-block h-[1.35rem] w-[min(100%,14rem)] animate-pulse rounded bg-[var(--color-surface-muted)]"
					></span>
				</p>
			{/if}
			{#if pageReady && homeMode === 'start'}
				<p class="home-header__lead">{translate(lang, 'home.startLead')}</p>
			{/if}
		</div>
		{#if pageReady && homeMode === 'start'}
			<a class="btn-primary home-header__cta home-header__cta--desktop min-h-11 shrink-0 items-center gap-2 px-5" href="/workouts">
				<LucideIcon icon={Play} size={ICON_PRIMARY} />
				{translate(lang, 'home.startWorkout')}
			</a>
		{:else if pageReady && homeMode === 'create'}
			<a class="btn-primary home-header__cta home-header__cta--desktop min-h-11 shrink-0 items-center gap-2 px-5" href="/builder">
				<LucideIcon icon={Plus} size={ICON_PRIMARY} />
				{translate(lang, 'workouts.create')}
			</a>
		{:else if pageReady && homeMode === 'continue'}
			<button
				type="button"
				class="btn-primary home-header__cta home-header__cta--desktop min-h-11 shrink-0 items-center gap-2 px-5"
				onclick={onResume}
			>
				<LucideIcon icon={Play} size={ICON_PRIMARY} />
				{translate(lang, 'home.continueWorkout')}
			</button>
		{/if}
	</header>
	{:else}
		<h1 id="home-heading" class="sr-only">{translate(lang, 'home.title')}</h1>
	{/if}

	{#if !pageReady}
		<HomePageSkeleton label={translate(lang, 'common.loading')} />
	{:else}
		<div class="home-dashboard">
			<div class="home-dashboard-top" class:home-dashboard-top--start={homeMode === 'start'}>
				<div
					class="home-hero"
					class:home-hero--continue={homeMode === 'continue'}
					class:home-hero--compact={homeMode === 'start'}
				>
					{#if homeMode === 'continue' && active}
						<p class="home-hero-kicker">{translate(lang, 'home.workoutInProgress')}</p>
						<h2 class="home-hero-title">{active.planName}</h2>
						<p class="home-hero-meta">
							{translate(lang, 'home.exerciseProgress', {
								done: completedExerciseCount(active),
								total: active.exercises.length
							})}
						</p>
						<div
							class="home-progress"
							role="progressbar"
							aria-valuenow={progressPct}
							aria-valuemin={0}
							aria-valuemax={100}
						>
							<div class="home-progress-fill" style:width="{progressPct}%"></div>
						</div>
						<button
							type="button"
							class="btn-primary home-hero-cta btn-block min-h-12 items-center justify-center gap-2 lg:hidden"
							onclick={onResume}
						>
							<LucideIcon icon={Play} size={ICON_PRIMARY} />
							{translate(lang, 'home.continueWorkout')}
						</button>
					{:else if homeMode === 'create'}
						<h2 class="home-hero-title">{createHeroTitle}</h2>
						<p class="home-hero-meta">{createHeroLead}</p>
						{#if isGuest}
							<div class="home-hero-actions">
								<a
									class="btn-primary home-hero-cta min-h-12 items-center justify-center gap-2"
									href={authHref}
								>
									<LucideIcon icon={LogIn} size={ICON_PRIMARY} />
									{translate(lang, 'nav.signIn')}
								</a>
								<a
									class="btn-secondary home-hero-cta-secondary min-h-11 items-center justify-center gap-2"
									href="/builder"
								>
									<LucideIcon icon={Plus} size={ICON_PRIMARY} />
									{translate(lang, 'home.guestCreateLocal')}
								</a>
							</div>
						{:else}
							<a
								class="btn-primary home-hero-cta btn-block min-h-12 items-center justify-center gap-2 lg:hidden"
								href="/builder"
							>
								<LucideIcon icon={Plus} size={ICON_PRIMARY} />
								{translate(lang, 'workouts.create')}
							</a>
						{/if}
					{:else}
						<h2 class="home-hero-title">{translate(lang, 'home.readyTitle')}</h2>
						<p class="home-hero-meta">{translate(lang, 'home.startLead')}</p>
						<a
							class="btn-primary home-hero-cta btn-block min-h-12 items-center justify-center gap-2 lg:hidden"
							href="/workouts"
						>
							<LucideIcon icon={Play} size={ICON_PRIMARY} />
							{translate(lang, 'home.startWorkout')}
						</a>
					{/if}
				</div>

				{#if homeMode !== 'create'}
					<HomeStatsStack />
				{/if}
			</div>

			<div class="home-dashboard-mid">
				{#if isFirstTimeHome && data.articles.length > 0}
					<ArticleTeaserList
						articles={data.articles}
						title={translate(lang, 'articles.homeTeaserTitle')}
						limit={3}
					/>
				{/if}

				{#if hasPlans}
					<div class="home-section home-dashboard-plans">
						<div class="home-section-head">
							<h2 class="section-title">{translate(lang, 'home.plansTitle')}</h2>
							{#if $plans.length > homePlans.length}
								<a class="home-section-link" href="/workouts">
									{translate(lang, 'home.viewAllWorkouts')}
									<LucideIcon icon={ChevronRight} size={ICON_SMALL} />
								</a>
							{/if}
						</div>
						<ul class="entity-list">
							{#each homePlans as plan (plan.id)}
								{@const muscles = planTargetSummary(plan, indexById, lang)}
								<li class="entity-row">
									<a class="entity-row__main" href={`/workouts/${plan.id}`}>
										<span class="entity-row__title">{plan.name}</span>
										{#if muscles}
											<span class="entity-row__meta">{muscles}</span>
										{/if}
										<span class="entity-row__meta">
											{translate(lang, 'workouts.exCount', { n: plan.exercises.length })}
										</span>
									</a>
									<LucideIcon icon={ChevronRight} size={ICON_SMALL} class="entity-row__chevron shrink-0" />
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if recent.length > 0}
					<div class="home-section">
						<h2 class="section-title">{translate(lang, 'home.recentTitle')}</h2>
						<ul class="entity-list">
							{#each recent as session (session.id)}
								<li>
									<a class="entity-row entity-row--link" href={`/workouts/history/${session.id}`}>
										<span class="entity-row__main">
											<span class="entity-row__title">{session.planName}</span>
											<span class="entity-row__meta">
												{translate(lang, 'home.recentMeta', {
													when: formatRelativeDay(session.finishedAt ?? session.startedAt, lang),
													min: formatDurationMinutes(sessionDurationMs(session)) ?? '—',
													sets: completedSetCount(session)
												})}
											</span>
										</span>
										<LucideIcon icon={ChevronRight} size={ICON_SMALL} class="entity-row__chevron" />
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{:else if !isGuest}
					<div class="home-section">
						<h2 class="section-title">{translate(lang, 'home.recentPlaceholderTitle')}</h2>
						<div class="panel-dashed home-mid-placeholder">
							<p class="home-mid-placeholder__text">{translate(lang, 'home.recentPlaceholderHint')}</p>
							<span class="home-soon-badge">{translate(lang, 'home.placeholderSoon')}</span>
						</div>
					</div>
				{/if}

				{#if !isGuest || hasSessionHistory || $records.length > 0}
					<HomeRecordsWidget {indexById} />
				{:else}
					<div class="home-section home-guest-next">
						<a class="home-guest-next__card panel" href="/exercises">
							<span class="home-guest-next__title">{translate(lang, 'nav.exercises')}</span>
							<span class="home-guest-next__hint">{translate(lang, 'home.guestBrowseHint')}</span>
							<LucideIcon icon={ChevronRight} size={ICON_SMALL} class="home-guest-next__chevron" />
						</a>
						<a class="home-guest-next__card panel" href="/builder">
							<span class="home-guest-next__title">{translate(lang, 'workouts.create')}</span>
							<span class="home-guest-next__hint">{translate(lang, 'home.guestCreateHint')}</span>
							<LucideIcon icon={ChevronRight} size={ICON_SMALL} class="home-guest-next__chevron" />
						</a>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</section>
