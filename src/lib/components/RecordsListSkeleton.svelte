<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';

	let {
		rows = 4,
		label = ''
	}: {
		rows?: number;
		label?: string;
	} = $props();
</script>

<div class="records-skeleton records-page" aria-busy="true" aria-live="polite">
	{#if label}
		<span class="sr-only">{label}</span>
	{/if}
	<ul class="records-list records-skeleton__list" aria-hidden="true">
		{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
			<li>
				<div class="records-list-card records-skeleton__card">
					<div class="records-list-body">
						<AppSkeleton class="records-skeleton__thumb skeleton-shimmer" aria-hidden="true" />
						<div class="records-list-content records-skeleton__content">
							<AppSkeleton
								class="records-skeleton__line records-skeleton__line--title skeleton-shimmer"
								aria-hidden="true"
							/>
							<div class="records-list-meta records-skeleton__meta">
								<AppSkeleton class="records-skeleton__chip skeleton-shimmer" aria-hidden="true" />
								<AppSkeleton class="records-skeleton__date skeleton-shimmer" aria-hidden="true" />
							</div>
						</div>
					</div>
					<AppSkeleton class="records-skeleton__delete skeleton-shimmer" aria-hidden="true" />
				</div>
			</li>
		{/each}
	</ul>
</div>
