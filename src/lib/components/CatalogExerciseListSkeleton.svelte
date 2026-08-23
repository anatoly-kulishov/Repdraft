<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';

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
	<AppSkeleton class="catalog-exercise-skeleton__count" aria-hidden="true" />
	<div class="catalog-exercise-skeleton__list" aria-hidden="true">
		{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
			<div class="catalog-exercise-skeleton__row">
				<AppSkeleton class="catalog-exercise-skeleton__thumb" aria-hidden="true" />
				<div class="catalog-exercise-skeleton__body">
					<AppSkeleton
						class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--title"
						aria-hidden="true"
					/>
					<AppSkeleton
						class="catalog-exercise-skeleton__line catalog-exercise-skeleton__line--meta"
						aria-hidden="true"
					/>
				</div>
				<AppSkeleton class="catalog-exercise-skeleton__action" aria-hidden="true" />
			</div>
		{/each}
	</div>
</div>

<style>
	:global(.catalog-exercise-skeleton__count) {
		height: 0.875rem;
		width: 5.5rem;
		margin-bottom: 0.75rem;
		border-radius: 0.35rem;
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

	@media (max-width: 767px) {
		.catalog-exercise-skeleton__list {
			gap: 0.55rem;
			overflow: visible;
			border: none;
			border-radius: 0;
			background: transparent;
			box-shadow: none;
		}

		.catalog-exercise-skeleton__row {
			overflow: hidden;
			border: 1px solid var(--color-border);
			border-radius: 1rem;
			background: var(--color-surface);
			box-shadow: var(--shadow-panel);
		}

		.catalog-exercise-skeleton__row:not(:last-child)::after {
			display: none;
		}

		:global(.catalog-exercise-skeleton__thumb) {
			border-radius: calc(1rem - 1px) 0 0 calc(1rem - 1px);
			align-self: stretch;
		}
	}

	.catalog-exercise-skeleton__row {
		position: relative;
		display: flex;
		align-items: stretch;
		min-height: calc(var(--media-native) + 0.35rem);
		padding-right: 0.35rem;
	}

	.catalog-exercise-skeleton__row:not(:last-child)::after {
		content: '';
		position: absolute;
		right: 0;
		bottom: 0;
		left: var(--media-native);
		height: 1px;
		background: var(--color-border);
	}

	:global(.catalog-exercise-skeleton__thumb) {
		flex: 0 0 var(--media-native);
		width: var(--media-native);
		min-height: var(--media-native);
		align-self: stretch;
		border-radius: 0;
		box-shadow: inset -1px 0 0 color-mix(in srgb, var(--color-border) 85%, transparent);
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

	:global(.catalog-exercise-skeleton__line--title) {
		width: min(72%, 14rem);
		height: 0.875rem;
		border-radius: 999px;
	}

	:global(.catalog-exercise-skeleton__line--meta) {
		width: min(42%, 8rem);
		height: 0.75rem;
		border-radius: 999px;
	}

	:global(.catalog-exercise-skeleton__action) {
		flex-shrink: 0;
		align-self: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: var(--radius-control);
	}
</style>
