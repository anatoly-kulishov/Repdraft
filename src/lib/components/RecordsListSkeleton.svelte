<script lang="ts">
	import AppPanel from '$lib/components/AppPanel.svelte';
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';
	import {
		EXERCISES_SUBROUTE_SKELETON_ROWS_DESKTOP,
		EXERCISES_SUBROUTE_SKELETON_ROWS_MOBILE
	} from '$lib/stores/catalogUi';

	let {
		rows,
		label = '',
		variant = 'records',
		includeSearch = true
	}: {
		rows?: number;
		label?: string;
		variant?: 'records' | 'saved';
		/** Saved list keeps search in catalog-list-layout__filters — omit here. */
		includeSearch?: boolean;
	} = $props();

	/** Always render desktop count; hide extras on mobile via CSS — no hydration jump. */
	let skeletonRows = $derived(rows ?? EXERCISES_SUBROUTE_SKELETON_ROWS_DESKTOP);
	let useResponsiveCount = $derived(rows === undefined);
</script>

<div
	class="records-skeleton"
	class:records-skeleton--saved={variant === 'saved'}
	aria-busy="true"
	aria-live="polite"
>
	{#if label}
		<span class="sr-only">{label}</span>
	{/if}
	{#if includeSearch}
		<div class="catalog-list-layout__filters records-page__search">
			<div class="catalog-filters-shell">
				<AppPanel class="catalog-filters catalog-filters--saved">
					<AppSkeleton class="records-skeleton__search skeleton-shimmer" aria-hidden="true" />
				</AppPanel>
			</div>
		</div>
	{/if}
	<div class="catalog-list-count mb-3 text-sm text-[var(--color-muted)]" aria-hidden="true">
		<AppSkeleton class="records-skeleton__count skeleton-shimmer" aria-hidden="true" />
	</div>
	<ul class="records-list records-skeleton__list" aria-hidden="true">
		{#each Array.from({ length: skeletonRows }, (_, i) => i) as i (i)}
			<li
				class:records-skeleton__item--desktop-only={useResponsiveCount &&
					i >= EXERCISES_SUBROUTE_SKELETON_ROWS_MOBILE}
			>
				<div class="records-skeleton__shell">
					<div class="records-list-card records-skeleton__card">
						<div
							class="records-list-body"
							class:records-list-body--note={variant === 'records'}
						>
							<span class="records-list-thumb" aria-hidden="true">
								<AppSkeleton class="records-skeleton__thumb skeleton-shimmer" aria-hidden="true" />
							</span>
							<div class="records-list-content records-skeleton__content">
								<AppSkeleton
									class="records-skeleton__line records-skeleton__line--title skeleton-shimmer"
									aria-hidden="true"
								/>
								<div class="records-list-meta records-skeleton__meta">
									{#if variant === 'records'}
										<AppSkeleton class="records-skeleton__chip skeleton-shimmer" aria-hidden="true" />
										<AppSkeleton class="records-skeleton__date skeleton-shimmer" aria-hidden="true" />
									{:else}
										<AppSkeleton
											class="records-skeleton__line records-skeleton__line--meta skeleton-shimmer"
											aria-hidden="true"
										/>
									{/if}
								</div>
								{#if variant === 'records'}
									<AppSkeleton class="records-skeleton__note skeleton-shimmer" aria-hidden="true" />
								{/if}
							</div>
						</div>
						<AppSkeleton class="records-skeleton__delete skeleton-shimmer" aria-hidden="true" />
					</div>
				</div>
			</li>
		{/each}
	</ul>
</div>
