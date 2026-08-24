<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';

	let {
		label,
		rows = 6
	}: {
		label: string;
		rows?: number;
	} = $props();
</script>

<div class="catalog-exercise-skeleton" aria-busy="true" aria-live="polite">
	<span class="sr-only">{label}</span>
	<AppSkeleton class="catalog-exercise-skeleton__count" aria-hidden="true" />
	<div class="catalog-exercise-skeleton__list" aria-hidden="true">
		{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
			<div class="catalog-exercise-skeleton__row">
				<AppSkeleton class="catalog-exercise-skeleton__thumb" aria-hidden="true" />
				<div class="catalog-exercise-skeleton__body">
					<AppSkeleton
						class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--title"
						aria-hidden="true"
					/>
					<AppSkeleton
						class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--meta"
						aria-hidden="true"
					/>
				</div>
				<AppSkeleton class="catalog-exercise-skeleton__action" aria-hidden="true" />
			</div>
		{/each}
	</div>
</div>

<style>
	:global(.catalog-exercise-skeleton__count) {
		height: 0.875rem;
		width: 5.5rem;
		margin-bottom: 0.75rem;
		border-radius: 0.35rem;
	}

	.catalog-exercise-skeleton__list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		overflow: visible;
		border: none;
		border-radius: 0;
		background: transparent;
		box-shadow: none;
	}

	.catalog-exercise-skeleton__row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		min-height: calc(4.75rem + 1.5rem);
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 1.5rem;
		background: var(--color-surface);
		box-shadow: none;
	}

	:global(.catalog-exercise-skeleton__thumb) {
		flex: 0 0 4.75rem;
		width: 4.75rem;
		height: 4.75rem;
		border-radius: 0.85rem;
	}

	.catalog-exercise-skeleton__body {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		justify-content: center;
		gap: 0.45rem;
		min-width: 0;
		padding: 0;
	}

	:global(.catalog-exercise-skeleton__line--title) {
		width: min(72%, 14rem);
		height: 0.875rem;
		border-radius: 999px;
	}

	:global(.catalog-exercise-skeleton__line--meta) {
		width: min(42%, 8rem);
		height: 0.75rem;
		border-radius: 999px;
	}

	:global(.catalog-exercise-skeleton__action) {
		flex-shrink: 0;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 999px;
	}

	@media (min-width: 768px) {
		.catalog-exercise-skeleton__list {
			gap: 0.75rem;
		}

		.catalog-exercise-skeleton__row {
			padding: 0.85rem 1rem;
		}
	}
</style>
