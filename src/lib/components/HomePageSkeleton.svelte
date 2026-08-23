<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';

	let { label }: { label: string } = $props();
</script>

<!-- Mirror loaded home-dashboard mid: plans | recent. No desktop hero (start mode). -->
<div class="home-dashboard home-skeleton" aria-busy="true" aria-live="polite">
	<span class="sr-only">{label}</span>

	<AppSkeleton class="home-skeleton-hero lg:hidden" aria-hidden="true" />

	<div class="home-dashboard-mid" aria-hidden="true">
		<div class="home-section home-dashboard-plans">
			<AppSkeleton class="home-skeleton-heading" aria-hidden="true" />
			<ul class="entity-list">
				<li><AppSkeleton class="home-skeleton-row" aria-hidden="true" /></li>
				<li><AppSkeleton class="home-skeleton-row" aria-hidden="true" /></li>
				<li><AppSkeleton class="home-skeleton-row" aria-hidden="true" /></li>
				<li><AppSkeleton class="home-skeleton-row" aria-hidden="true" /></li>
			</ul>
		</div>

		<div class="home-dashboard-aside">
			<div class="home-section">
				<AppSkeleton class="home-skeleton-heading" aria-hidden="true" />
				<ul class="entity-list">
					<li><AppSkeleton class="home-skeleton-row" aria-hidden="true" /></li>
					<li><AppSkeleton class="home-skeleton-row" aria-hidden="true" /></li>
					<li><AppSkeleton class="home-skeleton-row" aria-hidden="true" /></li>
				</ul>
			</div>
		</div>
	</div>
</div>
