<script lang="ts">
	let { label }: { label: string } = $props();
</script>

<div class="home-skeleton" aria-busy="true" aria-live="polite">
	<span class="sr-only">{label}</span>
	<div class="home-skeleton-hero" aria-hidden="true"></div>
	<div class="home-skeleton-grid" aria-hidden="true">
		<div class="home-skeleton-section">
			<div class="home-skeleton-heading"></div>
			<div class="home-skeleton-row"></div>
			<div class="home-skeleton-row"></div>
			<div class="home-skeleton-row"></div>
		</div>
		<div class="home-skeleton-section">
			<div class="home-skeleton-heading"></div>
			<div class="home-skeleton-row"></div>
			<div class="home-skeleton-row"></div>
		</div>
	</div>
</div>

<style>
	.home-skeleton-hero {
		margin-bottom: 1.75rem;
		min-height: 10.5rem;
		border-radius: var(--radius-panel);
		background: var(--color-surface-muted);
		animation: home-skeleton-shimmer 1.1s ease-in-out infinite;
		background-image: linear-gradient(
			90deg,
			var(--color-surface-muted) 0%,
			color-mix(in srgb, var(--color-surface-elevated) 70%, var(--color-surface-muted)) 50%,
			var(--color-surface-muted) 100%
		);
		background-size: 200% 100%;
	}

	.home-skeleton-grid {
		display: grid;
		gap: 1.75rem;
	}

	@media (min-width: 1024px) {
		.home-skeleton-grid {
			grid-template-columns: minmax(0, 1.35fr) minmax(16rem, 0.85fr);
			gap: 2rem;
		}
	}

	.home-skeleton-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.home-skeleton-heading {
		width: 42%;
		max-width: 10rem;
		height: 1.125rem;
		margin-bottom: 0.35rem;
		border-radius: 0.35rem;
		background: var(--color-surface-muted);
		animation: home-skeleton-shimmer 1.1s ease-in-out infinite;
		background-image: linear-gradient(
			90deg,
			var(--color-surface-muted) 0%,
			color-mix(in srgb, var(--color-surface-elevated) 70%, var(--color-surface-muted)) 50%,
			var(--color-surface-muted) 100%
		);
		background-size: 200% 100%;
	}

	.home-skeleton-row {
		height: 3.35rem;
		border-radius: var(--radius-control);
		background: var(--color-surface-muted);
		animation: home-skeleton-shimmer 1.1s ease-in-out infinite;
		background-image: linear-gradient(
			90deg,
			var(--color-surface-muted) 0%,
			color-mix(in srgb, var(--color-surface-elevated) 70%, var(--color-surface-muted)) 50%,
			var(--color-surface-muted) 100%
		);
		background-size: 200% 100%;
	}

	@keyframes home-skeleton-shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}
</style>
