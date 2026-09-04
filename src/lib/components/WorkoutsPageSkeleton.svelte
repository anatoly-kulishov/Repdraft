<script lang="ts">
	import AppPanel from '$lib/components/AppPanel.svelte';
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import {
		WORKOUTS_HISTORY_SKELETON_ROW_LIMIT,
		WORKOUTS_PLANS_SKELETON_ROW_LIMIT
	} from '$lib/domain/home';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ClipboardList, Clock } from '@lucide/svelte';

	export type WorkoutsSkeletonVariant =
		| 'plans-list'
		| 'plans-empty'
		| 'history-list'
		| 'history-empty';

	let {
		label,
		rows = 1,
		variant = 'plans-list',
		historyEmptyCtaLabel = ''
	}: {
		label: string;
		rows?: number;
		variant?: WorkoutsSkeletonVariant;
		historyEmptyCtaLabel?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
	let rowCap = $derived(
		variant === 'history-list'
			? WORKOUTS_HISTORY_SKELETON_ROW_LIMIT
			: WORKOUTS_PLANS_SKELETON_ROW_LIMIT
	);
	let skeletonRows = $derived(Math.min(Math.max(rows, 1), rowCap));
</script>

<div
	class="workouts-skeleton"
	class:workouts-skeleton--history={variant === 'history-list' || variant === 'history-empty'}
	data-workouts-skeleton-variant={variant}
	aria-busy="true"
	aria-live="polite"
>
	<span class="sr-only">{label}</span>
	{#if variant === 'plans-empty'}
		<AppPanel
			dashed
			class="empty-state flex flex-col gap-3 py-6 empty-state--centered items-center text-center workouts-skeleton-empty"
			aria-hidden="true"
		>
			<div class="empty-state__icon" aria-hidden="true">
				<LucideIcon icon={ClipboardList} size={28} />
			</div>
			<div class="empty-state__copy">
				<h2 class="section-title empty-state__title workouts-skel-bone">
					{translate(lang, 'workouts.emptyTitle')}
				</h2>
				<p class="empty-state__desc max-w-md leading-relaxed workouts-skel-bone">
					{translate(lang, 'workouts.emptyDesc')}
				</p>
			</div>
			<div class="empty-state__actions mt-1 flex w-full flex-col gap-2 items-stretch">
				<span class="btn-primary empty-state__action workouts-skel-bone workouts-skel-bone--cta">
					{translate(lang, 'workouts.create')}
				</span>
				<span
					class="btn-secondary empty-state__action workouts-skel-bone workouts-skel-bone--cta"
				>
					{translate(lang, 'settings.importJson')}
				</span>
				<span class="btn-link mt-2 workouts-skel-bone workouts-skel-bone--link">
					{translate(lang, 'onboarding.emptyPlansDemo')}
				</span>
			</div>
		</AppPanel>
	{:else if variant === 'history-empty'}
		<AppPanel
			dashed
			class="empty-state empty-state--history flex flex-col gap-3 py-6 empty-state--centered items-center text-center workouts-skeleton-empty workouts-skeleton-empty--history"
			aria-hidden="true"
		>
			<div class="empty-state__icon" aria-hidden="true">
				<LucideIcon icon={Clock} size={28} />
			</div>
			<div class="empty-state__copy">
				<h2 class="section-title empty-state__title workouts-skel-bone">
					{translate(lang, 'workouts.historyEmptyTitle')}
				</h2>
				<p class="empty-state__desc max-w-md leading-relaxed workouts-skel-bone">
					{translate(lang, 'onboarding.historyEmptyLead')}
				</p>
			</div>
			<div class="empty-state__actions mt-1 flex w-full flex-col gap-2 items-stretch">
				<div class="workouts-history-mock entity-row workouts-skeleton-history-mock" aria-hidden="true">
					<div class="entity-row__main">
						<span class="workouts-history-mock__label workouts-skel-bone">
							{translate(lang, 'onboarding.historyMockEyebrow')}
						</span>
						<span class="entity-row__title workouts-skel-bone">
							{translate(lang, 'onboarding.historyMockTitle')}
						</span>
						<span class="entity-row__meta workouts-skel-bone">
							{translate(lang, 'onboarding.historyMockMeta')}
						</span>
					</div>
				</div>
				<span
					class="btn-link block w-full empty-state__action workouts-skel-bone workouts-skeleton-empty__import-link"
				>
					{translate(lang, 'settings.importJson')}
				</span>
				<span class="btn-primary empty-state__action workouts-skel-bone workouts-skel-bone--cta">
					{historyEmptyCtaLabel}
				</span>
			</div>
		</AppPanel>
	{:else if variant === 'history-list'}
		<div class="workouts-history-tools workouts-history-tools--skeleton" aria-hidden="true">
			<div class="workouts-page__search">
				<div class="workouts-skeleton-search">
					<AppSkeleton class="workouts-skeleton-search__icon skeleton-shimmer" />
					<AppSkeleton class="workouts-skeleton-search__field skeleton-shimmer" />
				</div>
			</div>
			<div class="workouts-history-tools__dates">
				<span class="workouts-skeleton-chip"></span>
				<span class="workouts-skeleton-chip workouts-skeleton-chip--period"></span>
			</div>
		</div>
		<ul class="entity-list entity-list--cards workouts-skeleton-list workouts-skeleton-list--history" aria-hidden="true">
			{#each Array.from({ length: skeletonRows }, (_, i) => i) as i (i)}
				<li>
					<div class="workouts-skeleton-card">
						<div class="entity-row workouts-skeleton-history-row">
							<span class="entity-row__main">
								<AppSkeleton class="workouts-skeleton-eyebrow skeleton-shimmer" />
								<AppSkeleton class="workouts-skeleton-title skeleton-shimmer" />
								<AppSkeleton class="workouts-skeleton-meta skeleton-shimmer" />
							</span>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="workouts-page__search">
			<div class="workouts-skeleton-search" aria-hidden="true">
				<AppSkeleton class="workouts-skeleton-search__icon skeleton-shimmer" />
				<AppSkeleton class="workouts-skeleton-search__field skeleton-shimmer" />
			</div>
		</div>
		<ul class="entity-list entity-list--cards workouts-skeleton-list" aria-hidden="true">
			{#each Array.from({ length: skeletonRows }, (_, i) => i) as i (i)}
				<li>
					<div class="workouts-skeleton-card">
						<div class="entity-row workouts-skeleton-row">
							<span class="entity-row__main">
								<AppSkeleton class="workouts-skeleton-title skeleton-shimmer" />
								<AppSkeleton class="workouts-skeleton-meta skeleton-shimmer" />
								<AppSkeleton class="workouts-skeleton-meta-row skeleton-shimmer" />
							</span>
							<AppSkeleton class="workouts-skeleton-menu skeleton-shimmer" />
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
