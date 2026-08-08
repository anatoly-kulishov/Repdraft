<script lang="ts">
	import CommunityFeed from '$lib/components/CommunityFeed.svelte';
	import ExerciseCard from '$lib/components/ExerciseCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import { filterExercises, uniqueSorted } from '$lib/domain/filters';
	import { formatPersonalRecord } from '$lib/domain/records';
	import type { ExerciseFilters, ExerciseIndexItem } from '$lib/domain/types';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { translate } from '$lib/i18n/messages';
	import { records } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onMount } from 'svelte';

	let items = $state<ExerciseIndexItem[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let filters = $state<ExerciseFilters>({
		query: '',
		bodyPart: 'all',
		equipment: 'all',
		target: 'all'
	});

	let lang = $derived($resolvedLocale);
	let bodyParts = $derived(uniqueSorted(items, 'body_part'));
	let equipment = $derived(uniqueSorted(items, 'equipment'));
	let targets = $derived(uniqueSorted(items, 'target'));
	let visible = $derived(filterExercises(items, filters, lang));
	let recordLabels = $derived(
		new Map($records.map((r) => [r.exerciseId, formatPersonalRecord(r, lang)]))
	);
	let exerciseNames = $derived(
		new Map(items.map((item) => [item.id, exerciseName(item, lang)]))
	);
	let filtersActive = $derived(
		Boolean(filters.query.trim()) ||
			filters.bodyPart !== 'all' ||
			filters.equipment !== 'all' ||
			filters.target !== 'all'
	);

	onMount(() => {
		records.refresh();
	});

	$effect(() => {
		let cancelled = false;
		loading = true;
		error = null;
		loadExerciseIndex()
			.then((data) => {
				if (!cancelled) {
					items = data;
					loading = false;
				}
			})
			.catch((err: Error) => {
				if (!cancelled) {
					error = err.message;
					loading = false;
				}
			});
		return () => {
			cancelled = true;
		};
	});
</script>

<svelte:head>
	<title>{translate(lang, 'catalog.title')} — Repdraft</title>
</svelte:head>

<section>
	<div class="mb-3">
		<h1 class="page-title">{translate(lang, 'catalog.title')}</h1>
		<p class="page-lead">{translate(lang, 'catalog.lead')}</p>
	</div>

	{#if !filtersActive}
		<CommunityFeed {exerciseNames} />
	{/if}

	<FilterBar bind:filters {bodyParts} {equipment} {targets} />

	{#if loading}
		<div class="catalog-grid grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{#each Array.from({ length: 10 }, (_, i) => i) as i (i)}
				<div
					class="aspect-[3/4] animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]"
				></div>
			{/each}
		</div>
	{:else if error}
		<EmptyState title={translate(lang, 'catalog.dataMissing')} description={error} />
	{:else}
		<p class="mb-3 text-sm text-[var(--color-muted)]">
			{translate(lang, 'catalog.count', { n: visible.length })}
		</p>
		{#if visible.length === 0}
			<EmptyState
				title={translate(lang, 'catalog.emptyTitle')}
				description={translate(lang, 'catalog.emptyDesc')}
			/>
		{:else}
			<div class="catalog-grid grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
				{#each visible as exercise (exercise.id)}
					<ExerciseCard {exercise} recordLabel={recordLabels.get(exercise.id) ?? null} />
				{/each}
			</div>
		{/if}
	{/if}
</section>
