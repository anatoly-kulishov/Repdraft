<script lang="ts">
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
			<div class="page-skeleton-title page-skeleton-title--lg"></div>
			<div class="page-skeleton-toolbar"></div>
		</div>
		<div class="page-skeleton-meta" aria-hidden="true"></div>
		{#each Array.from({ length: Math.max(2, rows - 1) }, (_, i) => i) as i (i)}
			<div class="page-skeleton-card" aria-hidden="true">
				<div class="page-skeleton-card__head">
					<div class="page-skeleton-thumb"></div>
					<div class="page-skeleton-card__body">
						<div class="page-skeleton-title"></div>
						<div class="page-skeleton-line page-skeleton-line--short"></div>
					</div>
				</div>
				<div class="page-skeleton-sets">
					<div class="page-skeleton-set"></div>
					<div class="page-skeleton-set"></div>
					<div class="page-skeleton-set"></div>
				</div>
			</div>
		{/each}
	{:else if variant === 'live'}
		<div class="page-skeleton-header" aria-hidden="true">
			<div class="page-skeleton-title page-skeleton-title--lg"></div>
			<div class="page-skeleton-meta page-skeleton-meta--pill"></div>
		</div>
		<div class="page-skeleton-pills" aria-hidden="true">
			<div class="page-skeleton-pill"></div>
			<div class="page-skeleton-pill"></div>
		</div>
		<div class="page-skeleton-card page-skeleton-card--nav" aria-hidden="true"></div>
		<div class="page-skeleton-card page-skeleton-card--panel" aria-hidden="true"></div>
	{:else if variant === 'builder'}
		<div class="page-skeleton-header" aria-hidden="true">
			<div class="page-skeleton-title page-skeleton-title--lg"></div>
			<div class="page-skeleton-toolbar page-skeleton-toolbar--button"></div>
		</div>
		<div class="page-skeleton-field" aria-hidden="true"></div>
		<div class="page-skeleton-label" aria-hidden="true"></div>
		<div class="page-skeleton-section-head" aria-hidden="true">
			<div class="page-skeleton-title"></div>
			<div class="page-skeleton-toolbar"></div>
		</div>
		{#each Array.from({ length: Math.max(2, rows) }, (_, i) => i) as i (i)}
			<div class="page-skeleton-row page-skeleton-row--builder" aria-hidden="true"></div>
		{/each}
		<div class="page-skeleton-row page-skeleton-row--action" aria-hidden="true"></div>
	{:else if variant === 'auth'}
		<div class="page-skeleton-header" aria-hidden="true">
			<div class="page-skeleton-title page-skeleton-title--lg"></div>
			<div class="page-skeleton-toolbar"></div>
		</div>
		<div class="page-skeleton-line page-skeleton-line--lead" aria-hidden="true"></div>
		<div class="page-skeleton-card page-skeleton-card--form" aria-hidden="true">
			<div class="page-skeleton-label"></div>
			<div class="page-skeleton-field"></div>
			<div class="page-skeleton-label"></div>
			<div class="page-skeleton-field"></div>
			<div class="page-skeleton-row page-skeleton-row--action"></div>
		</div>
	{:else if variant === 'summary'}
		<div class="page-skeleton-header" aria-hidden="true">
			<div class="page-skeleton-title"></div>
		</div>
		<div class="page-skeleton-summary-hero" aria-hidden="true">
			<div class="page-skeleton-summary-check"></div>
			<div class="page-skeleton-title page-skeleton-title--lg"></div>
			<div class="page-skeleton-line page-skeleton-line--short"></div>
		</div>
		<div class="page-skeleton-stats" aria-hidden="true">
			<div class="page-skeleton-stat"></div>
			<div class="page-skeleton-stat"></div>
			<div class="page-skeleton-stat"></div>
		</div>
		<div class="page-skeleton-row page-skeleton-row--action"></div>
		<div class="page-skeleton-row page-skeleton-row--secondary"></div>
	{:else}
		{#if showField}
			<div class="page-skeleton-field" aria-hidden="true"></div>
			<div class="page-skeleton-label" aria-hidden="true"></div>
		{/if}
		{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
			<div class="page-skeleton-row" aria-hidden="true"></div>
		{/each}
	{/if}
</div>
