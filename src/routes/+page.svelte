<script lang="ts">
	import ArticleTeaserList from '$lib/components/ArticleTeaserList.svelte';
	import HomePageSkeleton from '$lib/components/HomePageSkeleton.svelte';
	import HomeRecordsWidget from '$lib/components/HomeRecordsWidget.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import {
		completedExerciseCount,
		completedSetCount,
		sessionDurationMs,
		totalSetCount
	} from '$lib/domain/session';
	import { planTargetSummary } from '$lib/domain/workout';
	import { BUILDER_NEW_HREF } from '$lib/domain/catalogLinks';
	import { dayGreetingPeriod, homeGreetingMessageKey } from '$lib/domain/greeting';
	import { greetingFirstName } from '$lib/domain/greetingName';
	import { formatDurationMinutes, formatRelativeDay } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { greetingName } from '$lib/stores/greetingName';
	import { live } from '$lib/stores/live';
	import { plans } from '$lib/stores/plans';
	import { records } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onMount } from 'svelte';
	import { ChevronRight, LogIn, Plus } from '@lucide/svelte';

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

	let isCreateHome = $derived(!hasPlans);
	let showSignedInMockup = $derived($auth.ready && !isGuest);
	let showGuestCreateHero = $derived(pageReady && isGuest && isCreateHome);

	let mockupSubtitle = $derived.by(() => {
		if (hasActive) return translate(lang, 'home.readyTitle');
		if (hasPlans) return translate(lang, 'home.readyTitle');
		if (isFirstTimeHome) return translate(lang, 'home.welcomeLead');
		return translate(lang, 'home.noPlansLead');
	});
	let mockupCtaHref = $derived(hasPlans ? '/workouts' : '/builder');
	let mockupCtaLabel = $derived(
		translate(lang, hasPlans ? 'home.startWorkout' : 'workouts.create')
	);
	let continueRemaining = $derived.by(() => {
		if (!active) return '';
		const exercisesLeft = Math.max(0, active.exercises.length - completedExerciseCount(active));
		const setsLeft = Math.max(0, totalSetCount(active) - completedSetCount(active));
		return translate(lang, 'home.remainingProgress', {
			exercises: exercisesLeft,
			sets: setsLeft
		});
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
		const key = homeGreetingMessageKey(period, Boolean(firstName));
		return firstName ? translate(lang, key, { name: firstName }) : translate(lang, key);
	});

	let firstName = $derived(greetingFirstName($greetingName, $auth.user));

	/** Guests get the sign-in hero instead of a redundant time-of-day greeting. */
	let showGreeting = $derived($auth.ready && !isGuest);

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
</script>

<svelte:head>
	<title>{translate(lang, 'home.title')} · Repdraft</title>
</svelte:head>

<section
	class="home-page content-page"
	class:home-page--start={pageReady && !isGuest && hasPlans}
	class:home-page--create={pageReady && isCreateHome}
	class:home-page--guest={pageReady && isGuest}
	aria-labelledby="home-heading"
>
	{#if showSignedInMockup}
		<header class="home-header home-header--mockup">
			<h1 id="home-heading" class="sr-only">{translate(lang, 'home.title')}</h1>
			<div class="home-header__copy">
				{#if showGreeting}
					<p class="home-header__greeting">{greetingText}</p>
				{:else}
					<p class="home-header__greeting" aria-hidden="true">
						<span
							class="inline-block h-[1.75rem] w-[min(100%,15rem)] animate-pulse rounded bg-[var(--color-surface-muted)]"
						></span>
					</p>
				{/if}
				{#if pageReady}
					<p class="home-header__subtitle">{mockupSubtitle}</p>
				{/if}
			</div>
			{#if pageReady && !hasActive}
				<a class="btn-primary home-header__cta" href={mockupCtaHref}>
					{mockupCtaLabel}
				</a>
			{/if}
		</header>
	{:else if showGuestCreateHero}
		<h1 id="home-heading" class="sr-only">{translate(lang, 'home.title')}</h1>
	{:else}
		<header class="home-header">
			<div class="home-header__intro">
				<h1 id="home-heading" class="page-title home-header__title">{translate(lang, 'home.title')}</h1>
			</div>
		</header>
	{/if}

	{#if !pageReady}
		<HomePageSkeleton label={translate(lang, 'common.loading')} />
	{:else}
		{#if hasActive && active}
			<a class="home-continue-card panel" href={`/live/${active.planId}`}>
				<div class="home-continue-card__copy">
					<p class="home-continue-card__eyebrow">{translate(lang, 'home.workoutInProgress')}</p>
					<p class="home-continue-card__title">{active.planName}</p>
					<p class="home-continue-card__meta">{continueRemaining}</p>
				</div>
				<span class="btn-primary home-continue-card__cta">{translate(lang, 'home.continue')}</span>
			</a>
		{/if}
		<div class="home-dashboard">
			{#if showGuestCreateHero}
				<div class="home-dashboard-top">
					<div class="home-hero">
						<h2 class="home-hero-title">{createHeroTitle}</h2>
						<p class="home-hero-meta">{createHeroLead}</p>
						<div class="home-hero-actions">
							<a
								class="btn-primary home-hero-cta min-h-12 items-center justify-center gap-2"
								href={authHref}
							>
								<LucideIcon icon={LogIn} size={ICON_PRIMARY} />
								{translate(lang, 'nav.signIn')}
							</a>
							<a class="home-hero-skip" href={BUILDER_NEW_HREF}>
								{translate(lang, 'home.guestCreateLocal')}
							</a>
						</div>
					</div>
				</div>
			{/if}

			<div class="home-dashboard-mid">
				{#if isFirstTimeHome && data.articles.length > 0}
					<div class="home-dashboard-teaser">
						<ArticleTeaserList
							articles={data.articles}
							title={translate(lang, 'articles.homeTeaserTitle')}
							limit={3}
						/>
					</div>
				{/if}

				{#if hasPlans || (!isGuest && !hasPlans)}
					<div class="home-dashboard-row">
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
									{#if homePlans.length < 4}
										<li class="entity-row entity-row--create">
											<a class="entity-row__main" href={BUILDER_NEW_HREF}>
												<span class="entity-row__title entity-row__title--create">
													<LucideIcon icon={Plus} size={ICON_SMALL} />
													{translate(lang, 'home.plansCreateTitle')}
												</span>
												<span class="entity-row__meta">{translate(lang, 'home.plansCreateHint')}</span>
											</a>
										</li>
									{/if}
								</ul>
							</div>
						{:else if !isGuest}
							<div class="home-section home-dashboard-plans">
								<div class="home-section-head">
									<h2 class="section-title">{translate(lang, 'home.plansTitle')}</h2>
								</div>
								<ul class="entity-list">
									<li class="entity-row entity-row--create">
										<a class="entity-row__main" href={BUILDER_NEW_HREF}>
											<span class="entity-row__title entity-row__title--create">
												<LucideIcon icon={Plus} size={ICON_SMALL} />
												{translate(lang, 'home.plansCreateTitle')}
											</span>
											<span class="entity-row__meta">{translate(lang, 'home.plansCreateHint')}</span>
										</a>
									</li>
								</ul>
							</div>
						{/if}
					</div>
				{/if}

				<div class="home-dashboard-aside">
					{#if recent.length > 0}
						<div class="home-section">
							<div class="home-section-head">
								<h2 class="section-title">{translate(lang, 'home.recentTitle')}</h2>
								<a class="home-section-link" href="/workouts?tab=history">
									{translate(lang, 'home.recentAll')}
									<LucideIcon icon={ChevronRight} size={ICON_SMALL} />
								</a>
							</div>
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
					{:else if !isGuest && !hasPlans}
						<div class="home-section">
							<div class="home-section-head">
								<h2 class="section-title">{translate(lang, 'home.recentPlaceholderTitle')}</h2>
							</div>
							<div class="panel home-aside-card home-aside-card--compact">
								<p class="home-aside-card__hint">
									{translate(lang, 'home.recentPlaceholderHint')}
								</p>
							</div>
						</div>
					{/if}

					{#if !isGuest || hasSessionHistory || $records.length > 0}
						<HomeRecordsWidget {indexById} limit={3} />
					{/if}

					{#if isGuest && !hasSessionHistory}
						<div class="home-section home-guest-next">
							<a class="home-guest-next__card panel" href="/exercises">
								<span class="home-guest-next__title">{translate(lang, 'nav.exercises')}</span>
								<span class="home-guest-next__hint">{translate(lang, 'home.guestBrowseHint')}</span>
								<LucideIcon icon={ChevronRight} size={ICON_SMALL} class="home-guest-next__chevron" />
							</a>
							<a class="home-guest-next__card panel" href={BUILDER_NEW_HREF}>
								<span class="home-guest-next__title">{translate(lang, 'workouts.create')}</span>
								<span class="home-guest-next__hint">{translate(lang, 'home.guestCreateHint')}</span>
								<LucideIcon icon={ChevronRight} size={ICON_SMALL} class="home-guest-next__chevron" />
							</a>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</section>
