<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';
	import { CATALOG_PAGE_SIZE } from '$lib/stores/catalogUi';

	const POPULAR_SECTION_ROWS = 12;

	let {
		label,
		rows = 6,
		variant = 'list'
	}: {
		label: string;
		rows?: number;
		variant?: 'list' | 'grid' | 'sections';
	} = $props();
</script>

<div
	class="catalog-exercise-skeleton"
	class:catalog-exercise-skeleton--grid={variant === 'grid' || variant === 'sections'}
	class:catalog-exercise-skeleton--sections={variant === 'sections'}
	aria-busy="true"
	aria-live="polite"
>
	<span class="sr-only">{label}</span>
	<AppSkeleton class="catalog-exercise-skeleton__count skeleton-shimmer" aria-hidden="true" />
	{#if variant === 'sections'}
		<div class="catalog-sections" aria-hidden="true">
			<section class="catalog-section">
				<AppSkeleton class="catalog-exercise-skeleton__section-title skeleton-shimmer" />
				<div class="catalog-exercise-skeleton__grid">
					{#each Array.from({ length: POPULAR_SECTION_ROWS }, (_, i) => i) as i (i)}
						<div class="catalog-exercise-skeleton__card">
							<AppSkeleton class="catalog-exercise-skeleton__media skeleton-shimmer" />
							<div class="catalog-exercise-skeleton__body">
								<AppSkeleton
									class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--title skeleton-shimmer"
								/>
								<div class="catalog-exercise-skeleton__meta-row">
									<AppSkeleton
										class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--meta skeleton-shimmer"
									/>
									<AppSkeleton
										class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--meta catalog-exercise-skeleton__line--meta-end skeleton-shimmer"
									/>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</section>
			<section class="catalog-section">
				<AppSkeleton class="catalog-exercise-skeleton__section-title skeleton-shimmer" />
				<div class="catalog-exercise-skeleton__grid">
					{#each Array.from({ length: rows || CATALOG_PAGE_SIZE }, (_, i) => i) as i (i)}
						<div class="catalog-exercise-skeleton__card">
							<AppSkeleton class="catalog-exercise-skeleton__media skeleton-shimmer" />
							<div class="catalog-exercise-skeleton__body">
								<AppSkeleton
									class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--title skeleton-shimmer"
								/>
								<div class="catalog-exercise-skeleton__meta-row">
									<AppSkeleton
										class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--meta skeleton-shimmer"
									/>
									<AppSkeleton
										class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--meta catalog-exercise-skeleton__line--meta-end skeleton-shimmer"
									/>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</section>
		</div>
	{:else if variant === 'grid'}
		<div class="catalog-exercise-skeleton__grid" aria-hidden="true">
			{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
				<div class="catalog-exercise-skeleton__card">
					<AppSkeleton class="catalog-exercise-skeleton__media skeleton-shimmer" aria-hidden="true" />
					<div class="catalog-exercise-skeleton__body">
						<AppSkeleton
							class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--title skeleton-shimmer"
							aria-hidden="true"
						/>
						<div class="catalog-exercise-skeleton__meta-row">
							<AppSkeleton
								class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--meta skeleton-shimmer"
								aria-hidden="true"
							/>
							<AppSkeleton
								class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--meta catalog-exercise-skeleton__line--meta-end skeleton-shimmer"
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
					<AppSkeleton class="catalog-exercise-skeleton__thumb skeleton-shimmer" aria-hidden="true" />
					<div class="catalog-exercise-skeleton__body">
						<AppSkeleton
							class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--title skeleton-shimmer"
							aria-hidden="true"
						/>
						<AppSkeleton
							class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--meta skeleton-shimmer"
							aria-hidden="true"
						/>
					</div>
					<AppSkeleton class="catalog-exercise-skeleton__action skeleton-shimmer" aria-hidden="true" />
				</div>
			{/each}
		</div>
	{/if}
</div>
