<script lang="ts">
	import '$lib/styles/blocks/home.css';
	import { page } from '$app/stores';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import BrandTagline from '$lib/components/BrandTagline.svelte';
	import HomePageSkeleton from '$lib/components/HomePageSkeleton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import {
		completedExerciseCount,
		completedSetCount,
		isSessionFullyLogged,
		sessionDurationMinutes,
		totalSetCount
	} from '$lib/domain/session';
	import {
		planEstimatedMinutes,
		planExerciseSlotCount,
		planTargetSummary,
		resolveHomeNextPlan
	} from '$lib/domain/workout';
	import { HOME_RECENT_ROW_LIMIT, resolveHomeSkeletonVariant, shouldShowHomeChecklistSkeleton } from '$lib/domain/home';
	import { progress30d } from '$lib/domain/progressOverview';
	import type { ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import { loadExerciseIndexWithCustoms, peekExerciseIndexWithCustoms } from '$lib/data/exerciseIndexWithCustoms';
	import { BUILDER_NEW_HREF } from '$lib/domain/catalogLinks';
	import { dayGreetingPeriod, homeGreetingMessageKey } from '$lib/domain/greeting';
	import { greetingFirstName } from '$lib/domain/greetingName';
	import { shouldShowChecklist, peekShouldShowChecklist } from '$lib/domain/onboarding';
	import { formatKgInt } from '$lib/domain/format';
	import { formatRelativeDayShort } from '$lib/i18n/format';
	import { liveContinueHref } from '$lib/live/sessionUi';
	import { translate, translateError, translatePlural } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import JsonLd from '$lib/seo/JsonLd.svelte';
	import { buildWebApplicationJsonLd, buildWebSiteJsonLd } from '$lib/seo/jsonLd';
	import { resolveSeoLang } from '$lib/seo/seoLang';
	import { readSearchParam } from '$lib/navigation/urlSearchParams';
	import { resolveSiteOrigin } from '$lib/seo/site';
	import { auth } from '$lib/stores/auth';
	import { isSupabaseConfigured } from '$lib/supabase/client';
	import { coachRepository } from '$lib/storage/coachRepository';
	import type { CoachAssignment } from '$lib/domain/coach';
	import { greetingName } from '$lib/stores/greetingName';
	import { homeNextPlan } from '$lib/stores/homeNextPlan';
	import { live } from '$lib/stores/live';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onboarding, onboardingHydrated } from '$lib/stores/onboarding';
	import { exerciseName } from '$lib/domain/exerciseName';
	import OnboardingChecklist from '$lib/components/onboarding/OnboardingChecklist.svelte';
	import { toasts } from '$lib/stores/toasts';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { createDelayedTrue } from '$lib/browser/delayedTrue.svelte';
	import { readActiveSession, peekLocalHistoryCount } from '$lib/storage/localSessionRepository';
	import { peekHasLocalPlans } from '$lib/storage/localWorkoutRepository';
	import { peekAccountBoot } from '$lib/storage/homeBootPeek';
	import { peekLikelySignedInUserId } from '$lib/storage/localUserCache';
	import { readHomeClientBootPeek } from '$lib/storage/readHomeBootPeek';
	import { onMount } from 'svelte';
	import {
		CaretRight as ChevronRight,
		SignIn as LogIn,
		Notebook as NotebookPen,
		Play,
		Plus,
		DeviceMobile as Smartphone,
		User as UserRound,
		UsersThree,
	} from 'phosphor-svelte';

	let { data } = $props();

	function readBootSkeletonRecentRows(): number {
		if (!browser) return 0;
		const fromDom = document.documentElement.dataset.homeRecentRows;
		if (fromDom) {
			const parsed = Number.parseInt(fromDom, 10);
			if (Number.isFinite(parsed) && parsed > 0) {
				return Math.min(parsed, HOME_RECENT_ROW_LIMIT);
			}
		}
		try {
			if (document.cookie.includes('repdraft_home_has_history=1')) {
				return HOME_RECENT_ROW_LIMIT;
			}
		} catch {
			/* ignore */
		}
		return peekLocalHistoryCount() > 0 ? HOME_RECENT_ROW_LIMIT : 0;
	}

	/** Week-over-week delta line on the 30-day cards (home.progress30Title). */
	function deltaLabel(delta: number, kind: 'workouts' | 'volume'): string {
		if (delta === 0) return translate(lang, 'progress.deltaNone');
		const sign = delta > 0 ? '+' : '';
		if (kind === 'workouts') {
			return translate(lang, 'progress.deltaWorkouts', {
				sign,
				n: delta,
				p: translate(lang, 'progress.periodPastWeek')
			});
		}
		return translate(lang, 'progress.deltaVolume', { sign, n: formatKgInt(delta) });
	}

	/** "Сегодня • 45 мин • 18 подходов" without empty/dash placeholders. */
	function recentMeta(session: WorkoutSession): string {
		const minutes = sessionDurationMinutes(session);
		const sets = completedSetCount(session);
		return [
			formatRelativeDayShort(session.finishedAt ?? session.startedAt, lang),
			minutes != null ? translate(lang, 'home.recentDuration', { n: minutes }) : null,
			sets > 0 ? translatePlural(lang, 'home.recentSets', sets) : null
		]
			.filter((part): part is string => Boolean(part))
			.join(translate(lang, 'common.sep'));
	}

	let lang = $derived($resolvedLocale);

	let assignment = $state<CoachAssignment | null>(null);
	let assignmentBusy = $state(false);
	let assignmentHidden = $state(false);
	let assignmentLoadedFor = $state<string | null>(null);

	$effect(() => {
		const userId = $auth.user?.id ?? null;
		if (!browser || !userId || !isSupabaseConfigured()) return;
		if (assignmentLoadedFor === userId) return;
		assignmentLoadedFor = userId;
		void coachRepository.myCurrentAssignment().then((result) => {
			if (result.ok) assignment = result.value;
		});
	});

	async function importAssignment() {
		const current = assignment;
		if (!current || assignmentBusy) return;
		assignmentBusy = true;
		try {
			const { plan } = await plans.importPlan({
				name: current.planName,
				exercises: current.exercises
			});
			homeNextPlan.pin(plan.id);
			const discard = await coachRepository.discardAssignment();
			assignment = null;
			toasts.show(translate(lang, 'coach.assignedAdded'), 'success');
			if (!discard.ok) toasts.show(translate(lang, `coach.error.${discard.reason}`), 'error');
		} catch {
			toasts.show(translate(lang, 'coach.error.unknown'), 'error');
		} finally {
			assignmentBusy = false;
		}
	}
	let seoLang = $derived(resolveSeoLang($page.data.seoLocale, lang));
	let siteOrigin = $derived(resolveSiteOrigin($page.url.origin));
	let websiteJsonLd = $derived(
		buildWebSiteJsonLd(siteOrigin, translate(seoLang, 'app.metaDescription'))
	);
	let webAppJsonLd = $derived(
		buildWebApplicationJsonLd(siteOrigin, translate(seoLang, 'app.metaDescription'))
	);
	let active = $derived.by(() => {
		const fromStore = $live.session;
		if (fromStore && !fromStore.finishedAt) return fromStore;
		if (!browser) return null;
		const local = readActiveSession();
		return local && !local.finishedAt ? local : null;
	});
	let recent = $derived($live.history.slice(0, HOME_RECENT_ROW_LIMIT));
	let monthly = $derived(progress30d($live.history, new Date()));
	const peekedIndex = peekExerciseIndexWithCustoms();
	let indexById = $state<Map<string, ExerciseIndexItem>>(
		peekedIndex ? new Map(peekedIndex.map((item) => [item.id, item])) : new Map()
	);
	let indexReady = $state(peekedIndex != null);

	let hasActive = $derived(Boolean(active && !active.finishedAt));
	let hasPlans = $derived($plans.length > 0);
	let hasSessionHistory = $derived(recent.length > 0);
	let isFirstTimeHome = $derived(!hasPlans && !hasSessionHistory);
	let isGuest = $derived($auth.ready && $auth.sessionKnown && $auth.configured && !$auth.user);
	let authHref = '/auth?next=%2F';
	let pageReady = $derived(
		$auth.ready && $auth.sessionKnown && $live.ready && $live.historyHydrated
	);

	/** Dev/QA: ?skeleton=create|start */
	let skeletonForce = $derived(
		readSearchParam($page.url, 'skeleton') === 'create'
			? ('create' as const)
			: readSearchParam($page.url, 'skeleton') === 'start'
				? ('start' as const)
				: null
	);
	/** app.html peek: signed-in session or saved plans before Svelte mounts (offline-safe). */
	let bootHasActiveSession = $derived.by(() => {
		if (data.bootPeek.activeSession) return true;
		if (!browser) return false;
		if (document.documentElement.dataset.homeActiveSession === '1') return true;
		const session = readActiveSession();
		return Boolean(session && !session.finishedAt);
	});
	let bootAccountPeek = $derived.by(() => {
		if (data.bootPeek.accountBoot) return true;
		if (!browser) return false;
		return peekAccountBoot();
	});
	let bootLikelyHasPlans = $derived.by(() => {
		if ($plans.length > 0) return true;
		if (data.bootPeek.hasPlans) return true;
		if (!browser) return false;
		if (peekHasLocalPlans()) return true;
		try {
			return document.cookie.includes('repdraft_home_has_plans=1');
		} catch {
			return false;
		}
	});
	let bootHomePeek = $derived.by((): 'create' | 'start' | null => {
		if (bootAccountPeek) return 'start';
		/* Local peeks beat stale SSR cookie (plans import / account race). */
		if (browser) {
			if (peekHasLocalPlans()) return 'start';
			const fromDom = document.documentElement.dataset.homeBoot;
			if (fromDom === 'start' || fromDom === 'create') return fromDom;
		}
		if (data.bootPeek.homeBoot === 'create' || data.bootPeek.homeBoot === 'start') {
			return data.bootPeek.homeBoot;
		}
		return null;
	});
	let bootLikelySignedIn = $derived.by(() => {
		if (bootAccountPeek) return true;
		if ($auth.ready && $auth.user) return true;
		if (!browser) return false;
		return peekLikelySignedInUserId() !== null;
	});
	let bootSkeletonVariant = $derived.by(() =>
		resolveHomeSkeletonVariant({
			force: skeletonForce,
			accountBoot: bootAccountPeek,
			likelySignedIn: bootLikelySignedIn,
			homeBoot: bootHomePeek,
			authReady: $auth.ready,
			hasUser: Boolean($auth.user),
			hasPlans: hasPlans || bootLikelyHasPlans
		})
	);
	let bootShowChecklist = $derived.by(() => {
		const onboardingShowsChecklist = $onboardingHydrated
			? shouldShowChecklist($onboarding)
			: browser
				? peekShouldShowChecklist()
				: Boolean(data.bootPeek.showChecklist);
		return shouldShowHomeChecklistSkeleton({
			onboardingShowsChecklist,
			hasPlans: hasPlans || bootLikelyHasPlans,
			homeBoot: bootHomePeek
		});
	});
	/** Plans cookie only from real local plans — not from account homeBoot=start. */
	let bootShowPlansColumn = $derived(
		bootSkeletonVariant === 'start' &&
			!bootLikelyHasPlans &&
			!bootHasActiveSession &&
			bootLikelySignedIn
	);
	let bootRecentRows = $derived.by(() => {
		if (data.bootPeek.hasHistory) return HOME_RECENT_ROW_LIMIT;
		const fromStore = $live.history.filter((session) => Boolean(session.finishedAt)).length;
		if (fromStore > 0) return HOME_RECENT_ROW_LIMIT;
		return readBootSkeletonRecentRows();
	});
	/** Loading (not QA force). Delayed in browser so fast local boots skip skeleton mount. */
	let isBootLoading = $derived(skeletonForce === null && !pageReady);
	let delayedBootSkeleton = createDelayedTrue(() => isBootLoading);
	// SSR: show skeleton immediately (no $effect delay). Client: delay to avoid FOLS.
	let showBootSkeleton = $derived(
		skeletonForce !== null || (!browser && isBootLoading) || delayedBootSkeleton.current
	);

	let isCreateHome = $derived(!hasPlans);
	let showGuestCreateHero = $derived(pageReady && isGuest && isCreateHome);
	/** Signed-in home, or guest who already has plans (needs Start, not only a list). */
	let showReadyHeader = $derived(
		pageReady && !showGuestCreateHero && (hasPlans || !isGuest)
	);
	/** Pinned plan wins; else split rotation after last finished. */
	let nextPlan = $derived.by(() =>
		resolveHomeNextPlan($plans, recent[0]?.planId, $homeNextPlan)
	);
	let nextPlanMuscles = $derived.by(() =>
		nextPlan && indexReady ? planTargetSummary(nextPlan, indexById, lang, 3) : ''
	);
	/** Same pills as the phone hero: ~45 мин · 7 упражнений · Грудь • Трицепс. */
	let nextPlanMeta = $derived.by(() => {
		if (!nextPlan || !indexReady) return '';
		const minutes = planEstimatedMinutes(nextPlan);
		return [
			minutes > 0 ? translate(lang, 'home.pillMinutes', { n: minutes }) : null,
			translatePlural(lang, 'home.pillExercises', planExerciseSlotCount(nextPlan)),
			nextPlanMuscles
		]
			.filter(Boolean)
			.join(' · ');
	});

	let mockupSubtitle = $derived.by(() => {
		if (hasActive) return translate(lang, 'home.readyTitle');
		if (nextPlan || hasPlans) return translate(lang, 'home.planToday');
		if (isFirstTimeHome) return translate(lang, 'home.welcomeLead');
		return translate(lang, 'home.noPlansLead');
	});
	let mockupCtaHref = $derived(
		nextPlan ? `/workouts/${nextPlan.id}` : hasPlans ? '/workouts' : BUILDER_NEW_HREF
	);
	let mockupCtaLabel = $derived(
		translate(lang, nextPlan || hasPlans ? 'home.begin' : 'workouts.create')
	);
	let mockupCtaAria = $derived(
		nextPlan
			? translate(lang, 'home.startWorkoutNamed', { name: nextPlan.name })
			: mockupCtaLabel
	);
	let mockupCardAria = $derived.by(() => {
		if (nextPlan) {
			return `${nextPlan.name}. ${translate(lang, 'home.nextPlanHint')}`;
		}
		return mockupCtaAria;
	});
	let continueRemaining = $derived.by(() => {
		if (!active) return '';
		if (isSessionFullyLogged(active)) {
			return translate(lang, 'home.remainingFinishReady');
		}
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

	const guestHeroPoints = [
		{ icon: NotebookPen, key: 'home.guestPointLog' as const },
		{ icon: Smartphone, key: 'home.guestPointLocal' as const },
		{ icon: UserRound, key: 'home.guestPointSync' as const }
	];

	let firstName = $derived(greetingFirstName($greetingName, $auth.user));
	let showGreeting = $derived($auth.ready && !isGuest);
	let greetingText = $derived.by(() => {
		const period = dayGreetingPeriod();
		const key = homeGreetingMessageKey(period, Boolean(firstName));
		return firstName ? translate(lang, key, { name: firstName }) : translate(lang, key);
	});
	let showHomeMid = $derived(
		!showGuestCreateHero &&
			(recent.length > 0 || !hasPlans || (hasPlans && !hasSessionHistory))
	);

	let showOnboardingChecklist = $derived(
		$onboardingHydrated &&
			pageReady &&
			shouldShowChecklist($onboarding) &&
			(isCreateHome || isFirstTimeHome)
	);
	let demoBusy = $state(false);

	$effect.pre(() => {
		if (pageReady && $onboardingHydrated) onboarding.markChecklist('homeSeen');
	});

	$effect(() => {
		if (hasPlans) onboarding.markChecklist('planReady');
	});

	async function onTryDemoPlan() {
		if (demoBusy) return;
		demoBusy = true;
		try {
			const planId = await onboarding.installDemoPlan();
			await goto(`/workouts/${planId}`);
		} catch (err) {
			toasts.show(translateError(lang, err, 'onboarding.demoFail'), 'error');
		} finally {
			demoBusy = false;
		}
	}

	onMount(() => {
		const clientPeek = readHomeClientBootPeek();
		if (clientPeek.accountBoot || clientPeek.hasPlans) {
			try {
				document.documentElement.dataset.homeBoot = clientPeek.homeBoot;
			} catch {
				/* ignore */
			}
		}
		let destroyed = false;
		let unsubIndex = () => {};
		/* Wait for auth readiness without tight polling (battery) or post-teardown work. */
		unsubIndex = auth.subscribe(async (state) => {
			if (!state.ready || destroyed || indexReady) return;
			unsubIndex();
			try {
				const index = await loadExerciseIndexWithCustoms();
				if (destroyed) return;
				indexById = new Map(index.map((item) => [item.id, item]));
				indexReady = true;
			} catch {
				/* catalog load failures surface later in the lists */
			}
		});
		return () => {
			destroyed = true;
			unsubIndex();
		};
	});
</script>

<SeoHead titleKey="seo.homeTitle" descriptionKey="app.metaDescription" path="/" />
<JsonLd data={[websiteJsonLd, webAppJsonLd]} />

<section
	class="home-page content-page"
	class:home-page--start={(pageReady && hasPlans) || (showBootSkeleton && bootSkeletonVariant === 'start' && !bootShowPlansColumn)}
	class:home-page--create={(pageReady && isCreateHome) || (showBootSkeleton && (bootSkeletonVariant === 'create' || bootShowPlansColumn))}
	class:home-page--guest={pageReady && isGuest}
	class:home-page--booting={showBootSkeleton}
	class:home-page--booting-start={showBootSkeleton && bootSkeletonVariant === 'start'}
	class:home-page--booting-create={showBootSkeleton && bootSkeletonVariant === 'create'}
	aria-labelledby="home-heading"
>
	{#if showBootSkeleton}
		<h1 id="home-heading" class="sr-only">{translate(lang, 'home.title')}</h1>
		<HomePageSkeleton
			label={translate(lang, 'common.loading')}
			variant={bootSkeletonVariant}
			showPlansColumn={bootShowPlansColumn}
			recentRows={bootRecentRows}
			hasActiveBoot={bootHasActiveSession}
			showChecklist={bootShowChecklist}
		/>
	{:else if isBootLoading}
		<!-- Delay window: no skeleton, no content (avoids FOLS). -->
	{:else if showReadyHeader && !hasActive}
		<header class="home-header home-header--mockup">
			<h1 id="home-heading" class="sr-only">{translate(lang, 'home.title')}</h1>
			<a class="home-header__row home-header__row--link" href={mockupCtaHref} aria-label={mockupCardAria}>
				<div class="home-header__copy">
					{#if showGreeting}
						<p class="home-header__greeting home-header__greeting--desktop">{greetingText}</p>
					{/if}
					{#if !isGuest}
						<p class="home-header__subtitle">{mockupSubtitle}</p>
						{#if hasPlans}
							<p class="home-header__plan">{nextPlan?.name ?? '\u00a0'}</p>
							<p class="home-header__meta" aria-busy={!nextPlan || !indexReady}>
								{nextPlan && indexReady ? nextPlanMeta : '\u00a0'}
							</p>
						{:else if isFirstTimeHome}
							<BrandTagline class="brand-tagline--home-header" />
						{/if}
					{:else}
						<p class="home-header__subtitle">{translate(lang, 'home.planToday')}</p>
						{#if hasPlans}
							<p class="home-header__plan">{nextPlan?.name ?? '\u00a0'}</p>
							<p class="home-header__meta" aria-busy={!nextPlan || !indexReady}>
								{nextPlan && indexReady ? nextPlanMeta : '\u00a0'}
							</p>
						{/if}
					{/if}
				</div>
				<span class="btn-primary home-header__cta home-header__cta--compact" aria-hidden="true">
					<LucideIcon icon={Play} weight="bold" size={ICON_PRIMARY} class="home-header__cta-icon" />
					<span class="home-header__cta-text home-header__cta-text--short"
						>{translate(lang, 'home.startWorkoutShort')}</span
					>
					<span class="home-header__cta-text home-header__cta-text--full">{mockupCtaLabel}</span>
				</span>
			</a>
		</header>
	{:else if showReadyHeader && hasActive}
		<h1 id="home-heading" class="sr-only">{translate(lang, 'home.title')}</h1>
	{:else if showGuestCreateHero}
		<h1 id="home-heading" class="sr-only">{translate(lang, 'home.title')}</h1>
	{:else}
		<header class="home-header">
			<div class="home-header__intro">
				<h1 id="home-heading" class="page-title home-header__title">{translate(lang, 'home.title')}</h1>
			</div>
		</header>
	{/if}

	{#if !isBootLoading && !showBootSkeleton}
	{#if assignment && !assignmentHidden}
		<div class="panel home-assignment">
			<div class="home-assignment__copy">
				<p class="home-assignment__kicker">{translate(lang, 'coach.assignedTitle')}</p>
				<p class="home-assignment__title">{assignment.planName}</p>
				{#if assignment.coachName}
					<p class="home-assignment__meta">{assignment.coachName}</p>
				{/if}
			</div>
			<div class="home-assignment__actions">
				<AppButton block disabled={assignmentBusy} onclick={() => void importAssignment()}>
					{translate(lang, 'coach.assignedAdd')}
				</AppButton>
				<AppButton
					variant="ghost"
					disabled={assignmentBusy}
					onclick={() => (assignmentHidden = true)}
				>
					{translate(lang, 'coach.assignedHide')}
				</AppButton>
			</div>
		</div>
	{/if}
	{#if hasActive && active}
		<a
			class="home-continue-card panel"
			href={liveContinueHref(active)}
			aria-label={translate(lang, 'home.continueWorkout')}
		>
			<div class="home-continue-card__copy">
				<p class="home-continue-card__eyebrow">{translate(lang, 'home.workoutInProgress')}</p>
				<p class="home-continue-card__title">{active.planName}</p>
				<p class="home-continue-card__meta">{continueRemaining}</p>
			</div>
			<span class="btn-primary home-continue-card__cta home-continue-card__cta--compact" aria-hidden="true">
				<LucideIcon icon={Play} weight="bold" size={ICON_PRIMARY} class="home-continue-card__cta-icon" />
				<span class="home-continue-card__cta-text">{translate(lang, 'home.continue')}</span>
			</span>
		</a>
	{/if}
	<div class="home-dashboard">
		{#if showOnboardingChecklist}
			<div class="home-dashboard-top home-dashboard-top--onboarding">
				<OnboardingChecklist onTryDemo={onTryDemoPlan} {demoBusy} articlesHref="/articles" />
			</div>
		{/if}
		{#if showGuestCreateHero}
			<div class="home-dashboard-top">
				<div class="home-hero home-hero--guest">
					<p class="home-hero-kicker">{translate(lang, 'home.guestTrainKicker')}</p>
					<h2 class="home-hero-title">{createHeroTitle}</h2>
					<p class="home-hero-meta">{createHeroLead}</p>
					<ul class="home-hero-points">
						{#each guestHeroPoints as point (point.key)}
							<li class="home-hero-point">
								<span class="home-hero-point__icon" aria-hidden="true">
									<LucideIcon icon={point.icon} size={ICON_SMALL} />
								</span>
								<span class="home-hero-point__text">{translate(lang, point.key)}</span>
							</li>
						{/each}
					</ul>
					{#if isFirstTimeHome}
						<BrandTagline class="brand-tagline--hero" />
					{/if}
					<div class="home-hero-actions">
						<AppButton
							href={BUILDER_NEW_HREF}
							variant={showOnboardingChecklist ? 'secondary' : undefined}
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
			</div>
		{/if}

		{#if showHomeMid}
			<div class="home-dashboard-mid">
				<div class="home-dashboard-aside">
					{#if monthly.workouts > 0}
						<div class="home-section">
							<div class="home-section-head">
								<h2 class="section-title">{translate(lang, 'home.progress30Title')}</h2>
								<a class="home-section-link" href="/progress">
									{translate(lang, 'home.progressOpen')}
									<LucideIcon icon={ChevronRight} size={ICON_SMALL} />
								</a>
							</div>
							<a
								class="home-monthly"
								href="/progress"
								aria-label={translate(lang, 'nav.progress')}
							>
								<div class="home-monthly__stat panel">
									<span class="home-monthly__label">{translate(lang, 'progress.cardWorkouts')}</span>
									<span class="home-monthly__value tabular-nums">{monthly.workouts}</span>
									<span
										class:home-monthly__delta--flat={monthly.workoutsDeltaWeek <= 0}
										class="home-monthly__delta"
									>
										{deltaLabel(monthly.workoutsDeltaWeek, 'workouts')}
									</span>
								</div>
								<div class="home-monthly__stat panel">
									<span class="home-monthly__label">{translate(lang, 'progress.cardVolume')}</span>
									<span class="home-monthly__value home-monthly__value--kg tabular-nums">
										{formatKgInt(monthly.volumeKg)} кг
									</span>
									<span
										class:home-monthly__delta--flat={monthly.volumeDeltaWeek <= 0}
										class="home-monthly__delta"
									>
										{deltaLabel(monthly.volumeDeltaWeek, 'volume')}
									</span>
								</div>
							</a>
						</div>
					{/if}
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
										<a
											class="entity-row entity-row--link"
											href={`/workouts/history/${session.id}`}
										>
											<span class="entity-row__main">
												<span class="entity-row__title">{session.planName}</span>
												<span class="entity-row__meta">{recentMeta(session)}</span>
											</span>
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{:else if hasPlans}
						<div class="home-section">
							<div class="home-section-head">
								<h2 class="section-title">{translate(lang, 'home.firstWorkoutTitle')}</h2>
							</div>
							<AppPanel class="home-aside-card home-aside-card--compact">
								<p class="home-aside-card__hint">
									{translate(lang, 'home.firstWorkoutHint')}
								</p>
							</AppPanel>
						</div>
					{:else if !isGuest}
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

					<div class="home-section">
						<div class="home-section-head">
							<h2 class="section-title">{translate(lang, 'home.coachTitle')}</h2>
						</div>
						<ul class="entity-list">
							<li>
								<a class="entity-row entity-row--link" href="/clients">
									<LucideIcon icon={UsersThree} size={ICON_PRIMARY} class="entity-row__icon" />
									<span class="entity-row__main">
										<span class="entity-row__title">{translate(lang, 'home.coachEntry')}</span>
										<span class="entity-row__meta">{translate(lang, 'home.coachEntryHint')}</span>
									</span>
									<LucideIcon
										icon={ChevronRight}
										size={ICON_SMALL}
										class="entity-row__chevron"
									/>
								</a>
							</li>
						</ul>
					</div>
				</div>
			</div>
		{/if}
	</div>
	{/if}
</section>
