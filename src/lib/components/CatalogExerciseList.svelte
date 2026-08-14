<script lang="ts">
	import CatalogExerciseListSkeleton from '$lib/components/CatalogExerciseListSkeleton.svelte';
	import ExerciseCard from '$lib/components/ExerciseCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import { filterCatalogWithFacets, filterExercises, isFilterConflict } from '$lib/domain/filters';
	import { catalogZoneBodyParts, isCatalogZone } from '$lib/domain/catalogLinks';
	import { personalRecordChips } from '$lib/domain/records';
	import type { ExerciseFilters, ExerciseIndexItem } from '$lib/domain/types';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { translate } from '$lib/i18n/messages';
	import { CATALOG_PAGE_SIZE, catalogUi, emptyCatalogFilters } from '$lib/stores/catalogUi';
	import { bookmarks } from '$lib/stores/bookmarks';
	import { records } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { onMount, untrack } from 'svelte';

	let {
		bodyParts,
		equipment: equipmentFacets,
		targets: targetFacets,
		totalCount,
		indexError,
		presetBodyPart = 'all',
		initialQuery = '',
		initialEquipment = '',
		initialTarget = '',
		listOnMobile = true,
		gridOnDesktop = false,
		returnAfterAdd = null as string | null,
		savedOnly = false,
		hideTargetFilter = false
	}: {
		bodyParts: string[];
		equipment: string[];
		targets: string[];
		totalCount: number;
		indexError: string | null;
		presetBodyPart?: string;
		initialQuery?: string;
		initialEquipment?: string;
		initialTarget?: string;
		listOnMobile?: boolean;
		/** List on phone, grid from 768px (catalog all/zone and builder add flow). */
		gridOnDesktop?: boolean;
		returnAfterAdd?: string | null;
		savedOnly?: boolean;
		/** Zone chips replace the muscle facet in FilterBar. */
		hideTargetFilter?: boolean;
	} = $props();

	const saved = browser
		? get(catalogUi)
		: { filters: emptyCatalogFilters(), visibleLimit: CATALOG_PAGE_SIZE };

	function buildInitialFilters(): ExerciseFilters {
		const urlHasQuery = Boolean(initialQuery.trim());
		const urlHasEquipment = initialEquipment !== '';
		const urlHasTarget = initialTarget !== '';
		/** Hub search / deep-link: URL is source of truth — don't resurrect stale facets. */
		const urlDriven = urlHasQuery || urlHasEquipment || urlHasTarget;

		if (presetBodyPart !== 'all' && isCatalogZone(presetBodyPart)) {
			return {
				query: urlHasQuery ? initialQuery : '',
				bodyPart: presetBodyPart as ExerciseFilters['bodyPart'],
				equipment: urlHasEquipment ? initialEquipment : 'all',
				target: urlHasTarget ? initialTarget : 'all'
			};
		}

		if (urlDriven) {
			return {
				query: urlHasQuery ? initialQuery : '',
				bodyPart: 'all',
				equipment: urlHasEquipment ? initialEquipment : 'all',
				target: urlHasTarget ? initialTarget : 'all'
			};
		}

		/* Soft remount (exercise ↔ catalog): keep session facets. */
		return { ...saved.filters };
	}

	let items = $state<ExerciseIndexItem[]>([]);
	let indexReady = $state(false);
	let visibleLimit = $state(saved.visibleLimit);
	let filters = $state<ExerciseFilters>(buildInitialFilters());
	let filtersHydrated = $state(false);

	let zoneLocked = $derived(presetBodyPart !== 'all' && isCatalogZone(presetBodyPart));
	let zoneBodyParts = $derived(
		zoneLocked ? catalogZoneBodyParts(presetBodyPart) : []
	);

	let lang = $derived($resolvedLocale);
	let detailFrom = $derived(`${$page.url.pathname}${$page.url.search}`);
	let catalog = $derived(indexReady ? items : []);
	let catalogFiltered = $derived.by(() => {
		const queryFilters =
			zoneLocked && zoneBodyParts.length > 1
				? { ...filters, bodyPart: 'all' as ExerciseFilters['bodyPart'] }
				: filters;
		const { items: base, equipment, targets } = filterCatalogWithFacets(catalog, queryFilters, lang);
		if (zoneLocked && zoneBodyParts.length > 1) {
			const allowed = new Set(zoneBodyParts);
			return {
				items: base.filter((item) => allowed.has(item.body_part)),
				equipment,
				targets
			};
		}
		return { items: base, equipment, targets };
	});
	let equipmentOptions = $derived(catalogFiltered.equipment);
	let targetOptions = $derived(catalogFiltered.targets);
	let filtered = $derived(catalogFiltered.items);
	let bookmarkSet = $derived(new Set($bookmarks));
	let visible = $derived(
		savedOnly ? filtered.filter((ex) => bookmarkSet.has(ex.id)) : filtered
	);
	let shown = $derived(visible.slice(0, visibleLimit));
	let filtersActive = $derived(
		Boolean(filters.query.trim()) ||
			filters.bodyPart !== 'all' ||
			filters.equipment !== 'all' ||
			filters.target !== 'all'
	);
	let filterConflict = $derived(isFilterConflict(catalog, filters, lang));
	let totalForCount = $derived(indexReady ? visible.length : totalCount);
	let hasMore = $derived(indexReady && visibleLimit < visible.length);
	let bookmarksLoaded = $state(false);
	let recordChipsById = $derived(
		new Map($records.map((r) => [r.exerciseId, personalRecordChips(r, lang)]))
	);
	let wideViewport = $state(false);
	let cardVariant = $derived(
		listOnMobile
			? gridOnDesktop && wideViewport
				? ('grid' as const)
				: ('list' as const)
			: ('grid' as const)
	);
	let listClass = $derived(
		cardVariant === 'grid'
			? 'catalog-grid grid min-w-0 gap-2.5 sm:gap-3'
			: 'catalog-exercise-list'
	);

	$effect(() => {
		if (!zoneLocked || !isCatalogZone(presetBodyPart)) return;
		if (filters.bodyPart === presetBodyPart) return;
		filters = { ...filters, bodyPart: presetBodyPart as ExerciseFilters['bodyPart'] };
	});

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

	/** Client navigations: URL facets win; missing facet params clear stale session values. */
	$effect(() => {
		const eq = initialEquipment;
		const tg = initialTarget;
		const q = initialQuery.trim();
		const zone = presetBodyPart;
		const urlDriven = eq !== '' || tg !== '' || Boolean(q);
		if (!urlDriven) return;

		untrack(() => {
			const patch: ExerciseFilters = {
				query: q,
				bodyPart:
					zone !== 'all' && isCatalogZone(zone)
						? (zone as ExerciseFilters['bodyPart'])
						: 'all',
				equipment: eq !== '' ? eq : 'all',
				target: tg !== '' ? tg : 'all'
			};

			const current = filters;
			const changed = (Object.keys(patch) as (keyof ExerciseFilters)[]).some(
				(key) => current[key] !== patch[key]
			);
			if (changed) filters = patch;
		});
	});

	$effect(() => {
		if (!indexReady || catalog.length === 0) return;
		const pool = filterExercises(
			catalog,
			{
				...filters,
				bodyPart:
					zoneLocked && isCatalogZone(presetBodyPart)
						? (presetBodyPart as ExerciseFilters['bodyPart'])
						: filters.bodyPart,
				equipment: 'all',
				target: 'all'
			},
			lang
		);
		const zoneItems =
			zoneLocked && zoneBodyParts.length > 1
				? pool.filter((item) => zoneBodyParts.includes(item.body_part))
				: pool;
		const validEquipment = new Set(zoneItems.map((item) => item.equipment));
		const validTargets = new Set(zoneItems.map((item) => item.target));
		const nextEq =
			filters.equipment !== 'all' && !validEquipment.has(filters.equipment)
				? 'all'
				: filters.equipment;
		const nextTarget =
			filters.target !== 'all' && !validTargets.has(filters.target) ? 'all' : filters.target;
		if (nextEq === filters.equipment && nextTarget === filters.target) return;
		untrack(() => {
			filters = { ...filters, equipment: nextEq, target: nextTarget };
		});
	});

	onMount(() => {
		let stopViewportSync: (() => void) | undefined;
		if (gridOnDesktop && typeof window !== 'undefined') {
			const mq = window.matchMedia('(min-width: 768px)');
			const sync = () => {
				wideViewport = mq.matches;
			};
			sync();
			mq.addEventListener('change', sync);
			stopViewportSync = () => mq.removeEventListener('change', sync);
		}
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
		void records.refresh();
		return () => stopViewportSync?.();
	});

	function loadMore() {
		if (!indexReady || visibleLimit >= visible.length) return;
		visibleLimit = Math.min(visible.length, visibleLimit + CATALOG_PAGE_SIZE);
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
		<FilterBar bind:filters {bodyParts} equipment={equipmentOptions} targets={targetOptions} lockBodyPart={zoneLocked} {hideTargetFilter} />
	</div>

	<div class="catalog-list-layout__main">
{#if indexError}
	<EmptyState
		title={translate(lang, 'catalog.dataMissing')}
		description={indexError ? translate(lang, indexError) : ''}
	/>
{:else if !indexReady || (savedOnly && !bookmarksLoaded)}
	<CatalogExerciseListSkeleton label={translate(lang, 'catalog.loading')} />
{:else}
	<p class="catalog-list-count mb-3 text-sm text-[var(--color-muted)]" aria-live="polite">
		{translate(lang, 'catalog.countShown', {
			shown: shown.length,
			n: filtersActive || indexReady ? visible.length : totalForCount
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
					{#if filters.bodyPart !== 'all' && !zoneLocked}
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
							filters = {
								...filters,
								bodyPart: zoneLocked ? filters.bodyPart : 'all',
								equipment: 'all',
								target: 'all'
							};
						}}
					>
						{translate(lang, 'catalog.reset')}
					</button>
				</div>
			</div>
		{:else}
			<EmptyState
				class="catalog-empty-state"
				title={translate(lang, savedOnly ? 'bookmarks.emptyTitle' : 'catalog.emptyTitle')}
				description={translate(lang, savedOnly ? 'bookmarks.emptyDesc' : 'catalog.emptyDesc')}
				actionHref={savedOnly ? '/exercises' : undefined}
				actionLabel={savedOnly ? translate(lang, 'bookmarks.browse') : undefined}
			/>
		{/if}
	{:else}
		<div class={listClass}>
			{#each shown as exercise, i (exercise.id)}
				<ExerciseCard
					{exercise}
					recordChips={recordChipsById.get(exercise.id) ?? []}
					priority={i < 4}
					variant={cardVariant}
					{returnAfterAdd}
					{detailFrom}
				/>
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
