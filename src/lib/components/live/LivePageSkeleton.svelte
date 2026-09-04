<script lang="ts">
	import LiveLoggingCoachmarkSkeleton from '$lib/components/live/LiveLoggingCoachmarkSkeleton.svelte';
	import { peekShouldShowCoachmark } from '$lib/domain/onboarding';
	import { browser } from '$app/environment';

	/** Kept for callers (`planId={params.planId}`); counts are fixed — see SKEL_* below. */
	let { planId: _planId = '' }: { planId?: string } = $props();

	/*
	 * Fixed slot counts (not localStorage peek).
	 * Old $derived peek morphs 3→N after SSR hydrate and causes the live skeleton jump.
	 */
	const SKEL_EXERCISES = 5;
	/** Match typical plan / e2e seed (3). Extra ready rows grow the panel; avoid taller-skeleton WARN. */
	const SKEL_SETS = 3;

	// Client peek — same pattern as home checklist skeleton. SSR omits (no localStorage).
	const showLoggingCoachmark = browser && peekShouldShowCoachmark('live.logging');
</script>

<section
	class="live-page live-page--skeleton page-skeleton page-skeleton--live"
	aria-busy="true"
	aria-live="polite"
>
	<header
		class="live-skeleton-head screen-header screen-header--fixed screen-header--live lg:hidden"
		aria-hidden="true"
	>
		<div class="screen-header__bar">
			<div class="live-skeleton-head__back"></div>
			<div class="screen-header-actions">
				<div class="live-skeleton-head__timer"></div>
			</div>
		</div>
		<div class="live-skeleton-head__title screen-header-title"></div>
	</header>
	<div class="screen-header-spacer lg:hidden" aria-hidden="true"></div>

	<div class="live-mobile-meta lg:hidden" aria-hidden="true">
		<span class="live-progress-pill live-skeleton-progress"></span>
	</div>

	<div class="live-workspace">
		<nav class="live-nav" aria-hidden="true">
			<ul class="live-nav-list">
				{#each Array.from({ length: SKEL_EXERCISES }, (_, i) => i) as i (i)}
					<li class="live-nav-li">
						<div class="live-skeleton-nav-item" class:live-skeleton-nav-item--active={i === 0}>
							<span class="live-skeleton-nav-item__title"></span>
							<span class="live-skeleton-nav-item__meta"></span>
						</div>
					</li>
				{/each}
			</ul>
		</nav>

		<div class="live-panel-wrap">
			{#if showLoggingCoachmark}
				<LiveLoggingCoachmarkSkeleton />
			{/if}
			<div class="live-panel live-panel--skeleton">
				<header class="live-panel__hero">
					<div class="live-panel-head">
						<div class="live-panel-thumb live-skeleton-thumb" aria-hidden="true"></div>
						<div class="live-panel-head__copy">
							<div class="live-skeleton-panel-title" aria-hidden="true"></div>
							<div class="live-skeleton-panel-meta" aria-hidden="true"></div>
							<span class="live-set-badge live-skeleton-set-badge" aria-hidden="true"></span>
						</div>
						<div class="live-panel-head__actions" aria-hidden="true">
							<span class="live-skeleton-panel-action"></span>
						</div>
					</div>
				</header>

				<section class="live-panel__log" aria-hidden="true">
					<div class="live-set-head">
						<span class="live-skeleton-set-head-label"></span>
						<span class="live-skeleton-set-head-label"></span>
						<span class="live-skeleton-set-head-label"></span>
						<span class="live-skeleton-set-head-done"></span>
					</div>
					<ul class="live-set-list">
						{#each Array.from({ length: SKEL_SETS }, (_, si) => si) as si (si)}
							<li class="live-set-li">
								<div class="live-set-row live-skeleton-set-row" class:is-current={si === 0}>
									<span class="live-skeleton-set-index"></span>
									<span class="live-skeleton-set-input live-skeleton-set-input--weight"></span>
									<span class="live-skeleton-set-input live-skeleton-set-input--reps"></span>
									<span class="live-skeleton-set-done"></span>
								</div>
							</li>
						{/each}
					</ul>
					<div class="live-panel__tools" aria-hidden="true">
						<span class="live-skeleton-add-set"></span>
					</div>
				</section>
			</div>
		</div>

		<div class="live-mobile-actions lg:hidden" aria-hidden="true">
			<div class="live-sticky-actions sticky-actions live-skeleton-actions">
				<div class="sticky-actions__inner live-session-pair">
					<span class="live-skeleton-action-btn"></span>
					<span class="live-skeleton-action-btn"></span>
				</div>
			</div>
		</div>
	</div>
</section>
