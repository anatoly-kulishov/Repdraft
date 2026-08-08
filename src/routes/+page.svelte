<script lang="ts">
	import ExerciseCard from '$lib/components/ExerciseCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import { filterExercises, uniqueSorted } from '$lib/domain/filters';
	import { formatPersonalRecord } from '$lib/domain/records';
	import type { ExerciseFilters, ExerciseIndexItem } from '$lib/domain/types';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { records } from '$lib/stores/records';
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

	let bodyParts = $derived(uniqueSorted(items, 'body_part'));
	let equipment = $derived(uniqueSorted(items, 'equipment'));
	let targets = $derived(uniqueSorted(items, 'target'));
	let visible = $derived(filterExercises(items, filters));
	let recordLabels = $derived(
		new Map($records.map((r) => [r.exerciseId, formatPersonalRecord(r)]))
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
	<title>Каталог — Repdraft</title>
</svelte:head>

<section>
	<div class="mb-3">
		<h1 class="font-[family-name:var(--font-display)] text-2xl leading-tight text-[var(--color-ink)] md:text-3xl">
			Каталог упражнений
		</h1>
		<p class="mt-1 text-sm text-[var(--color-muted)]">
			Соберите тренировку из 1300+ упражнений.
		</p>
	</div>

	<FilterBar bind:filters {bodyParts} {equipment} {targets} />

	{#if loading}
		<p class="text-sm text-[var(--color-muted)]">Загрузка каталога…</p>
	{:else if error}
		<EmptyState title="Данные не найдены" description={error} />
	{:else}
		<p class="mb-3 text-sm text-[var(--color-muted)]">{visible.length} упражнений</p>
		{#if visible.length === 0}
			<EmptyState
				title="Ничего не найдено"
				description="Сбросьте фильтры или измените поисковый запрос."
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
