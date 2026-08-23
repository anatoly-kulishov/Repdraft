<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';

	let { label }: { label: string } = $props();
</script>

<div class="workouts-skeleton" aria-busy="true" aria-live="polite">
	<span class="sr-only">{label}</span>
	<AppSkeleton class="workouts-skeleton-tabs" aria-hidden="true" />
	<AppSkeleton class="workouts-skeleton-search" aria-hidden="true" />
	<ul class="entity-list entity-list--cards workouts-skeleton-list" aria-hidden="true">
		{#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
			<li><AppSkeleton class="workouts-skeleton-row" aria-hidden="true" /></li>
		{/each}
	</ul>
</div>

<style>
	:global(.workouts-skeleton-tabs) {
		display: block;
		width: 100%;
		height: 2.75rem;
		margin-bottom: 1rem;
		border-radius: var(--radius-control);
		border: 1px solid var(--color-border);
	}

	:global(.workouts-skeleton-search) {
		display: block;
		width: 100%;
		height: 3rem;
		margin-bottom: 1rem;
		border-radius: var(--radius-control);
		border: 1px solid var(--color-border);
	}

	.workouts-skeleton-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	:global(.workouts-skeleton-row) {
		display: block;
		width: 100%;
		min-height: 5.25rem;
		border-radius: var(--radius-panel);
		border: 1px solid var(--color-border);
	}
</style>
