<script lang="ts">
	import CommunityFeed from '$lib/components/CommunityFeed.svelte';
	import ExerciseCard from '$lib/components/ExerciseCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import { availableEquipment, availableTargets, filterExercises, isFilterConflict } from '$lib/domain/filters';
	import { formatPersonalRecord } from '$lib/domain/records';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { translate } from '$lib/i18n/messages';
	import { CATALOG_PAGE_SIZE, catalogUi, emptyCatalogFilters } from '$lib/stores/catalogUi';
	import { records } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { browser } from '$app/environment';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	let { data } = $props();

	const saved = browser
		? get(catalogUi)
		: { filters: emptyCatalogFilters(), visibleLimit: CATALOG_PAGE_SIZE };
	let items = $state<ExerciseIndexItem[]>([]);
	let indexReady = $state(false);
	let visibleLimit = $state(saved.visibleLimit);
	let feedReady = $state(false);
	let filters = $state({ ...saved.filters });
	let filtersHydrated = $state(false);

	let lang = $derived($resolvedLocale);
	let catalog = $derived(indexReady && items.length > 0 ? items : data.boot);
	let bodyParts = $derived(data.bodyParts);
	let equipmentOptions = $derived(availableEquipment(catalog, filters, lang));
	let targetOptions = $derived(availableTargets(catalog, filters, lang));
	let visible = $derived(filterExercises(catalog, filters, lang));
	let shown = $derived(visible.slice(0, visibleLimit));
	let filtersActive = $derived(
		Boolean(filters.query.trim()) ||
			filters.bodyPart !== 'all' ||
			filters.equipment !== 'all' ||
			filters.target !== 'all'
	);
	let filterConflict = $derived(isFilterConflict(catalog, filters, lang));
	let totalForCount = $derived(indexReady ? visible.length : data.totalCount);
	let hasMore = $derived(
		indexReady ? visibleLimit < visible.length : visibleLimit < data.totalCount && !filtersActive
	);
	let recordLabels = $derived(
		new Map($records.map((r) => [r.exerciseId, formatPersonalRecord(r, lang)]))
	);
	let exerciseNames = $derived(
		new Map(catalog.map((item) => [item.id, exerciseName(item, lang)]))
	);
	let preloadImages = $derived(shown.slice(0, 4).map((item) => `/${item.image}`));
	let error = $derived(data.indexError);

	$effect(() => {
		if (!browser) return;
		catalogUi.setFilters({
			query: filters.query,
			bodyPart: filters.bodyPart,
			equipment: filters.equipment,
			target: filters.target
		});
	});

	$effect(() => {
		if (!browser) return;
		catalogUi.setVisibleLimit(visibleLimit);
	});

	$effect(() => {
		filters.query;
		filters.bodyPart;
		filters.equipment;
		filters.target;
		lang;
		if (!filtersHydrated) {
			filtersHydrated = true;
			return;
		}
		visibleLimit = CATALOG_PAGE_SIZE;
	});

	/** Drop facet values that vanished after cascade (e.g. Legs + Chest). */
	$effect(() => {
		const nextEq =
			filters.equipment !== 'all' && !equipmentOptions.includes(filters.equipment)
				? 'all'
				: filters.equipment;
		const nextTarget =
			filters.target !== 'all' && !targetOptions.includes(filters.target) ? 'all' : filters.target;
		if (nextEq === filters.equipment && nextTarget === filters.target) return;
		filters = { ...filters, equipment: nextEq, target: nextTarget };
	});

	onMount(() => {
		const w = window as Window & {
			requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
			cancelIdleCallback?: (id: number) => void;
		};
		let idleIds: number[] = [];
		let timeoutIds: ReturnType<typeof setTimeout>[] = [];
		let cancelled = false;

		const scheduleIdle = (fn: () => void, timeout: number) => {
			if (typeof w.requestIdleCallback === 'function') {
				idleIds.push(w.requestIdleCallback(fn, { timeout }));
			} else {
				timeoutIds.push(setTimeout(fn, Math.min(timeout, 400)));
			}
		};

		// Full index for search — after first cards are on screen.
		void loadExerciseIndex()
			.then((all) => {
				if (cancelled) return;
				items = all;
				indexReady = true;
			})
			.catch(() => {
				/* boot page still works */
			});

		scheduleIdle(() => records.refresh(), 2000);
		// Feed: skeleton shows immediately; real GIFs start after load + idle.
		const revealFeed = () => {
			feedReady = true;
		};
		const onLoad = () => scheduleIdle(revealFeed, 800);
		if (document.readyState === 'complete') onLoad();
		else window.addEventListener('load', onLoad, { once: true });

		return () => {
			cancelled = true;
			for (const id of idleIds) w.cancelIdleCallback?.(id);
			for (const id of timeoutIds) clearTimeout(id);
			window.removeEventListener('load', onLoad);
		};
	});

	function loadMore() {
		if (!indexReady) {
			// Wait until full index is in memory before paging past boot.
			void loadExerciseIndex().then((all) => {
				items = all;
				indexReady = true;
				visibleLimit = Math.min(all.length, visibleLimit + CATALOG_PAGE_SIZE);
			});
			return;
		}
		visibleLimit = Math.min(visible.length, visibleLimit + CATALOG_PAGE_SIZE);
	}
</script>

<svelte:head>
	<title>{translate(lang, 'catalog.title')} — Repdraft</title>
	{#each preloadImages as href (href)}
		<link rel="preload" as="image" {href} fetchpriority="high" />
	{/each}
</svelte:head>

<section aria-labelledby="catalog-heading">
	<div class="page-header">
		<h1 id="catalog-heading" class="page-title">{translate(lang, 'catalog.title')}</h1>
		<p class="page-lead">{translate(lang, 'catalog.lead')}</p>
	</div>

	{#if !filtersActive}
		<div class="soft-enter">
			<CommunityFeed {exerciseNames} start={feedReady} />
		</div>
	{/if}

	<FilterBar bind:filters {bodyParts} equipment={equipmentOptions} targets={targetOptions} />

	{#if error}
		<EmptyState
			title={translate(lang, 'catalog.dataMissing')}
			description={error ? translate(lang, error) : ''}
		/>
	{:else}
		<p class="mb-4 text-sm text-[var(--color-muted)]" aria-live="polite">
			{translate(lang, 'catalog.countShown', {
				shown: shown.length,
				n: indexReady || filtersActive ? visible.length : totalForCount
			})}
		</p>
		{#if visible.length === 0}
			{#if filterConflict}
				<div class="panel-dashed flex flex-col items-start gap-3 py-6 text-left md:py-8">
					<h2 class="section-title">{translate(lang, 'catalog.conflictTitle')}</h2>
					<p class="max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
						{translate(lang, 'catalog.conflictDesc')}
					</p>
					<div class="flex flex-wrap gap-2">
						{#if filters.target !== 'all'}
							<button
								type="button"
								class="btn-secondary text-sm"
								onclick={() => {
									filters = { ...filters, target: 'all' };
								}}
							>
								{translate(lang, 'catalog.clearMuscle')}
							</button>
						{/if}
						{#if filters.bodyPart !== 'all'}
							<button
								type="button"
								class="btn-secondary text-sm"
								onclick={() => {
									filters = { ...filters, bodyPart: 'all' };
								}}
							>
								{translate(lang, 'catalog.clearBody')}
							</button>
						{/if}
						{#if filters.equipment !== 'all'}
							<button
								type="button"
								class="btn-secondary text-sm"
								onclick={() => {
									filters = { ...filters, equipment: 'all' };
								}}
							>
								{translate(lang, 'catalog.clearEquipment')}
							</button>
						{/if}
						<button
							type="button"
							class="btn-primary text-sm"
							onclick={() => {
								filters = { ...filters, bodyPart: 'all', equipment: 'all', target: 'all' };
							}}
						>
							{translate(lang, 'catalog.reset')}
						</button>
					</div>
				</div>
			{:else}
				<EmptyState
					title={translate(lang, 'catalog.emptyTitle')}
					description={translate(lang, 'catalog.emptyDesc')}
				/>
			{/if}
		{:else}
			<div
				class="catalog-grid soft-enter grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5"
			>
				{#each shown as exercise, i (exercise.id)}
					<ExerciseCard
						{exercise}
						recordLabel={recordLabels.get(exercise.id) ?? null}
						priority={i < 4}
					/>
				{/each}
			</div>
			{#if hasMore}
				<div class="mt-5 flex justify-center">
					<button type="button" class="btn-secondary min-w-[12rem]" onclick={loadMore}>
						{translate(lang, 'catalog.loadMore', {
							n: Math.min(
								CATALOG_PAGE_SIZE,
								(indexReady ? visible.length : data.totalCount) - shown.length
							)
						})}
					</button>
				</div>
			{/if}
		{/if}
	{/if}
</section>
