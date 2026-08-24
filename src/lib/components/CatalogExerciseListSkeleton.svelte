<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';

	let {
		label,
		rows = 6,
		variant = 'list'
	}: {
		label: string;
		rows?: number;
		variant?: 'list' | 'grid';
	} = $props();
</script>

<div
	class="catalog-exercise-skeleton"
	class:catalog-exercise-skeleton--grid={variant === 'grid'}
	aria-busy="true"
	aria-live="polite"
>
	<span class="sr-only">{label}</span>
	<AppSkeleton class="catalog-exercise-skeleton__count" aria-hidden="true" />
	{#if variant === 'grid'}
		<div class="catalog-exercise-skeleton__grid" aria-hidden="true">
			{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
				<div class="catalog-exercise-skeleton__card">
					<AppSkeleton class="catalog-exercise-skeleton__media" aria-hidden="true" />
					<div class="catalog-exercise-skeleton__body">
						<AppSkeleton
							class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--title"
							aria-hidden="true"
						/>
						<div class="catalog-exercise-skeleton__meta-row">
							<AppSkeleton
								class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--meta"
								aria-hidden="true"
							/>
							<AppSkeleton
								class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--meta catalog-exercise-skeleton__line--meta-end"
								aria-hidden="true"
							/>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
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
	{/if}
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

	.catalog-exercise-skeleton__grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.catalog-exercise-skeleton__card {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: 1rem;
		background: var(--color-surface);
	}

	:global(.catalog-exercise-skeleton__media) {
		aspect-ratio: 1;
		width: 100%;
		border-radius: 0;
		background: var(--hero-card-media-bg);
	}

	.catalog-exercise-skeleton--grid .catalog-exercise-skeleton__body {
		padding: 0.7rem 0.75rem 0.8rem;
		gap: 0.45rem;
	}

	.catalog-exercise-skeleton--grid :global(.catalog-exercise-skeleton__line--title) {
		width: 88%;
		height: 0.8125rem;
	}

	.catalog-exercise-skeleton--grid .catalog-exercise-skeleton__meta-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.35rem 0.5rem;
	}

	.catalog-exercise-skeleton--grid :global(.catalog-exercise-skeleton__line--meta) {
		width: 100%;
		height: 0.625rem;
	}

	.catalog-exercise-skeleton--grid :global(.catalog-exercise-skeleton__line--meta-end) {
		justify-self: end;
		width: 72%;
	}

	@media (min-width: 768px) {
		.catalog-exercise-skeleton__list {
			gap: 0.75rem;
		}

		.catalog-exercise-skeleton__row {
			padding: 0.85rem 1rem;
		}

		.catalog-exercise-skeleton__grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 0.85rem;
		}
	}
</style>
