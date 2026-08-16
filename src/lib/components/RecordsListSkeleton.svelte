<script lang="ts">
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
	<ul class="records-skeleton__list" aria-hidden="true">
		{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
			<li class="records-skeleton__row">
				<div class="records-skeleton__thumb"></div>
				<div class="records-skeleton__body">
					<div class="records-skeleton__line records-skeleton__line--title"></div>
					<div class="records-skeleton__meta">
						<div class="records-skeleton__chip"></div>
						<div class="records-skeleton__date"></div>
					</div>
				</div>
			</li>
		{/each}
	</ul>
</div>

<style>
	.records-skeleton__list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.records-skeleton__row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}

	.records-skeleton__thumb {
		flex-shrink: 0;
		width: 4.5rem;
		height: 4.5rem;
		border-radius: calc(var(--radius-control) + 2px);
		background: var(--color-surface-muted);
		animation: records-skeleton-shimmer 1.1s ease-in-out infinite;
	}

	.records-skeleton__body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.records-skeleton__line {
		height: 0.85rem;
		border-radius: 999px;
		background: var(--color-surface-muted);
		animation: records-skeleton-shimmer 1.1s ease-in-out infinite;
	}

	.records-skeleton__line--title {
		width: min(70%, 14rem);
	}

	.records-skeleton__meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.records-skeleton__chip {
		width: 6.5rem;
		height: 1.35rem;
		border-radius: 999px;
		background: var(--color-surface-muted);
		animation: records-skeleton-shimmer 1.1s ease-in-out infinite;
	}

	.records-skeleton__date {
		width: 3.25rem;
		height: 0.75rem;
		border-radius: 999px;
		background: var(--color-surface-muted);
		animation: records-skeleton-shimmer 1.1s ease-in-out infinite;
	}

	@keyframes records-skeleton-shimmer {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 1;
		}
	}
</style>
