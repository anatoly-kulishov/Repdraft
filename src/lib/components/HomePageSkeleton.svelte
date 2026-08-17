<script lang="ts">
	let { label }: { label: string } = $props();
</script>

<!-- Mirror loaded home-dashboard mid: plans | recent. No desktop hero (start mode). -->
<div class="home-dashboard home-skeleton" aria-busy="true" aria-live="polite">
	<span class="sr-only">{label}</span>

	<div class="home-skeleton-hero lg:hidden" aria-hidden="true"></div>

	<div class="home-dashboard-mid" aria-hidden="true">
		<div class="home-section home-dashboard-plans">
			<div class="home-skeleton-heading"></div>
			<ul class="entity-list">
				<li class="home-skeleton-row"></li>
				<li class="home-skeleton-row"></li>
				<li class="home-skeleton-row"></li>
				<li class="home-skeleton-row"></li>
			</ul>
		</div>

		<div class="home-dashboard-aside">
			<div class="home-section">
				<div class="home-skeleton-heading"></div>
				<ul class="entity-list">
					<li class="home-skeleton-row"></li>
					<li class="home-skeleton-row"></li>
					<li class="home-skeleton-row"></li>
				</ul>
			</div>
		</div>
	</div>
</div>
