<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';

	let {
		rows = 4,
		showField = false,
		variant = 'default'
	}: {
		rows?: number;
		showField?: boolean;
		variant?: 'default' | 'history' | 'live' | 'builder' | 'auth' | 'summary';
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
		<div class="page-skeleton-header" aria-hidden="true">
			<AppSkeleton class="page-skeleton-title page-skeleton-title--lg" />
			<AppSkeleton class="page-skeleton-toolbar" />
		</div>
		<AppSkeleton class="page-skeleton-line page-skeleton-line--lead" aria-hidden="true" />
		<div class="page-skeleton-card page-skeleton-card--form" aria-hidden="true">
			<AppSkeleton class="page-skeleton-label" />
			<AppSkeleton class="page-skeleton-field" />
			<AppSkeleton class="page-skeleton-label" />
			<AppSkeleton class="page-skeleton-field" />
			<AppSkeleton class="page-skeleton-row page-skeleton-row--action" />
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
