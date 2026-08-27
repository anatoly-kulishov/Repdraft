<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';

	let { label }: { label: string } = $props();
</script>

<div class="workouts-skeleton" aria-busy="true" aria-live="polite">
	<span class="sr-only">{label}</span>
	<AppSkeleton class="workouts-skeleton-tabs skeleton-shimmer" aria-hidden="true" />
	<AppSkeleton class="workouts-skeleton-search skeleton-shimmer" aria-hidden="true" />
	<ul class="entity-list entity-list--cards workouts-skeleton-list" aria-hidden="true">
		{#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
			<li><AppSkeleton class="workouts-skeleton-row skeleton-shimmer" aria-hidden="true" /></li>
		{/each}
	</ul>
</div>
