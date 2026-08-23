<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import BrandTagline from '$lib/components/BrandTagline.svelte';
	import HomePageSkeleton from '$lib/components/HomePageSkeleton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import { loadExerciseIndex, peekExerciseIndex } from '$lib/data/loadExercises';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import {
		completedExerciseCount,
		completedSetCount,
		sessionDurationMs,
		totalSetCount
	} from '$lib/domain/session';
	import { planExerciseSlotCount, planTargetSummary } from '$lib/domain/workout';
	import { BUILDER_NEW_HREF } from '$lib/domain/catalogLinks';
	import { dayGreetingPeriod, homeGreetingMessageKey } from '$lib/domain/greeting';
	import { greetingFirstName } from '$lib/domain/greetingName';
	import { formatDurationMinutes, formatRelativeDay } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { greetingName } from '$lib/stores/greetingName';
	import { live } from '$lib/stores/live';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { ChevronRight, LogIn, Plus } from '@lucide/svelte';

	let lang = $derived($resolvedLocale);
	let active = $derived($live.session);
	let recent = $derived($live.history.slice(0, 6));
	let homePlans = $derived($plans.slice(0, 8));
	const peeked = peekExerciseIndex();
	let indexById = $state<Map<string, ExerciseIndexItem>>(
		peeked ? new Map(peeked.map((item) => [item.id, item])) : new Map()
	);
	let indexReady = $state(peeked != null);

	let hasActive = $derived(Boolean(active && !active.finishedAt));
	let hasPlans = $derived($plans.length > 0);
	let hasSessionHistory = $derived(recent.length > 0);
	let isFirstTimeHome = $derived(!hasPlans && !hasSessionHistory);
	let isGuest = $derived($auth.ready && $auth.configured && !$auth.user);
	let authHref = '/auth?next=%2F';
	let pageReady = $derived(
		$auth.ready && $auth.dataBootstrap && $live.ready && $live.historyHydrated && indexReady
	);

	let isCreateHome = $derived(!hasPlans);
	let showGuestCreateHero = $derived(pageReady && isGuest && isCreateHome);
	/** Signed-in home, or guest who already has plans (needs Start, not only a list). */
	let showReadyHeader = $derived($auth.ready && !showGuestCreateHero && (hasPlans || !isGuest));

	/** Prefer last finished plan if still saved, else first plan — one hop to preview+Start. */
	let nextPlan = $derived.by(() => {
		if ($plans.length === 0) return null;
		const lastPlanId = recent[0]?.planId;
		if (lastPlanId) {
			const match = $plans.find((p) => p.id === lastPlanId);
			if (match) return match;
		}
		return $plans[0] ?? null;
	});

	let mockupSubtitle = $derived.by(() => {
		if (hasActive) return translate(lang, 'home.readyTitle');
		if (nextPlan || hasPlans) return translate(lang, 'home.readyTitle');
		if (isFirstTimeHome) return translate(lang, 'home.welcomeLead');
		return translate(lang, 'home.noPlansLead');
	});
	let mockupCtaHref = $derived(
		nextPlan ? `/workouts/${nextPlan.id}` : hasPlans ? '/workouts' : BUILDER_NEW_HREF
	);
	let mockupCtaLabel = $derived(
		translate(lang, nextPlan || hasPlans ? 'home.startWorkout' : 'workouts.create')
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
			? translate(lang, 'home.guestTrainTitle')
			: isFirstTimeHome
				? translate(lang, 'home.welcomeTitle')
				: translate(lang, 'home.noPlansTitle')
	);
	let createHeroLead = $derived(
		isGuest
			? translate(lang, 'home.guestTrainLead')
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
				get(live).historyHydrated ? Promise.resolve() : live.refreshHistory()
			]);
		})();
	});
</script>

<svelte:head>
	<title>{translate(lang, 'home.title')} · Repdraft</title>
</svelte:head>

<section
	class="home-page content-page"
	class:home-page--start={pageReady && hasPlans}
	class:home-page--create={pageReady && isCreateHome}
	class:home-page--guest={pageReady && isGuest}
	aria-labelledby="home-heading"
>
	{#if showReadyHeader}
		<header class="home-header home-header--mockup">
			<h1 id="home-heading" class="sr-only">{translate(lang, 'home.title')}</h1>
			<div class="home-header__copy">
				{#if showGreeting}
					<p class="home-header__greeting">{greetingText}</p>
				{:else if isGuest}
					<p class="home-header__greeting">{translate(lang, 'home.readyTitle')}</p>
				{:else}
					<p class="home-header__greeting" aria-hidden="true">
						<span
							class="inline-block h-[1.75rem] w-[min(100%,15rem)] animate-pulse rounded bg-[var(--color-surface-muted)]"
						></span>
					</p>
				{/if}
				{#if pageReady && !isGuest}
					<p class="home-header__subtitle">{mockupSubtitle}</p>
					{#if isFirstTimeHome}
						<BrandTagline class="brand-tagline--home-header" />
					{/if}
				{/if}
			</div>
			{#if pageReady && !hasActive}
				<AppButton href={mockupCtaHref} class="home-header__cta">
					{mockupCtaLabel}
				</AppButton>
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
				<span class="inline-flex min-h-12 items-center rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground home-continue-card__cta">{translate(lang, 'home.continue')}</span>
			</a>
		{/if}
		<div class="home-dashboard">
			{#if showGuestCreateHero}
				<div class="home-dashboard-top">
					<div class="home-hero">
						<h2 class="home-hero-title">{createHeroTitle}</h2>
						<p class="home-hero-meta">{createHeroLead}</p>
						{#if isFirstTimeHome}
							<BrandTagline class="brand-tagline--hero" />
						{/if}
						<div class="home-hero-actions">
							<AppButton
								href={BUILDER_NEW_HREF}
								class="home-hero-cta items-center justify-center gap-2"
							>
								<LucideIcon icon={Plus} size={ICON_PRIMARY} />
								{translate(lang, 'home.guestCreateLocal')}
							</AppButton>
							<AppButton
								variant="secondary"
								href={authHref}
								class="home-hero-secondary items-center justify-center gap-2"
							>
								<LucideIcon icon={LogIn} size={ICON_PRIMARY} />
								{translate(lang, 'nav.signIn')}
							</AppButton>
						</div>
					</div>
					{#if !hasSessionHistory}
						<nav class="home-guest-next">
							<AppButton class="panel home-guest-next__card h-auto flex-col items-start gap-1 text-left" href="/exercises">
								<span class="home-guest-next__title">{translate(lang, 'nav.exercises')}</span>
								<span class="home-guest-next__hint">{translate(lang, 'home.guestBrowseHint')}</span>
								<LucideIcon
									icon={ChevronRight}
									size={ICON_SMALL}
									class="home-guest-next__chevron"
								/>
							</AppButton>
						</nav>
					{/if}
				</div>
			{/if}

			<div class="home-dashboard-mid">
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
													{translate(lang, 'workouts.exCount', { n: planExerciseSlotCount(plan) })}
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

				{#if recent.length > 0 || (!isGuest && !hasPlans)}
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
					{:else}
						<div class="home-section">
							<div class="home-section-head">
								<h2 class="section-title">{translate(lang, 'home.recentPlaceholderTitle')}</h2>
							</div>
							<AppPanel class="home-aside-card home-aside-card--compact">
								<p class="home-aside-card__hint">
									{translate(lang, 'home.recentPlaceholderHint')}
								</p>
							</AppPanel>
						</div>
					{/if}
				</div>
				{/if}
			</div>
		</div>
	{/if}
</section>
