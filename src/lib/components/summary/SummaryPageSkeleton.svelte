<script lang="ts">
	import AppPanel from '$lib/components/AppPanel.svelte';
	import {
		isOnboardingActivated,
		ONBOARDING_STORAGE_KEY,
		parseOnboardingState
	} from '$lib/domain/onboarding';
	import { sessionVolumeKg } from '$lib/domain/session';
	import { translate } from '$lib/i18n/messages';
	import { peekLocalSession } from '$lib/storage/localSessionRepository';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { browser } from '$app/environment';

	const GUEST_SYNC_DISMISS_KEY = 'repdraft:guest-sync-hint-dismissed';

	let {
		sessionId = '',
		showGuestHint = false
	}: {
		sessionId?: string;
		showGuestHint?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);

	type PreviewRow = { setCount: number };

	let peek = $derived.by(() => (sessionId ? peekLocalSession(sessionId) : null));

	let previewRows = $derived.by((): PreviewRow[] => {
		if (!peek) return [{ setCount: 3 }];
		const rows = peek.exercises
			.map((ex) => ({ setCount: ex.sets.filter((s) => s.completed).length }))
			.filter((row) => row.setCount > 0);
		return rows.length > 0 ? rows : [{ setCount: 3 }];
	});

	let showVolume = $derived(peek ? sessionVolumeKg(peek) > 0 : false);
	let planName = $derived(peek?.planName ?? '');
	let statCount = $derived(showVolume ? 4 : 3);

	let showFirstFinish = $derived.by(() => {
		if (!browser) return false;
		try {
			const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
			if (!raw) return true;
			return !isOnboardingActivated(parseOnboardingState(JSON.parse(raw) as unknown));
		} catch {
			return false;
		}
	});

	let guestDismissed = $derived.by(() => {
		if (!browser) return false;
		try {
			return localStorage.getItem(GUEST_SYNC_DISMISS_KEY) === '1';
		} catch {
			return false;
		}
	});

	let guestHint = $derived(showGuestHint && !$auth.user && !showFirstFinish && !guestDismissed);
</script>

<section
	class="summary-page summary-page--skeleton content-page content-page--narrow pb-mobile-actions text-center lg:pb-0 page-skeleton page-skeleton--summary"
	aria-busy="true"
	aria-live="polite"
>
	<header class="screen-header summary-skeleton-head text-left" aria-hidden="true">
		<div class="screen-header__bar">
			<div class="summary-skeleton-head__back"></div>
		</div>
		<h1 class="screen-header-title">{translate(lang, 'summary.title')}</h1>
	</header>

	<div class="summary-hero" aria-hidden="true">
		<div class="summary-check summary-skeleton-check"></div>
		<h1 class="summary-hero__title summary-skeleton-hero-title">{translate(lang, 'summary.title')}</h1>
		{#if planName}
			<p class="summary-hero__plan">{planName}</p>
		{:else}
			<div class="summary-skeleton-plan-bone"></div>
		{/if}
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

	<dl class="summary-stats" class:summary-stats--with-volume={showVolume} aria-hidden="true">
		{#each Array.from({ length: statCount }, (_, i) => i) as i (i)}
			<div class="summary-stat">
				<dt class="summary-stat__label">
					{#if i === 0}
						{translate(lang, 'summary.duration')}
					{:else if i === 1}
						{translate(lang, 'summary.exercises')}
					{:else if i === 2}
						{translate(lang, 'summary.sets')}
					{:else}
						{translate(lang, 'summary.volume')}
					{/if}
				</dt>
				<dd class="summary-stat__value summary-skeleton-stat-value tabular-nums">0</dd>
			</div>
		{/each}
	</dl>

	{#if previewRows.length > 0}
		<div class="summary-exercises-preview" aria-hidden="true">
			<p class="summary-exercises-preview__heading">
				{translate(lang, 'summary.previewExercises')}
			</p>
			<div class="summary-exercises-preview__list">
				{#each previewRows as row, i (i)}
					<div class="summary-exercises-preview__item">
						<div class="summary-exercises-preview__thumb media-well summary-skeleton-preview-thumb"></div>
						<p class="summary-exercises-preview__name summary-skeleton-preview-name"></p>
						<ul class="summary-exercises-preview__sets">
							{#each Array.from({ length: row.setCount }, (_, si) => si) as si (si)}
								<li class="summary-exercises-preview__set">
									<span class="summary-exercises-preview__set-i tabular-nums" aria-hidden="true"
										>{si + 1}</span
									>
									<span class="summary-exercises-preview__set-val summary-skeleton-set-val tabular-nums"
										>00</span
									>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if guestHint}
		<AppPanel
			class="summary-guest-hint text-left"
			role="region"
			aria-label={translate(lang, 'summary.guestSyncTitle')}
		>
			<p class="summary-guest-hint__title">{translate(lang, 'summary.guestSyncTitle')}</p>
			<p class="summary-guest-hint__lead">{translate(lang, 'summary.guestSyncLead')}</p>
			<div class="summary-guest-hint__actions">
				<div class="summary-skeleton-guest-cta"></div>
				<div class="summary-skeleton-guest-dismiss"></div>
			</div>
		</AppPanel>
	{/if}

	<div class="sticky-actions summary-page__done-sticky lg:hidden" aria-hidden="true">
		<div class="sticky-actions__inner summary-actions summary-actions--stack">
			<div class="summary-skeleton-done-btn"></div>
			<div class="summary-skeleton-details-link"></div>
		</div>
	</div>
</section>
