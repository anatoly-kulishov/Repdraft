<script lang="ts">
	import { PLANS_STORAGE_KEY } from '$lib/domain/repository';
	import type { WorkoutPlan } from '$lib/domain/types';
	import { browser } from '$app/environment';

	let {
		planId = '',
		exerciseCount = 3,
		setRows = 3
	}: {
		planId?: string;
		exerciseCount?: number;
		setRows?: number;
	} = $props();

	let navCount = $derived.by(() => {
		let exercises = Math.min(Math.max(exerciseCount, 1), 5);
		let sets = Math.min(Math.max(setRows, 1), 6);
		if (!browser || !planId) return { exercises, sets };
		try {
			const raw = localStorage.getItem(PLANS_STORAGE_KEY);
			if (!raw) return { exercises, sets };
			const plans = JSON.parse(raw) as WorkoutPlan[];
			if (!Array.isArray(plans)) return { exercises, sets };
			const plan = plans.find((p) => p.id === planId);
			if (!plan) return { exercises, sets };
			exercises = Math.min(Math.max(plan.exercises.length, 1), 5);
			const firstSets = plan.exercises[0]?.sets;
			if (firstSets != null) sets = Math.min(Math.max(firstSets, 1), 6);
			return { exercises, sets };
		} catch {
			return { exercises, sets };
		}
	});

	// ponytail: coachmark renders after onboarding hydrate; omit from skeleton to avoid panel shift
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
				{#each Array.from({ length: navCount.exercises }, (_, i) => i) as i (i)}
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
						{#each Array.from({ length: navCount.sets }, (_, si) => si) as si (si)}
							<li class="live-set-row live-skeleton-set-row" class:is-current={si === 0}>
								<span class="live-skeleton-set-index"></span>
								<span class="live-skeleton-set-input"></span>
								<span class="live-skeleton-set-input"></span>
								<span class="live-skeleton-set-done"></span>
							</li>
						{/each}
					</ul>
				</section>
				<div class="live-panel__tools" aria-hidden="true">
					<span class="live-skeleton-add-set"></span>
				</div>
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
