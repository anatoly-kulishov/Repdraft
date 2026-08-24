<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';

	let {
		rows = 4,
		showField = false,
		variant = 'default'
	}: {
		rows?: number;
		showField?: boolean;
		variant?: 'default' | 'history' | 'live' | 'builder' | 'auth' | 'auth-guest' | 'summary';
	} = $props();
</script>

<div class={`page-skeleton page-skeleton--${variant}`} aria-busy="true" aria-live="polite">
	{#if variant === 'history'}
		<div class="page-skeleton-header" aria-hidden="true">
			<AppSkeleton class="page-skeleton-title page-skeleton-title--lg" />
			<AppSkeleton class="page-skeleton-toolbar" />
		</div>
		<AppSkeleton class="page-skeleton-meta" aria-hidden="true" />
		{#each Array.from({ length: Math.max(2, rows - 1) }, (_, i) => i) as i (i)}
			<div class="page-skeleton-card" aria-hidden="true">
				<div class="page-skeleton-card__head">
					<AppSkeleton class="page-skeleton-thumb" />
					<div class="page-skeleton-card__body">
						<AppSkeleton class="page-skeleton-title" />
						<AppSkeleton class="page-skeleton-line page-skeleton-line--short" />
					</div>
				</div>
				<div class="page-skeleton-sets">
					<AppSkeleton class="page-skeleton-set" />
					<AppSkeleton class="page-skeleton-set" />
					<AppSkeleton class="page-skeleton-set" />
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
		<AppSkeleton class="page-skeleton-card page-skeleton-card--nav block w-full" aria-hidden="true" />
		<AppSkeleton class="page-skeleton-card page-skeleton-card--panel block w-full" aria-hidden="true" />
	{:else if variant === 'builder'}
		<div class="page-skeleton-header" aria-hidden="true">
			<AppSkeleton class="page-skeleton-title page-skeleton-title--lg" />
			<AppSkeleton class="page-skeleton-toolbar page-skeleton-toolbar--button" />
		</div>
		<AppSkeleton class="page-skeleton-field" aria-hidden="true" />
		<AppSkeleton class="page-skeleton-label" aria-hidden="true" />
		<div class="page-skeleton-section-head" aria-hidden="true">
			<AppSkeleton class="page-skeleton-title" />
			<AppSkeleton class="page-skeleton-toolbar" />
		</div>
		{#each Array.from({ length: Math.max(2, rows) }, (_, i) => i) as i (i)}
			<AppSkeleton class="page-skeleton-row page-skeleton-row--builder" aria-hidden="true" />
		{/each}
		<AppSkeleton class="page-skeleton-row page-skeleton-row--action" aria-hidden="true" />
	{:else if variant === 'auth'}
		<!-- Logged-in /auth: hero + 6 settings cards (2-col from tablet). -->
		<div class="page-skeleton-auth" aria-hidden="true">
			<header class="page-skeleton-auth-hero">
				<div class="page-skeleton-auth-hero__toolbar">
					<AppSkeleton class="page-skeleton-auth-back" />
				</div>
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

				<div class="page-skeleton-card page-skeleton-card--auth page-skeleton-card--auth-danger">
					<AppSkeleton class="page-skeleton-auth-danger-eyebrow" />
					<AppSkeleton class="page-skeleton-auth-danger-title" />
					<AppSkeleton class="page-skeleton-auth-hint page-skeleton-auth-hint--lead" />
					<AppSkeleton class="page-skeleton-auth-danger-list" />
					<AppSkeleton class="page-skeleton-row page-skeleton-row--action" />
				</div>
			</div>
		</div>
	{:else if variant === 'auth-guest'}
		<!-- Guest /auth: ScreenHeader + lead + sign-in panel + settings panel. -->
		<div class="page-skeleton-auth-guest" aria-hidden="true">
			<div class="page-skeleton-auth-guest__chrome">
				<AppSkeleton class="page-skeleton-auth-back" />
				<AppSkeleton class="page-skeleton-auth-guest__title" />
			</div>

			<header class="page-skeleton-auth-guest__header">
				<div class="page-skeleton-auth-guest__desktop-head">
					<AppSkeleton class="page-skeleton-auth-back" />
				</div>
				<AppSkeleton class="page-skeleton-auth-guest__page-title" />
				<AppSkeleton class="page-skeleton-auth-guest__lead" />
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
		<div class="page-skeleton-header" aria-hidden="true">
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
		</div>
		<AppSkeleton class="page-skeleton-row page-skeleton-row--action" />
		<AppSkeleton class="page-skeleton-row page-skeleton-row--secondary" />
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
