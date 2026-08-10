<script lang="ts">
	let { label }: { label: string } = $props();
</script>

<div class="workouts-skeleton" aria-busy="true" aria-live="polite">
	<span class="sr-only">{label}</span>
	<div class="workouts-skeleton-search" aria-hidden="true"></div>
	<div class="workouts-skeleton-list" aria-hidden="true">
		<div class="workouts-skeleton-row"></div>
		<div class="workouts-skeleton-row"></div>
		<div class="workouts-skeleton-row"></div>
		<div class="workouts-skeleton-row"></div>
	</div>
</div>

<style>
	.workouts-skeleton-search {
		height: 3.25rem;
		margin-bottom: 1rem;
		border-radius: var(--radius-panel);
		border: 1px solid var(--color-border);
		background: var(--color-surface-muted);
		animation: workouts-skeleton-shimmer 1.1s ease-in-out infinite;
		background-image: linear-gradient(
			90deg,
			var(--color-surface-muted) 0%,
			color-mix(in srgb, var(--color-surface-elevated) 70%, var(--color-surface-muted)) 50%,
			var(--color-surface-muted) 100%
		);
		background-size: 200% 100%;
	}

	.workouts-skeleton-list {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.workouts-skeleton-row {
		min-height: 5.25rem;
		border-radius: var(--radius-panel);
		border: 1px solid var(--color-border);
		background: var(--color-surface-muted);
		animation: workouts-skeleton-shimmer 1.1s ease-in-out infinite;
		background-image: linear-gradient(
			90deg,
			var(--color-surface-muted) 0%,
			color-mix(in srgb, var(--color-surface-elevated) 70%, var(--color-surface-muted)) 50%,
			var(--color-surface-muted) 100%
		);
		background-size: 200% 100%;
	}

	@keyframes workouts-skeleton-shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}
</style>
