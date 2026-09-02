<script lang="ts">
	import AppPanel from '$lib/components/AppPanel.svelte';
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';
	import BuilderSupersetBannerSkeleton from '$lib/components/builder/BuilderSupersetBannerSkeleton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Plus } from '@lucide/svelte';

	let {
		rows = 4,
		showField = false,
		previewRows = 0,
		showVolumeStat = false,
		showGuestHint = false,
		setRows = 3,
		hideHeader = false,
		groupBanner = 'none',
		variant = 'default'
	}: {
		rows?: number;
		showField?: boolean;
		previewRows?: number;
		showVolumeStat?: boolean;
		showGuestHint?: boolean;
		setRows?: number;
		hideHeader?: boolean;
		groupBanner?: 'none' | 'hint' | 'coachmark';
		variant?:
			| 'default'
			| 'history'
			| 'live'
			| 'builder'
			| 'builder-empty'
			| 'auth'
			| 'auth-guest'
			| 'summary';
	} = $props();

	let lang = $derived($resolvedLocale);
</script>

<div class={`page-skeleton page-skeleton--${variant}`} aria-busy="true" aria-live="polite">
	{#if variant === 'history'}
		{#if !hideHeader}
			<div class="page-skeleton-header" aria-hidden="true">
				<AppSkeleton class="page-skeleton-title page-skeleton-title--lg" />
				<AppSkeleton class="page-skeleton-toolbar" />
			</div>
			<AppSkeleton class="page-skeleton-meta" aria-hidden="true" />
		{/if}
		{#each Array.from({ length: Math.max(1, rows) }, (_, i) => i) as i (i)}
			<div class="page-skeleton-card" aria-hidden="true">
				<div class="page-skeleton-card__head">
					<AppSkeleton class="page-skeleton-thumb" />
					<div class="page-skeleton-card__body">
						<AppSkeleton class="page-skeleton-title" />
						<AppSkeleton class="page-skeleton-line page-skeleton-line--short" />
					</div>
				</div>
				<div class="page-skeleton-sets">
					{#each Array.from({ length: Math.max(1, setRows) }, (_, si) => si) as si (si)}
						<AppSkeleton class="page-skeleton-set" />
					{/each}
				</div>
			</div>
		{/each}
	{:else if variant === 'live'}
		<div class="page-skeleton-header" aria-hidden="true">
			<AppSkeleton class="page-skeleton-title page-skeleton-title--lg" />
			<AppSkeleton class="page-skeleton-meta page-skeleton-meta--pill" />
		</div>
		<div class="page-skeleton-pills" aria-hidden="true">
			<AppSkeleton class="page-skeleton-pill" />
			<AppSkeleton class="page-skeleton-pill" />
		</div>
		<div class="page-skeleton-live-workspace" aria-hidden="true">
			<AppSkeleton class="page-skeleton-card page-skeleton-card--nav block w-full" />
			<AppSkeleton class="page-skeleton-card page-skeleton-card--panel block w-full" />
		</div>
	{:else if variant === 'builder'}
		<div class="page-skeleton-builder-desktop-head" aria-hidden="true">
			<div class="page-skeleton-builder-desktop-head__copy">
				<AppSkeleton class="page-skeleton-toolbar page-skeleton-toolbar--summary-head" />
				<AppSkeleton class="page-skeleton-title page-skeleton-title--lg" />
			</div>
			<div class="page-skeleton-builder-desktop-head__actions">
				<AppSkeleton class="page-skeleton-toolbar page-skeleton-toolbar--button" />
				<AppSkeleton class="page-skeleton-toolbar page-skeleton-toolbar--button" />
			</div>
		</div>
		<div class="page-skeleton-header page-skeleton-header--builder-mobile" aria-hidden="true">
			<AppSkeleton class="page-skeleton-title page-skeleton-title--lg" />
			<AppSkeleton class="page-skeleton-toolbar page-skeleton-toolbar--button" />
		</div>
		<AppSkeleton class="page-skeleton-field" aria-hidden="true" />
		{#if groupBanner !== 'none'}
			<BuilderSupersetBannerSkeleton
				variant={groupBanner === 'coachmark' ? 'coachmark' : 'hint'}
			/>
		{/if}
		<div class="builder-exercise-list builder-exercise-list--skeleton" aria-hidden="true">
			{#each Array.from({ length: Math.min(Math.max(rows, 1), 4) }, (_, i) => i) as i (i)}
				<article class="workout-ex-row builder-exercise-skeleton">
					<div class="workout-ex-head">
						<div class="workout-ex-head__check">
							<AppSkeleton class="builder-exercise-skeleton__check-bone" />
						</div>
						<AppSkeleton
							class="workout-ex-head__media workout-ex-head__media is-placeholder builder-exercise-skeleton__thumb"
						/>
						<div class="workout-ex-head__copy">
							<AppSkeleton class="builder-exercise-skeleton__title" />
							<div class="workout-ex-fields">
								<div class="workout-ex-chip builder-exercise-skeleton__chip">
									<span class="builder-exercise-skeleton__chip-label"
										>{translate(lang, 'builder.sets')}</span
									>
									<span class="builder-exercise-skeleton__chip-input workouts-skel-bone"></span>
								</div>
								<span class="workout-ex-fields__times" aria-hidden="true">×</span>
								<div class="workout-ex-chip builder-exercise-skeleton__chip">
									<span class="builder-exercise-skeleton__chip-label"
										>{translate(lang, 'builder.reps')}</span
									>
									<span class="builder-exercise-skeleton__chip-input workouts-skel-bone"></span>
								</div>
								<div class="workout-ex-chip workout-ex-chip--rest builder-exercise-skeleton__chip">
									<span class="builder-exercise-skeleton__chip-label"
										>{translate(lang, 'builder.rest')}</span
									>
									<span class="builder-exercise-skeleton__chip-input workouts-skel-bone"></span>
								</div>
							</div>
						</div>
						<div class="workout-ex-head__actions">
							<AppSkeleton class="builder-exercise-skeleton__menu" />
						</div>
					</div>
				</article>
			{/each}
		</div>
	{:else if variant === 'builder-empty'}
		<div class="page-skeleton-builder-desktop-head" aria-hidden="true">
			<div class="page-skeleton-builder-desktop-head__copy">
				<AppSkeleton class="page-skeleton-toolbar page-skeleton-toolbar--summary-head" />
				<AppSkeleton class="page-skeleton-title page-skeleton-title--lg" />
			</div>
			<div class="page-skeleton-builder-desktop-head__actions">
				<AppSkeleton class="page-skeleton-toolbar page-skeleton-toolbar--button" />
				<AppSkeleton class="page-skeleton-toolbar page-skeleton-toolbar--button" />
			</div>
		</div>
		<AppPanel
			dashed
			class="empty-state flex flex-col gap-3 py-6 empty-state--centered items-center text-center workouts-skeleton-empty builder-skeleton-empty"
			aria-hidden="true"
		>
			<div class="empty-state__icon" aria-hidden="true">
				<LucideIcon icon={Plus} size={28} />
			</div>
			<div class="empty-state__copy">
				<h2 class="section-title empty-state__title workouts-skel-bone">
					{translate(lang, 'builder.emptyTitle')}
				</h2>
				<p class="empty-state__desc max-w-md leading-relaxed workouts-skel-bone">
					{translate(lang, 'builder.emptyDesc')}
				</p>
			</div>
			<div class="empty-state__actions mt-1 flex w-full flex-col gap-2 items-stretch">
				<span class="btn-primary empty-state__action workouts-skel-bone workouts-skel-bone--cta">
					{translate(lang, 'builder.addExerciseShort')}
				</span>
			</div>
		</AppPanel>
	{:else if variant === 'auth'}
		<!-- Logged-in /auth: hero + 6 settings cards (2-col from tablet). -->
		<div class="page-skeleton-auth" aria-hidden="true">
			<div class="page-skeleton-auth-guest__chrome lg:hidden">
				<div class="page-skeleton-auth-guest__back-slot">
					<AppSkeleton class="page-skeleton-auth-guest__back-icon" />
				</div>
				<AppSkeleton class="page-skeleton-auth-guest__title" />
			</div>

			<div class="page-skeleton-auth__desktop-head hidden lg:block">
				<AppSkeleton class="page-skeleton-auth-back" />
				<AppSkeleton class="page-skeleton-title page-skeleton-title--lg page-skeleton-auth__desktop-title" />
			</div>

			<header class="page-skeleton-auth-hero">
				<div class="page-skeleton-auth-hero__stage">
					<AppSkeleton class="page-skeleton-auth-avatar" />
				</div>
				<AppSkeleton class="page-skeleton-auth-name" />
				<AppSkeleton class="page-skeleton-auth-meta" />
				<AppSkeleton class="page-skeleton-auth-badge" />
			</header>

			<div class="page-skeleton-auth__stack">
				<div class="page-skeleton-card page-skeleton-card--auth">
					<AppSkeleton class="page-skeleton-auth-group-title" />
					<AppSkeleton class="page-skeleton-field" />
					<AppSkeleton class="page-skeleton-auth-hint" />
					<AppSkeleton class="page-skeleton-row page-skeleton-row--action" />
				</div>

				<div class="page-skeleton-card page-skeleton-card--auth">
					<AppSkeleton class="page-skeleton-auth-group-title" />
					<div class="page-skeleton-auth-pref-row">
						<AppSkeleton class="page-skeleton-auth-pref-icon" />
						<AppSkeleton class="page-skeleton-auth-pref-label" />
						<AppSkeleton class="page-skeleton-auth-pref-value" />
					</div>
					<div class="page-skeleton-auth-pref-row">
						<AppSkeleton class="page-skeleton-auth-pref-icon" />
						<AppSkeleton class="page-skeleton-auth-pref-label" />
						<AppSkeleton class="page-skeleton-auth-pref-value" />
					</div>
					<AppSkeleton class="page-skeleton-auth-hint" />
				</div>

				<div class="page-skeleton-card page-skeleton-card--auth">
					<AppSkeleton class="page-skeleton-auth-group-title" />
					<div class="page-skeleton-auth-pref-row page-skeleton-auth-pref-row--toggle">
						<AppSkeleton class="page-skeleton-auth-pref-icon" />
						<AppSkeleton class="page-skeleton-auth-pref-label" />
						<AppSkeleton class="page-skeleton-auth-pref-toggle" />
					</div>
					<AppSkeleton class="page-skeleton-auth-hint" />
				</div>

				<div class="page-skeleton-card page-skeleton-card--auth">
					<AppSkeleton class="page-skeleton-auth-group-title" />
					<AppSkeleton class="page-skeleton-auth-hint page-skeleton-auth-hint--lead" />
					<div class="page-skeleton-auth-dual-actions">
						<AppSkeleton class="page-skeleton-row page-skeleton-row--action" />
						<AppSkeleton class="page-skeleton-row page-skeleton-row--action" />
					</div>
				</div>

				<div class="page-skeleton-card page-skeleton-card--auth page-skeleton-card--auth-danger">
					<AppSkeleton class="page-skeleton-auth-danger-eyebrow" />
					<AppSkeleton class="page-skeleton-auth-danger-title" />
					<AppSkeleton class="page-skeleton-auth-hint page-skeleton-auth-hint--lead" />
					<AppSkeleton class="page-skeleton-auth-danger-list" />
					<AppSkeleton class="page-skeleton-row page-skeleton-row--action" />
				</div>

				<div class="page-skeleton-card page-skeleton-card--auth">
					<AppSkeleton class="page-skeleton-auth-group-title" />
					<div class="page-skeleton-auth-pref-row">
						<AppSkeleton class="page-skeleton-auth-pref-icon" />
						<AppSkeleton class="page-skeleton-auth-pref-label" />
					</div>
					<div class="page-skeleton-auth-pref-row">
						<AppSkeleton class="page-skeleton-auth-pref-icon" />
						<AppSkeleton class="page-skeleton-auth-pref-label" />
					</div>
				</div>
			</div>
		</div>
	{:else if variant === 'auth-guest'}
		<!-- Guest /auth: ScreenHeader + sign-in panel + settings panel. -->
		<div class="page-skeleton-auth-guest" aria-hidden="true">
			<div class="page-skeleton-auth-guest__chrome">
				<div class="page-skeleton-auth-guest__back-slot">
					<AppSkeleton class="page-skeleton-auth-guest__back-icon" />
				</div>
				<AppSkeleton class="page-skeleton-auth-guest__title" />
			</div>

			<header class="page-skeleton-auth-guest__header">
				<div class="page-skeleton-auth-guest__desktop-head">
					<AppSkeleton class="page-skeleton-auth-back" />
				</div>
				<AppSkeleton class="page-skeleton-auth-guest__page-title" />
				<AppSkeleton class="page-skeleton-auth-guest__tagline" />
			</header>

			<div class="page-skeleton-auth-guest__stack">
				<div class="page-skeleton-card page-skeleton-card--auth page-skeleton-card--auth-signin">
					<AppSkeleton class="page-skeleton-auth-guest__segments" />
					<div class="page-skeleton-auth-guest__form">
						<div class="page-skeleton-auth-guest__field">
							<AppSkeleton class="page-skeleton-label" />
							<AppSkeleton class="page-skeleton-field" />
						</div>
						<div class="page-skeleton-auth-guest__field">
							<AppSkeleton class="page-skeleton-label" />
							<AppSkeleton class="page-skeleton-field" />
						</div>
						<AppSkeleton class="page-skeleton-auth-guest__link page-skeleton-auth-guest__link--control" />
						<AppSkeleton class="page-skeleton-row page-skeleton-row--action" />
						<AppSkeleton class="page-skeleton-auth-guest__link page-skeleton-auth-guest__link--center page-skeleton-auth-guest__link--control" />
					</div>
				</div>

				<div class="page-skeleton-card page-skeleton-card--auth page-skeleton-card--auth-settings">
					<div class="page-skeleton-auth-guest__section">
						<AppSkeleton class="page-skeleton-auth-group-title" />
						<div class="page-skeleton-auth-pref-row">
							<AppSkeleton class="page-skeleton-auth-pref-icon" />
							<AppSkeleton class="page-skeleton-auth-pref-label" />
							<AppSkeleton class="page-skeleton-auth-pref-value" />
						</div>
						<div class="page-skeleton-auth-pref-row">
							<AppSkeleton class="page-skeleton-auth-pref-icon" />
							<AppSkeleton class="page-skeleton-auth-pref-label" />
							<AppSkeleton class="page-skeleton-auth-pref-value" />
						</div>
						<AppSkeleton class="page-skeleton-auth-hint" />
					</div>
					<div class="page-skeleton-auth-guest__section">
						<AppSkeleton class="page-skeleton-auth-group-title" />
						<AppSkeleton class="page-skeleton-auth-hint page-skeleton-auth-hint--lead" />
						<div class="page-skeleton-auth-dual-actions">
							<AppSkeleton class="page-skeleton-row page-skeleton-row--action" />
							<AppSkeleton class="page-skeleton-row page-skeleton-row--action" />
						</div>
					</div>
					<AppSkeleton class="page-skeleton-auth-guest__legal" />
				</div>
			</div>
		</div>
	{:else if variant === 'summary'}
		<div class="page-skeleton-summary-mobile-head lg:hidden" aria-hidden="true">
			<AppSkeleton class="page-skeleton-toolbar page-skeleton-toolbar--summary-head" />
		</div>
		<div class="page-skeleton-summary-desktop-head hidden lg:block" aria-hidden="true">
			<AppSkeleton class="page-skeleton-toolbar page-skeleton-toolbar--summary-head" />
			<AppSkeleton class="page-skeleton-title page-skeleton-title--lg" />
		</div>
		<div class="page-skeleton-header page-skeleton-header--summary-mobile lg:hidden" aria-hidden="true">
			<AppSkeleton class="page-skeleton-title" />
		</div>
		<div class="page-skeleton-summary-hero" aria-hidden="true">
			<AppSkeleton class="page-skeleton-summary-check" />
			<AppSkeleton class="page-skeleton-title page-skeleton-title--lg" />
			<AppSkeleton class="page-skeleton-line page-skeleton-line--short" />
		</div>
		<div class="page-skeleton-stats" aria-hidden="true">
			<AppSkeleton class="page-skeleton-stat" />
			<AppSkeleton class="page-skeleton-stat" />
			<AppSkeleton class="page-skeleton-stat" />
			{#if showVolumeStat}
				<AppSkeleton class="page-skeleton-stat" />
			{/if}
		</div>
		{#if previewRows > 0}
			<AppSkeleton class="page-skeleton-label page-skeleton-label--summary-preview" aria-hidden="true" />
			{#each Array.from({ length: previewRows }, (_, i) => i) as i (i)}
				<AppSkeleton class="page-skeleton-row page-skeleton-row--summary-preview" aria-hidden="true" />
			{/each}
		{/if}
		{#if showGuestHint}
			<AppSkeleton class="page-skeleton-row page-skeleton-row--summary-guest" aria-hidden="true" />
		{/if}
		<AppSkeleton class="page-skeleton-row page-skeleton-row--action" />
		<AppSkeleton class="page-skeleton-row page-skeleton-row--secondary" />
		<AppSkeleton class="page-skeleton-row page-skeleton-row--summary-sticky" aria-hidden="true" />
	{:else}
		{#if showField}
			<AppSkeleton class="page-skeleton-field" aria-hidden="true" />
			<AppSkeleton class="page-skeleton-label" aria-hidden="true" />
		{/if}
		{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
			<AppSkeleton class="page-skeleton-row" aria-hidden="true" />
		{/each}
	{/if}
</div>
