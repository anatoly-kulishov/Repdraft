<script lang="ts">
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
	<div class="catalog-exercise-skeleton__count" aria-hidden="true"></div>
	<div class="catalog-exercise-skeleton__list" aria-hidden="true">
		{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
			<div class="catalog-exercise-skeleton__row">
				<div class="catalog-exercise-skeleton__thumb"></div>
				<div class="catalog-exercise-skeleton__body">
					<div class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--title"></div>
					<div class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--meta"></div>
				</div>
				<div class="catalog-exercise-skeleton__actions">
					<div class="catalog-exercise-skeleton__action"></div>
					<div class="catalog-exercise-skeleton__action"></div>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.catalog-exercise-skeleton__count {
		height: 0.875rem;
		width: 5.5rem;
		margin-bottom: 0.75rem;
		border-radius: 0.35rem;
		background: var(--color-surface-muted);
		animation: catalog-exercise-skeleton-shimmer 1.1s ease-in-out infinite;
		background-image: linear-gradient(
			90deg,
			var(--color-surface-muted) 0%,
			color-mix(in srgb, var(--color-surface-elevated) 70%, var(--color-surface-muted)) 50%,
			var(--color-surface-muted) 100%
		);
		background-size: 200% 100%;
	}

	.catalog-exercise-skeleton__list {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
		box-shadow: var(--shadow-panel);
	}

	.catalog-exercise-skeleton__row {
		position: relative;
		display: flex;
		align-items: stretch;
		min-height: var(--media-native);
		border-bottom: none;
	}

	.catalog-exercise-skeleton__row:not(:last-child)::after {
		content: '';
		position: absolute;
		top: auto;
		bottom: 0;
		right: 0;
		left: var(--media-native);
		height: 1px;
		background: var(--color-border);
	}

	.catalog-exercise-skeleton__row:last-child {
		border-bottom: 0;
	}

	.catalog-exercise-skeleton__thumb {
		flex: 0 0 var(--media-native);
		width: var(--media-native);
		background: var(--color-surface-muted);
		animation: catalog-exercise-skeleton-shimmer 1.1s ease-in-out infinite;
		background-image: linear-gradient(
			90deg,
			var(--color-surface-muted) 0%,
			color-mix(in srgb, var(--color-surface-elevated) 70%, var(--color-surface-muted)) 50%,
			var(--color-surface-muted) 100%
		);
		background-size: 200% 100%;
	}

	.catalog-exercise-skeleton__body {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		justify-content: center;
		gap: 0.45rem;
		min-width: 0;
		padding: 0.65rem 0.75rem;
	}

	.catalog-exercise-skeleton__line {
		height: 0.75rem;
		border-radius: 0.35rem;
		background: var(--color-surface-muted);
		animation: catalog-exercise-skeleton-shimmer 1.1s ease-in-out infinite;
		background-image: linear-gradient(
			90deg,
			var(--color-surface-muted) 0%,
			color-mix(in srgb, var(--color-surface-elevated) 70%, var(--color-surface-muted)) 50%,
			var(--color-surface-muted) 100%
		);
		background-size: 200% 100%;
	}

	.catalog-exercise-skeleton__line--title {
		width: min(72%, 14rem);
		height: 0.8125rem;
	}

	.catalog-exercise-skeleton__line--meta {
		width: min(42%, 8rem);
		height: 0.6875rem;
	}

	.catalog-exercise-skeleton__actions {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.125rem;
		padding-right: 0.4rem;
	}

	.catalog-exercise-skeleton__action {
		width: 2rem;
		height: 2rem;
		border-radius: 0.45rem;
		background: var(--color-surface-muted);
		animation: catalog-exercise-skeleton-shimmer 1.1s ease-in-out infinite;
		background-image: linear-gradient(
			90deg,
			var(--color-surface-muted) 0%,
			color-mix(in srgb, var(--color-surface-elevated) 70%, var(--color-surface-muted)) 50%,
			var(--color-surface-muted) 100%
		);
		background-size: 200% 100%;
	}

	@keyframes catalog-exercise-skeleton-shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}
</style>
