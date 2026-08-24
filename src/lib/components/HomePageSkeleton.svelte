<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';

	let {
		label,
		variant = 'start'
	}: {
		label: string;
		/** create = guest empty hero; start = mockup CTA + plans | recent */
		variant?: 'create' | 'start';
	} = $props();
</script>

<div
	class="home-dashboard home-skeleton"
	class:home-skeleton--create={variant === 'create'}
	class:home-skeleton--start={variant === 'start'}
	aria-busy="true"
	aria-live="polite"
>
	<span class="sr-only">{label}</span>

	{#if variant === 'create'}
		<div class="home-dashboard-top" aria-hidden="true">
			<div class="home-hero home-skeleton-create-hero">
				<AppSkeleton class="home-skeleton-create-title" />
				<AppSkeleton class="home-skeleton-create-lead" />
				<AppSkeleton class="home-skeleton-create-tag" />
				<div class="home-hero-actions">
					<AppSkeleton class="home-skeleton-create-cta" />
					<AppSkeleton class="home-skeleton-create-cta home-skeleton-create-cta--secondary" />
				</div>
			</div>
			<nav class="home-guest-next">
				<AppSkeleton class="home-skeleton-guest-next" />
			</nav>
		</div>
	{:else}
		<header class="home-header home-header--mockup home-skeleton-mockup" aria-hidden="true">
			<div class="home-header__copy">
				<AppSkeleton class="home-skeleton-mockup-title" />
			</div>
			<AppSkeleton class="home-skeleton-mockup-cta" />
		</header>

		<div class="home-dashboard-mid" aria-hidden="true">
			<div class="home-section home-dashboard-plans">
				<AppSkeleton class="home-skeleton-heading" />
				<ul class="entity-list">
					<li><AppSkeleton class="home-skeleton-row" /></li>
					<li><AppSkeleton class="home-skeleton-row" /></li>
					<li><AppSkeleton class="home-skeleton-row" /></li>
					<li><AppSkeleton class="home-skeleton-row" /></li>
				</ul>
			</div>

			<div class="home-dashboard-aside">
				<div class="home-section">
					<AppSkeleton class="home-skeleton-heading" />
					<ul class="entity-list">
						<li><AppSkeleton class="home-skeleton-row" /></li>
						<li><AppSkeleton class="home-skeleton-row" /></li>
						<li><AppSkeleton class="home-skeleton-row" /></li>
					</ul>
				</div>
			</div>
		</div>
	{/if}
</div>
