<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';

	import { CATALOG_HUB_ZONE_COUNT } from '$lib/domain/catalogLinks';

	let {
		label,
		rows = CATALOG_HUB_ZONE_COUNT
	}: {
		label: string;
		rows?: number;
	} = $props();
</script>

<div class="catalog-category-skeleton catalog-hub-grid" aria-busy="true" aria-live="polite">
	<span class="sr-only">{label}</span>
	{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
		<div class="catalog-category-skeleton__card" aria-hidden="true">
			<AppSkeleton class="catalog-category-skeleton__media" />
			<div class="catalog-category-skeleton__caption">
				<AppSkeleton class="catalog-category-skeleton__title" />
				<AppSkeleton class="catalog-category-skeleton__count" />
			</div>
		</div>
	{/each}
</div>
