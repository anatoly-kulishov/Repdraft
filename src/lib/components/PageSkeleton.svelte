<script lang="ts">
	let {
		rows = 4,
		showField = false
	}: {
		rows?: number;
		showField?: boolean;
	} = $props();
</script>

<div class="page-skeleton" aria-busy="true" aria-live="polite">
	{#if showField}
		<div class="page-skeleton-field" aria-hidden="true"></div>
		<div class="mb-2 h-10 max-w-xs animate-pulse rounded-[var(--radius-control)] bg-[var(--color-surface-muted)]" aria-hidden="true"></div>
	{/if}
	{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
		<div class="page-skeleton-row" aria-hidden="true"></div>
	{/each}
</div>
