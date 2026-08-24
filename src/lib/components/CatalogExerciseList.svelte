<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import CatalogExerciseListSkeleton from '$lib/components/CatalogExerciseListSkeleton.svelte';
	import ExerciseCard from '$lib/components/ExerciseCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import SwipeToDelete from '$lib/components/SwipeToDelete.svelte';
	import { filterCatalogWithFacets, isBodyPart, isFilterConflict } from '$lib/domain/filters';
	import { pickFrequent, pickPopular, sortByScore } from '$lib/domain/exerciseScore';
	import { catalogZoneBodyParts, isCatalogZone } from '$lib/domain/catalogLinks';
	import { currentReturnPath } from '$lib/domain/navigation';
	import type { ExerciseFilters, ExerciseIndexItem } from '$lib/domain/types';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { translate } from '$lib/i18n/messages';
	import { CATALOG_PAGE_SIZE } from '$lib/stores/catalogUi';
	import { bookmarks } from '$lib/stores/bookmarks';
	import { exerciseStats } from '$lib/stores/exerciseStats';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, untrack } from 'svelte';
	import { Bookmark } from '@lucide/svelte';

	let {
		equipment: equipmentFacets,
		targets: targetFacets,
		totalCount,
		indexError,
		presetBodyPart = 'all',
		initialQuery = '',
		initialEquipment = '',
		initialTarget = '',
		initialBodyPart = '',
		listOnMobile = true,
		gridOnDesktop = false,
		savedOnly = false
	}: {
		equipment: string[];
		targets: string[];
		totalCount: number;
		indexError: string | null;
		presetBodyPart?: string;
		initialQuery?: string;
		initialEquipment?: string;
		initialTarget?: string;
		/** Deep-link ?bodyPart= on /catalog/all (no UI select — body is hub/zone navigation). */
		initialBodyPart?: string;
		listOnMobile?: boolean;
		/** List on phone, grid from 768px (catalog all/zone and builder add flow). */
		gridOnDesktop?: boolean;
		savedOnly?: boolean;
	} = $props();

	function filtersFromUrl(): ExerciseFilters {
		const urlHasQuery = Boolean(initialQuery.trim());
		const urlHasEquipment = initialEquipment !== '';
		const urlHasTarget = initialTarget !== '';
		const urlBody =
			initialBodyPart && isBodyPart(initialBodyPart) ? initialBodyPart : ('all' as const);

		if (presetBodyPart !== 'all' && isCatalogZone(presetBodyPart)) {
			return {
				query: urlHasQuery ? initialQuery : '',
				bodyPart: presetBodyPart as ExerciseFilters['bodyPart'],
				equipment: urlHasEquipment ? initialEquipment : 'all',
				target: urlHasTarget ? initialTarget : 'all'
			};
		}

		return {
			query: urlHasQuery ? initialQuery : '',
			bodyPart: urlBody,
			equipment: urlHasEquipment ? initialEquipment : 'all',
			target: urlHasTarget ? initialTarget : 'all'
		};
	}

	let items = $state<ExerciseIndexItem[]>([]);
	let indexReady = $state(false);
	let visibleLimit = $state(CATALOG_PAGE_SIZE);
	let filters = $state<ExerciseFilters>(filtersFromUrl());
	let filtersHydrated = $state(false);
	let syncingFiltersToUrl = false;

	let zoneLocked = $derived(presetBodyPart !== 'all' && isCatalogZone(presetBodyPart));
	let zoneBodyParts = $derived(
		zoneLocked ? catalogZoneBodyParts(presetBodyPart) : []
	);
	let filterLockBodyPart = $derived(zoneLocked);

	let lang = $derived($resolvedLocale);
	/** Current list URL — exercise detail back returns here (preserves `from` chain). */
	let detailFrom = $derived(currentReturnPath($page.url.pathname, $page.url.searchParams));
	let catalog = $derived(indexReady ? items : []);
	let statsMap = $derived($exerciseStats);
	let catalogFiltered = $derived.by(() => {
		const allowed = zoneLocked && zoneBodyParts.length > 0 ? new Set(zoneBodyParts) : null;
		const scopedCatalog = allowed
			? catalog.filter((item) => allowed.has(item.body_part))
			: catalog;
		/** Zone already scopes body parts — don't pass a single bodyPart into facets. */
		const queryFilters =
			allowed != null
				? { ...filters, bodyPart: 'all' as ExerciseFilters['bodyPart'] }
				: filters;
		return filterCatalogWithFacets(scopedCatalog, queryFilters, lang, statsMap);
	});
	let equipmentOptions = $derived(catalogFiltered.equipment);
	let targetOptions = $derived(catalogFiltered.targets);
	let filtered = $derived(catalogFiltered.items);
	let bookmarkSet = $derived(new Set($bookmarks));
	let visible = $derived(
		savedOnly ? filtered.filter((ex) => bookmarkSet.has(ex.id)) : filtered
	);
	let useSections = $derived(!savedOnly && !filters.query.trim() && visible.length > 0);
	let frequentItems = $derived(useSections ? pickFrequent(visible, statsMap, 12) : []);
	let frequentIds = $derived(new Set(frequentItems.map((ex) => ex.id)));
	let popularItems = $derived(useSections ? pickPopular(visible, frequentIds, 12) : []);
	let sectionExcludeIds = $derived(
		new Set([...frequentItems, ...popularItems].map((ex) => ex.id))
	);
	let allSectionItems = $derived(
		useSections
			? sortByScore(
					visible.filter((ex) => !sectionExcludeIds.has(ex.id)),
					statsMap
				)
			: visible
	);
	let shownAll = $derived(allSectionItems.slice(0, visibleLimit));
	let shownFlat = $derived(visible.slice(0, visibleLimit));
	let shownCount = $derived(
		useSections
			? frequentItems.length + popularItems.length + shownAll.length
			: shownFlat.length
	);
	let filtersActive = $derived(
		Boolean(filters.query.trim()) ||
			filters.bodyPart !== 'all' ||
			filters.equipment !== 'all' ||
			filters.target !== 'all'
	);
	let filterConflict = $derived(
		visible.length === 0 ? isFilterConflict(catalog, filters, lang) : false
	);
	let totalForCount = $derived(indexReady ? visible.length : totalCount);
	let hasMore = $derived(
		indexReady && visibleLimit < (useSections ? allSectionItems.length : visible.length)
	);
	let bookmarksLoaded = $state(false);
	let cardVariant = $derived(
		!listOnMobile || gridOnDesktop ? ('grid' as const) : ('list' as const)
	);
	let listClass = $derived(
		cardVariant === 'grid'
			? 'catalog-grid grid min-w-0 gap-2.5 sm:gap-3'
			: 'catalog-exercise-list'
	);
	let emptyStateClass = $derived(
		`catalog-empty-state${savedOnly ? ' catalog-empty-state--saved' : ''}`
	);

	$effect(() => {
		if (!zoneLocked || !isCatalogZone(presetBodyPart)) return;
		if (filters.bodyPart === presetBodyPart) return;
		filters = { ...filters, bodyPart: presetBodyPart as ExerciseFilters['bodyPart'] };
	});

	/** Apply facet props from the route when they change — not when local filters edit. */
	$effect(() => {
		initialQuery;
		initialEquipment;
		initialTarget;
		initialBodyPart;
		presetBodyPart;
		const next = filtersFromUrl();
		// Snapshot must be fully untracked: reading `filters.foo` outside untrack
		// still subscribes and re-runs this effect on every keystroke, wiping query.
		const changed = untrack(() =>
			(Object.keys(next) as (keyof ExerciseFilters)[]).some((key) => filters[key] !== next[key])
		);
		if (!changed) return;
		syncingFiltersToUrl = true;
		filters = next;
		queueMicrotask(() => {
			syncingFiltersToUrl = false;
		});
	});

	$effect(() => {
		if (!browser || !filtersHydrated || syncingFiltersToUrl) return;
		filters.query;
		filters.bodyPart;
		filters.equipment;
		filters.target;

		const url = new URL($page.url.href);
		const q = filters.query.trim();
		if (q) url.searchParams.set('q', q);
		else url.searchParams.delete('q');

		if (filters.equipment !== 'all') url.searchParams.set('equipment', filters.equipment);
		else url.searchParams.delete('equipment');

		if (filters.target !== 'all') url.searchParams.set('target', filters.target);
		else url.searchParams.delete('target');

		if (!zoneLocked) {
			if (filters.bodyPart !== 'all') url.searchParams.set('bodyPart', filters.bodyPart);
			else url.searchParams.delete('bodyPart');
		} else {
			url.searchParams.delete('bodyPart');
		}

		const next = `${url.pathname}${url.search}${url.hash}`;
		const cur = `${$page.url.pathname}${$page.url.search}${$page.url.hash}`;
		if (next === cur) return;

		// After paint so chip press feels instant; facets already applied in local state.
		const frame = requestAnimationFrame(() => {
			replaceState(next, $page.state);
		});
		return () => cancelAnimationFrame(frame);
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

	/** Drop stale facets using already-cascaded option lists (no second full catalog scan). */
	$effect(() => {
		if (!indexReady) return;
		equipmentOptions;
		targetOptions;
		const nextEq =
			filters.equipment !== 'all' && !equipmentOptions.includes(filters.equipment)
				? 'all'
				: filters.equipment;
		const nextTarget =
			targetOptions.length <= 1
				? 'all'
				: filters.target !== 'all' && !targetOptions.includes(filters.target)
					? 'all'
					: filters.target;
		if (nextEq === filters.equipment && nextTarget === filters.target) return;
		untrack(() => {
			filters = { ...filters, equipment: nextEq, target: nextTarget };
		});
	});

	onMount(() => {
		void bookmarks.refresh().finally(() => {
			bookmarksLoaded = true;
		});
		void loadExerciseIndex()
			.then((all) => {
				items = all;
				indexReady = true;
			})
			.catch(() => {
				items = [];
				indexReady = true;
			});
	});

	function loadMore() {
		const total = useSections ? allSectionItems.length : visible.length;
		if (!indexReady || visibleLimit >= total) return;
		visibleLimit = Math.min(total, visibleLimit + CATALOG_PAGE_SIZE);
	}

	let unbookmarkBusyId = $state<string | null>(null);

	async function unbookmark(exerciseId: string) {
		if (unbookmarkBusyId) return;
		unbookmarkBusyId = exerciseId;
		try {
			await bookmarks.toggle(exerciseId);
			toasts.show(translate(lang, 'bookmarks.removed'), 'info', 2600, undefined, 'bookmark');
		} catch {
			toasts.show(translate(lang, 'errors.generic'), 'error');
		} finally {
			unbookmarkBusyId = null;
		}
	}

	/** Sentinel for infinite scroll — keep loading while it stays in/near the viewport. */
	let loadMoreSentinel = $state<HTMLElement | null>(null);

	$effect(() => {
		if (!browser || !hasMore || !loadMoreSentinel) return;
		const el = loadMoreSentinel;
		// Re-run after each page so a still-visible sentinel keeps filling short viewports.
		visibleLimit;

		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) loadMore();
			},
			{ root: null, rootMargin: '320px 0px', threshold: 0 }
		);
		io.observe(el);

		const frame = requestAnimationFrame(() => {
			const rect = el.getBoundingClientRect();
			if (rect.top <= window.innerHeight + 320) loadMore();
		});

		return () => {
			cancelAnimationFrame(frame);
			io.disconnect();
		};
	});
</script>

<div class="catalog-list-layout">
	<div class="catalog-list-layout__filters">
		<FilterBar
			bind:filters
			equipment={equipmentOptions}
			targets={targetOptions}
			lockBodyPart={filterLockBodyPart}
		/>
	</div>

	<div class="catalog-list-layout__main">
{#if indexError}
	<EmptyState
		title={translate(lang, 'catalog.dataMissing')}
		description={indexError ? translate(lang, indexError) : ''}
	/>
{:else if !indexReady || (savedOnly && !bookmarksLoaded)}
	<CatalogExerciseListSkeleton
		label={translate(lang, 'catalog.loading')}
		variant={cardVariant}
	/>
{:else}
	<p class="catalog-list-count mb-3 text-sm text-[var(--color-muted)]" aria-live="polite">
		{translate(lang, 'catalog.countShown', {
			shown: shownCount,
			n: filtersActive || indexReady ? visible.length : totalForCount
		})}
	</p>
	{#if visible.length === 0}
		{#if filterConflict}
			<AppPanel dashed class="flex flex-col items-start gap-3 py-6 text-left md:py-8">
				<h2 class="section-title">{translate(lang, 'catalog.conflictTitle')}</h2>
				<p class="max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
					{translate(lang, 'catalog.conflictDesc')}
				</p>
				<div class="flex flex-wrap gap-2">
					{#if filters.target !== 'all'}
						<AppButton
							variant="secondary"
							class="text-sm"
							onclick={() => {
								filters = { ...filters, target: 'all' };
							}}
						>
							{translate(lang, 'catalog.clearMuscle')}
						</AppButton>
					{/if}
					{#if filters.bodyPart !== 'all' && !zoneLocked}
						<AppButton
							variant="secondary"
							class="text-sm"
							onclick={() => {
								filters = { ...filters, bodyPart: 'all' };
							}}
						>
							{translate(lang, 'catalog.clearBody')}
						</AppButton>
					{/if}
					{#if filters.equipment !== 'all'}
						<AppButton
							variant="secondary"
							class="text-sm"
							onclick={() => {
								filters = { ...filters, equipment: 'all' };
							}}
						>
							{translate(lang, 'catalog.clearEquipment')}
						</AppButton>
					{/if}
					<AppButton
						class="text-sm"
						onclick={() => {
							filters = {
								...filters,
								bodyPart: zoneLocked ? filters.bodyPart : 'all',
								equipment: 'all',
								target: 'all'
							};
						}}
					>
						{translate(lang, 'catalog.reset')}
					</AppButton>
				</div>
			</AppPanel>
		{:else}
			<EmptyState
				class={emptyStateClass}
				centered={savedOnly}
				icon={savedOnly ? Bookmark : null}
				title={translate(lang, savedOnly ? 'bookmarks.emptyTitle' : 'catalog.emptyTitle')}
				description={translate(lang, savedOnly ? 'bookmarks.emptyDesc' : 'catalog.emptyDesc')}
				actionHref={savedOnly ? '/exercises' : undefined}
				actionLabel={savedOnly ? translate(lang, 'bookmarks.browse') : undefined}
			/>
		{/if}
	{:else if useSections}
		<div class="catalog-sections">
			{#if frequentItems.length > 0}
				<section class="catalog-section" aria-labelledby="catalog-section-frequent">
					<h2 id="catalog-section-frequent" class="catalog-section__title">
						{translate(lang, 'catalog.sectionFrequent')}
					</h2>
					<div class={listClass}>
						{#each frequentItems as exercise, i (exercise.id)}
							<ExerciseCard
								{exercise}
								priority={i < 4}
								variant={cardVariant}
								{detailFrom}
							/>
						{/each}
					</div>
				</section>
			{/if}
			{#if popularItems.length > 0}
				<section class="catalog-section" aria-labelledby="catalog-section-popular">
					<h2 id="catalog-section-popular" class="catalog-section__title">
						{translate(lang, 'catalog.sectionPopular')}
					</h2>
					<div class={listClass}>
						{#each popularItems as exercise, i (exercise.id)}
							<ExerciseCard
								{exercise}
								priority={frequentItems.length === 0 && i < 4}
								variant={cardVariant}
								{detailFrom}
							/>
						{/each}
					</div>
				</section>
			{/if}
			<section class="catalog-section" aria-labelledby="catalog-section-all">
				<h2 id="catalog-section-all" class="catalog-section__title">
					{translate(lang, 'catalog.sectionAll')}
				</h2>
				{#if shownAll.length === 0}
					<p class="catalog-section__empty text-sm text-[var(--color-muted)]">
						{translate(lang, 'catalog.emptyDesc')}
					</p>
				{:else}
					<div class={listClass}>
						{#each shownAll as exercise, i (exercise.id)}
							<ExerciseCard
								{exercise}
								priority={false}
								variant={cardVariant}
								{detailFrom}
							/>
						{/each}
					</div>
				{/if}
			</section>
		</div>
		{#if hasMore}
			<div
				bind:this={loadMoreSentinel}
				class="catalog-list-load-more"
				aria-hidden="true"
			></div>
		{/if}
	{:else}
		<div class={listClass}>
			{#each shownFlat as exercise, i (exercise.id)}
				{#if savedOnly}
					<SwipeToDelete
						label={translate(lang, 'bookmarks.remove')}
						busy={unbookmarkBusyId === exercise.id}
						disabled={unbookmarkBusyId !== null && unbookmarkBusyId !== exercise.id}
						onDelete={() => void unbookmark(exercise.id)}
					>
						<ExerciseCard
							{exercise}
							priority={i < 4}
							variant={cardVariant}
							{detailFrom}
						/>
					</SwipeToDelete>
				{:else}
					<ExerciseCard
						{exercise}
						priority={i < 4}
						variant={cardVariant}
						{detailFrom}
					/>
				{/if}
			{/each}
		</div>
		{#if hasMore}
			<div
				bind:this={loadMoreSentinel}
				class="catalog-list-load-more"
				aria-hidden="true"
			></div>
		{/if}
	{/if}
{/if}
	</div>
</div>
