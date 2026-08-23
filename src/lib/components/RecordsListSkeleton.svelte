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

<div class="records-skeleton" aria-busy="true" aria-live="polite">
	{#if label}
		<span class="sr-only">{label}</span>
	{/if}
	<ul class="records-list records-skeleton__list" aria-hidden="true">
		{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
			<li class="records-skeleton__row">
				<AppSkeleton class="records-skeleton__thumb" aria-hidden="true" />
				<div class="records-skeleton__body">
					<AppSkeleton class="records-skeleton__line records-skeleton__line--title" aria-hidden="true" />
					<div class="records-skeleton__meta">
						<AppSkeleton class="records-skeleton__chip" aria-hidden="true" />
						<AppSkeleton class="records-skeleton__date" aria-hidden="true" />
					</div>
				</div>
			</li>
		{/each}
	</ul>
</div>

<style>
	.records-skeleton__list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.records-skeleton__row {
		display: flex;
		align-items: stretch;
		gap: 0;
		padding: 0;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
		box-shadow: var(--shadow-panel);
	}

	:global(.records-skeleton__thumb) {
		flex-shrink: 0;
		width: var(--media-native);
		height: auto;
		min-height: var(--media-native);
		align-self: stretch;
		border-radius: 0;
		box-shadow: inset -1px 0 0 color-mix(in srgb, var(--color-border) 85%, transparent);
	}

	.records-skeleton__body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.75rem 0.85rem;
	}

	:global(.records-skeleton__line--title) {
		width: min(70%, 14rem);
		height: 0.875rem;
		border-radius: 999px;
	}

	.records-skeleton__meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	:global(.records-skeleton__chip) {
		width: 7rem;
		height: 1.45rem;
		border-radius: 999px;
	}

	:global(.records-skeleton__date) {
		width: 3.5rem;
		height: 0.8125rem;
		border-radius: 999px;
	}
</style>
