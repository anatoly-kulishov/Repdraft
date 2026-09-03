<script lang="ts">
	import AppPanel from '$lib/components/AppPanel.svelte';
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';
	import BrandTagline from '$lib/components/BrandTagline.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import {
		ONBOARDING_CHECKLIST_STEPS,
		type OnboardingChecklistStep
	} from '$lib/domain/onboarding';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { LogIn, NotebookPen, Play, Plus, Smartphone, UserRound } from '@lucide/svelte';
	import { browser } from '$app/environment';
	import { HOME_RECENT_ROW_LIMIT } from '$lib/domain/home';
	import { peekLocalHistoryCount, readActiveSession } from '$lib/storage/localSessionRepository';

	let {
		label,
		variant = 'start',
		recentRows = 0,
		showPlansColumn = false,
		hasActiveBoot = false,
		showChecklist = false
	}: {
		label: string;
		/** create = guest empty hero; start = mockup CTA + aside */
		variant?: 'create' | 'start';
		/** Recent history rows in aside. 0 = placeholder hint card. */
		recentRows?: number;
		/** Signed-in empty home (no plans): mockup CTA + recent placeholder skeleton. */
		showPlansColumn?: boolean;
		/** app.html / local peek: in-progress workout on home boot. */
		hasActiveBoot?: boolean;
		/** Onboarding checklist visible above hero on first visits. */
		showChecklist?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);

	const stepLabelKey: Record<OnboardingChecklistStep, string> = {
		homeSeen: 'onboarding.stepHome',
		planReady: 'onboarding.stepPlan',
		liveEntered: 'onboarding.stepLive',
		setLogged: 'onboarding.stepSet',
		sessionFinished: 'onboarding.stepFinish'
	};

	let skeletonRecentRows = $derived.by(() => {
		if (!browser) {
			return Math.min(Math.max(recentRows, 0), HOME_RECENT_ROW_LIMIT);
		}
		const fromDom = document.documentElement.dataset.homeRecentRows;
		if (fromDom) {
			const parsed = Number.parseInt(fromDom, 10);
			if (Number.isFinite(parsed) && parsed > 0) return HOME_RECENT_ROW_LIMIT;
		}
		try {
			if (document.cookie.includes('repdraft_home_has_history=1')) {
				return HOME_RECENT_ROW_LIMIT;
			}
		} catch {
			/* ignore */
		}
		if (peekLocalHistoryCount() > 0) return HOME_RECENT_ROW_LIMIT;
		return Math.min(Math.max(recentRows, 0), HOME_RECENT_ROW_LIMIT);
	});

	let skeletonHasActiveBoot = $derived.by(() => {
		if (hasActiveBoot) return true;
		if (!browser) return false;
		if (document.documentElement.dataset.homeActiveSession === '1') return true;
		try {
			if (document.cookie.includes('repdraft_home_active=1')) return true;
		} catch {
			/* ignore */
		}
		const session = readActiveSession();
		return Boolean(session && !session.finishedAt);
	});

	let mockupLeadKey = $derived(
		showPlansColumn && skeletonRecentRows > 0 ? 'home.noPlansLead' : 'home.welcomeLead'
	);

	const guestHeroPoints = [
		{ icon: NotebookPen, key: 'home.guestPointLog' as const },
		{ icon: Smartphone, key: 'home.guestPointLocal' as const },
		{ icon: UserRound, key: 'home.guestPointSync' as const }
	];
</script>

<span class="sr-only">{label}</span>

{#snippet checklistSkeleton()}
	<div class="home-dashboard-top home-dashboard-top--onboarding" aria-hidden="true">
		<AppPanel class="onboarding-checklist home-skeleton-checklist">
			<div class="onboarding-checklist__head">
				<div class="onboarding-checklist__intro min-w-0">
					<p class="onboarding-checklist__kicker home-skel-bone">
						{translate(lang, 'onboarding.checklistKicker')}
					</p>
					<h2 class="onboarding-checklist__title home-skel-bone">
						{translate(lang, 'onboarding.checklistTitle')}
					</h2>
					<p class="onboarding-checklist__meta home-skel-bone">
						{translate(lang, 'onboarding.checklistProgress', { done: '1', total: '5' })}
					</p>
				</div>
				<div class="onboarding-checklist__progress" aria-hidden="true">
					<span class="onboarding-checklist__progress-fill" style="width: 20%"></span>
				</div>
			</div>
			<ul class="onboarding-checklist__steps">
				{#each ONBOARDING_CHECKLIST_STEPS as step (step)}
					<li class="onboarding-checklist__step">
						<span class="onboarding-checklist__icon home-skel-bone home-skel-bone--icon-round">
							&nbsp;
						</span>
						<span class="onboarding-checklist__label home-skel-bone">
							{translate(lang, stepLabelKey[step])}
						</span>
					</li>
				{/each}
			</ul>
			<div class="onboarding-checklist__actions">
				<span
					class="btn-secondary onboarding-checklist__demo home-skel-bone home-skel-bone--cta"
				>
					{translate(lang, 'onboarding.tryDemo')}
				</span>
				<div class="onboarding-checklist__articles entity-row entity-row--link">
					<span class="onboarding-checklist__articles-icon home-skel-bone home-skel-bone--icon-round">
						&nbsp;
					</span>
					<span class="entity-row__main">
						<span class="entity-row__title home-skel-bone">
							{translate(lang, 'articles.homeTeaserTitle')}
						</span>
						<span class="entity-row__meta home-skel-bone">
							{translate(lang, 'onboarding.gettingStartedLead')}
						</span>
					</span>
				</div>
			</div>
		</AppPanel>
	</div>
{/snippet}

{#snippet asideSkeleton()}
	<div class="home-dashboard-aside">
		<div class="home-section">
			<div class="home-skeleton-section-head">
				<AppSkeleton class="home-skeleton-heading" />
				{#if skeletonRecentRows > 0}
					<AppSkeleton class="home-skeleton-section-link" />
				{/if}
			</div>
			{#if skeletonRecentRows > 0}
				<ul class="entity-list home-skeleton-recent-list">
					{#each Array.from({ length: skeletonRecentRows }, (_, i) => i) as i (i)}
						<li>
							<div class="entity-row home-skeleton-recent-row">
								<span class="entity-row__main">
									<AppSkeleton class="home-skeleton-recent-title" />
									<AppSkeleton class="home-skeleton-recent-meta" />
								</span>
								<AppSkeleton class="home-skeleton-recent-chevron" />
							</div>
						</li>
					{/each}
				</ul>
			{:else if showPlansColumn}
				<div class="home-aside-card home-aside-card--compact panel home-skeleton-aside-card">
					<AppSkeleton class="home-skeleton-aside-hint" />
				</div>
			{:else if !showChecklist}
				<div class="home-aside-card home-aside-card--compact panel home-skeleton-aside-card">
					<AppSkeleton class="home-skeleton-aside-hint" />
				</div>
			{/if}
		</div>
	</div>
{/snippet}

{#if variant === 'create'}
	<div
		class="home-dashboard home-skeleton home-skeleton--create"
		class:home-skeleton--with-checklist={showChecklist}
		aria-busy="true"
		aria-live="polite"
	>
		{#if showChecklist}
			{@render checklistSkeleton()}
		{/if}
		<div class="home-dashboard-top" aria-hidden="true">
			<div class="home-hero home-hero--guest home-skeleton-create-hero">
				<p class="home-hero-kicker home-skel-bone">
					{translate(lang, 'home.guestTrainKicker')}
				</p>
				<h2 class="home-hero-title home-skel-bone">
					{translate(lang, 'home.guestTrainTitle')}
				</h2>
				<p class="home-hero-meta home-skel-bone">
					{translate(lang, 'home.guestTrainLead')}
				</p>
				<ul class="home-hero-points">
					{#each guestHeroPoints as point (point.key)}
						<li class="home-hero-point">
							<span class="home-hero-point__icon home-skel-bone home-skel-bone--icon">
								<LucideIcon icon={point.icon} size={ICON_SMALL} />
							</span>
							<span class="home-hero-point__text home-skel-bone">
								{translate(lang, point.key)}
							</span>
						</li>
					{/each}
				</ul>
				<BrandTagline class="brand-tagline--hero home-skel-bone" />
				<div class="home-hero-actions">
					<span class="home-hero-cta home-skel-bone home-skel-bone--cta">
						<LucideIcon icon={Plus} size={ICON_PRIMARY} />
						{translate(lang, 'home.guestCreateLocal')}
					</span>
					<span class="home-hero-secondary home-skel-bone home-skel-bone--cta">
						<LucideIcon icon={LogIn} size={ICON_PRIMARY} />
						{translate(lang, 'nav.signIn')}
					</span>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div
		class="home-skeleton home-skeleton--start"
		class:home-skeleton--continue={skeletonHasActiveBoot}
		class:home-skeleton--with-checklist={showChecklist}
		aria-busy="true"
		aria-live="polite"
	>
		{#if skeletonHasActiveBoot}
			<div class="home-continue-card panel home-skeleton-continue-card" aria-hidden="true">
				<div class="home-continue-card__copy">
					<p class="home-continue-card__eyebrow home-skel-bone">
						{translate(lang, 'home.workoutInProgress')}
					</p>
					<p class="home-continue-card__title home-skel-bone">
						{translate(lang, 'builder.untitled')}
					</p>
					<p class="home-continue-card__meta home-skel-bone">
						{translate(lang, 'home.remainingProgress', { exercises: 5, sets: 15 })}
					</p>
				</div>
				<span class="btn-primary home-continue-card__cta home-continue-card__cta--compact home-skel-bone home-skel-bone--cta-round" aria-hidden="true">
					<LucideIcon icon={Play} size={ICON_PRIMARY} class="home-continue-card__cta-icon" />
					<span class="home-continue-card__cta-text">{translate(lang, 'home.continue')}</span>
				</span>
			</div>
		{:else if showPlansColumn}
			<header class="home-header home-header--mockup home-skeleton-mockup" aria-hidden="true">
				<div class="home-header__row">
					<div class="home-header__copy">
						<p class="home-header__subtitle home-skel-bone">
							{translate(lang, mockupLeadKey)}
						</p>
						{#if skeletonRecentRows === 0}
							<BrandTagline class="brand-tagline--home-header home-skel-bone" />
						{/if}
					</div>
					<span
						class="btn-primary home-header__cta home-header__cta--compact home-skel-bone home-skel-bone--cta-round"
						aria-hidden="true"
					>
						<LucideIcon icon={Play} size={ICON_PRIMARY} class="home-header__cta-icon" />
						<span class="home-header__cta-text home-header__cta-text--short">
							{translate(lang, 'home.startWorkoutShort')}
						</span>
					</span>
				</div>
			</header>
		{:else}
			<div class="home-skeleton-top-card panel" aria-hidden="true">
				<div class="home-skeleton-top-card__copy">
					<AppSkeleton class="home-skeleton-top-line home-skeleton-top-line--subtitle" />
					<AppSkeleton class="home-skeleton-top-line home-skeleton-top-line--title" />
					<AppSkeleton class="home-skeleton-top-line home-skeleton-top-line--meta" />
				</div>
				<AppSkeleton class="home-skeleton-top-cta" />
			</div>
		{/if}

		<div class="home-dashboard" aria-hidden="true">
			{#if showChecklist}
				{@render checklistSkeleton()}
			{/if}
			<div class="home-dashboard-mid">
				{@render asideSkeleton()}
			</div>
		</div>
	</div>
{/if}
