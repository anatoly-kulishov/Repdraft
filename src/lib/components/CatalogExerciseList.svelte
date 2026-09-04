<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';
	import CatalogExerciseListSkeleton from '$lib/components/CatalogExerciseListSkeleton.svelte';
	import RecordsListSkeleton from '$lib/components/RecordsListSkeleton.svelte';
	import ExerciseCard from '$lib/components/ExerciseCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import Coachmark from '$lib/components/onboarding/Coachmark.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SwipeToDelete from '$lib/components/SwipeToDelete.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { filterCatalogWithFacets, isBodyPart, isFilterConflict } from '$lib/domain/filters';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { pickFrequent, pickPopular, sortByScore } from '$lib/domain/exerciseScore';
	import { catalogZoneBodyParts, isCatalogZone } from '$lib/domain/catalogLinks';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import { currentReturnPath, linkWithFrom } from '$lib/domain/navigation';
	import { shouldShowCoachmark } from '$lib/domain/onboarding';
	import { blurActiveElement } from '$lib/dom/blurActiveElement';
	import { urlSearchParams } from '$lib/navigation/urlSearchParams';
	import type { ExerciseFilters, ExerciseIndexItem } from '$lib/domain/types';
	import { loadExerciseIndex, peekExerciseIndex } from '$lib/data/loadExercises';
	import { translate } from '$lib/i18n/messages';
	import { CATALOG_PAGE_SIZE } from '$lib/stores/catalogUi';
	import { bookmarks } from '$lib/stores/bookmarks';
	import { exerciseStats } from '$lib/stores/exerciseStats';
	import { onboarding } from '$lib/stores/onboarding';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, untrack } from 'svelte';
	import { Bookmark, Trash2 } from '@lucide/svelte';

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
		savedOnly = false,
		/** SSR cookie peek: 0 = known empty, >0 = expect list, null = unknown. */
		bookmarksCountPeek = null as number | null
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
		bookmarksCountPeek?: number | null;
	} = $props();

	function filtersFromSearchParams(searchParams: URLSearchParams): ExerciseFilters {
		const q = searchParams.get('q') ?? '';
		const equipmentParam = searchParams.get('equipment') ?? '';
		const targetParam = searchParams.get('target') ?? '';
		const bodyPartParam = searchParams.get('bodyPart') ?? '';
		const urlHasQuery = Boolean(q.trim());
		const urlHasEquipment = equipmentParam !== '';
		const urlHasTarget = targetParam !== '';
		const urlBody =
			bodyPartParam && isBodyPart(bodyPartParam) ? bodyPartParam : ('all' as const);

		if (presetBodyPart !== 'all' && isCatalogZone(presetBodyPart)) {
			return {
				query: urlHasQuery ? q : '',
				bodyPart: presetBodyPart as ExerciseFilters['bodyPart'],
				equipment: urlHasEquipment ? equipmentParam : 'all',
				target: urlHasTarget ? targetParam : 'all'
			};
		}

		return {
			query: urlHasQuery ? q : '',
			bodyPart: urlBody,
			equipment: urlHasEquipment ? equipmentParam : 'all',
			target: urlHasTarget ? targetParam : 'all'
		};
	}

	/**
	 * Facet source of truth on the client is `window.location`, not `$page.url`.
	 * App `replaceState` for equipment left `history.state["sveltekit:pageurl"]` without the query;
	 * after history.back() the address bar kept `?equipment=` while `$page.url` did not.
	 */
	function liveCatalogUrl(): URL {
		return new URL(window.location.href);
	}

	function filtersFromUrl(): ExerciseFilters {
		if (browser) {
			return filtersFromSearchParams(new URLSearchParams(window.location.search));
		}
		return filtersFromSearchParams(
			new URLSearchParams({
				...(initialQuery.trim() ? { q: initialQuery } : {}),
				...(initialEquipment ? { equipment: initialEquipment } : {}),
				...(initialTarget ? { target: initialTarget } : {}),
				...(initialBodyPart ? { bodyPart: initialBodyPart } : {})
			})
		);
	}

	const peekedCatalogIndex = peekExerciseIndex();
	let items = $state<ExerciseIndexItem[]>(peekedCatalogIndex ?? []);
	let indexReady = $state(peekedCatalogIndex != null);
	let visibleLimit = $state(CATALOG_PAGE_SIZE);
	let filters = $state<ExerciseFilters>(filtersFromUrl());
	let filtersHydrated = $state(false);
	/** Skip URL→filters when `$page` notifies but search/path/preset did not change (sheet history). */
	let lastHydratedSearchKey = '';
	/** True while applying URL → local filters (skip local → URL echo). Must be $state so write re-runs. */
	let syncingFiltersToUrl = $state(false);

	let zoneLocked = $derived(presetBodyPart !== 'all' && isCatalogZone(presetBodyPart));
	let zoneBodyParts = $derived(
		zoneLocked ? catalogZoneBodyParts(presetBodyPart) : []
	);
	let filterLockBodyPart = $derived(zoneLocked);
	/** Opened via ?target=… (title is that muscle): sibling chips feel like leaving the category. */
	let hideTargetChips = $derived(Boolean(initialTarget.trim()));

	let lang = $derived($resolvedLocale);
	/**
	 * Return path for exercise links — built from live filters, not deferred URL.
	 * Otherwise a fast tap after «Снаряд» stores `from=/catalog/all` without `equipment=`.
	 */
	let detailFrom = $derived.by(() => {
		const params = new URLSearchParams();
		const q = filters.query.trim();
		if (q) params.set('q', q);
		if (filters.equipment !== 'all') params.set('equipment', filters.equipment);
		if (filters.target !== 'all') params.set('target', filters.target);
		if (!zoneLocked && !savedOnly && filters.bodyPart !== 'all') {
			params.set('bodyPart', filters.bodyPart);
		}
		const chainFrom = $page.url.searchParams.get('from');
		if (chainFrom) params.set('from', chainFrom);
		return currentReturnPath($page.url.pathname, params);
	});
	let catalog = $derived(indexReady ? items : []);
	let statsMap = $derived($exerciseStats);
	let bookmarkSet = $derived(new Set($bookmarks));
	let catalogFiltered = $derived.by(() => {
		const allowed = zoneLocked && zoneBodyParts.length > 0 ? new Set(zoneBodyParts) : null;
		let scopedCatalog = allowed
			? catalog.filter((item) => allowed.has(item.body_part))
			: catalog;
		if (savedOnly) {
			scopedCatalog = scopedCatalog.filter((ex) => bookmarkSet.has(ex.id));
		}
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
	let visible = $derived(filtered);
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
	let likelySections = $derived(!savedOnly && !filters.query.trim());
	let filtersActive = $derived(
		Boolean(filters.query.trim()) ||
			filters.bodyPart !== 'all' ||
			filters.equipment !== 'all' ||
			filters.target !== 'all'
	);
	let filterConflict = $derived(
		visible.length === 0 ? isFilterConflict(catalog, filters, lang) : false
	);
	/**
	 * Saved never uses catalog totalCount as the denominator — that caused «0 из 1324»
	 * when empty bookmarks skip the skeleton before the index loads.
	 */
	let totalForCount = $derived(
		savedOnly
			? indexReady
				? visible.length
				: $bookmarks.length
			: indexReady
				? visible.length
				: totalCount
	);
	let hasMore = $derived(
		indexReady && visibleLimit < (useSections ? allSectionItems.length : visible.length)
	);
	/**
	 * Saved empty → EmptyState (not card skeletons).
	 * SSR: cookie peek 0 → empty; peek >0 / unknown → skeleton. Client: skeleton while bookmarks await index.
	 */
	let showListSkeleton = $derived(
		savedOnly
			? browser
				? $bookmarks.length > 0 && !indexReady
				: bookmarksCountPeek === null
					? true
					: bookmarksCountPeek > 0
			: !indexReady
	);
	let countN = $derived(
		savedOnly
			? indexReady
				? visible.length
				: $bookmarks.length
			: filtersActive || indexReady
				? visible.length
				: totalForCount
	);
	let cardVariant = $derived(
		savedOnly
			? ('list' as const)
			: !listOnMobile || gridOnDesktop
				? ('grid' as const)
				: ('list' as const)
	);
	let listClass = $derived(
		cardVariant === 'grid'
			? 'catalog-grid grid min-w-0 gap-2.5 sm:gap-3'
			: 'catalog-exercise-list'
	);
	let emptyStateClass = $derived(
		`catalog-empty-state${savedOnly ? ' catalog-empty-state--saved' : ''}`
	);
	/** No bookmarks at all: full EmptyState like Records (no search / count chrome). */
	let savedTrulyEmpty = $derived(
		savedOnly && !showListSkeleton && !indexError && $bookmarks.length === 0
	);
	let showBookmarksEmptyCoachmark = $derived(
		savedTrulyEmpty && shouldShowCoachmark($onboarding, 'bookmarks.empty')
	);

	function dismissBookmarksEmptyCoachmark() {
		onboarding.dismissCoachmark('bookmarks.empty');
		blurActiveElement();
	}

	function resetCatalogFilters() {
		filters = {
			...filters,
			query: '',
			bodyPart: zoneLocked ? filters.bodyPart : 'all',
			equipment: 'all',
			target: 'all'
		};
	}

	$effect(() => {
		if (!zoneLocked || !isCatalogZone(presetBodyPart)) return;
		if (filters.bodyPart === presetBodyPart) return;
		filters = { ...filters, bodyPart: presetBodyPart as ExerciseFilters['bodyPart'] };
	});

	/** Apply facets from the live URL when navigation changes — not when local filters edit. */
	$effect(() => {
		// Subscribe to SK navigation, but read facets from window.location (see liveCatalogUrl).
		$page.url.pathname;
		$page.url.search;
		const live = browser ? liveCatalogUrl() : $page.url;
		const params = urlSearchParams(live);
		const searchKey = `${live.pathname}\0${params.toString()}\0${presetBodyPart}`;
		const next = filtersFromSearchParams(params);
		const localEq = untrack(() => filters.equipment);
		// Local selection is ahead of URL write: empty URL must not wipe it.
		if (next.equipment === 'all' && localEq !== 'all' && !params.get('equipment')) return;

		// Same search can re-notify (sheet history). Still repair when local drifted
		// behind the URL (stale-facet clear + skipped replaceState left ?equipment= orphaned).
		if (searchKey === lastHydratedSearchKey) {
			const drifted = untrack(() =>
				(Object.keys(next) as (keyof ExerciseFilters)[]).some((key) => filters[key] !== next[key])
			);
			if (!drifted) return;
			// Only pull from URL when it still carries a facet local lost — not local-ahead.
			if (
				next.equipment === 'all' &&
				next.target === 'all' &&
				!next.query.trim() &&
				(next.bodyPart === 'all' || zoneLocked)
			) {
				return;
			}
		} else {
			lastHydratedSearchKey = searchKey;
		}

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
		if (!browser || !filtersHydrated) return;
		// Tracked $state: after hydrate microtask clears the flag, this effect re-runs
		// so a stale-facet reset to `all` can delete orphaned `?equipment=` from the URL.
		if (syncingFiltersToUrl) return;
		filters.query;
		filters.bodyPart;
		filters.equipment;
		filters.target;

		const url = liveCatalogUrl();
		const q = filters.query.trim();
		if (q) url.searchParams.set('q', q);
		else url.searchParams.delete('q');

		if (filters.equipment !== 'all') url.searchParams.set('equipment', filters.equipment);
		else url.searchParams.delete('equipment');

		if (filters.target !== 'all') url.searchParams.set('target', filters.target);
		else url.searchParams.delete('target');

		if (!zoneLocked && !savedOnly) {
			if (filters.bodyPart !== 'all') url.searchParams.set('bodyPart', filters.bodyPart);
			else url.searchParams.delete('bodyPart');
		} else {
			url.searchParams.delete('bodyPart');
		}

		// Keep non-facet params (browse, from, …).
		const next = `${url.pathname}${url.search}${url.hash}`;
		const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (next === cur) return;

		// goto(replaceState) updates SvelteKit's history pageurl; plain replaceState did not,
		// so history.back() restored a pageurl without ?equipment= while the bar still had it.
		lastHydratedSearchKey = `${url.pathname}\0${url.searchParams.toString()}\0${presetBodyPart}`;
		void goto(next, { replaceState: true, keepFocus: true, noScroll: true });
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
		if (!indexReady || catalog.length === 0) return;
		equipmentOptions;
		targetOptions;
		// Wait until facet pools exist — empty options on first paint must not wipe URL facets.
		if (equipmentOptions.length === 0 && filters.equipment !== 'all') return;
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
		void bookmarks.refresh();
		const peekedOnMount = peekExerciseIndex();
		if (peekedOnMount && !indexReady) {
			items = peekedOnMount;
			indexReady = true;
		}
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
			toasts.showUndo(
				translate(lang, 'bookmarks.removed'),
				() => void bookmarks.toggle(exerciseId),
				'info',
				undefined,
				'bookmark'
			);
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

{#if savedTrulyEmpty}
	<EmptyState
		class={emptyStateClass}
		centered
		icon={Bookmark}
		title={translate(lang, 'bookmarks.emptyTitle')}
		description={translate(lang, 'bookmarks.emptyDesc')}
		actionHref="/exercises"
		actionLabel={translate(lang, 'bookmarks.browse')}
	>
		{#snippet actions()}
			{#if showBookmarksEmptyCoachmark}
				<Coachmark
					message={translate(lang, 'onboarding.coachBookmarksEmpty')}
					onDismiss={dismissBookmarksEmptyCoachmark}
				/>
			{/if}
		{/snippet}
	</EmptyState>
{:else}
<div class="catalog-list-layout">
	<div class="catalog-list-layout__filters">
		{#if showListSkeleton}
			<div class="catalog-filters-shell">
				<AppPanel
					class="catalog-filters {filterLockBodyPart ? 'catalog-filters--zone' : ''}"
				>
					<AppSkeleton class="records-skeleton__search skeleton-shimmer" aria-hidden="true" />
					{#if filterLockBodyPart && !hideTargetChips && targetFacets.length > 1}
						<div class="catalog-filter-skeleton__chips" aria-hidden="true">
							<AppSkeleton class="catalog-filter-skeleton__chip skeleton-shimmer" aria-hidden="true" />
							<AppSkeleton class="catalog-filter-skeleton__chip skeleton-shimmer" aria-hidden="true" />
							<AppSkeleton class="catalog-filter-skeleton__chip skeleton-shimmer" aria-hidden="true" />
						</div>
					{/if}
					{#if equipmentFacets.length > 0 || savedOnly}
						<AppSkeleton
							class="catalog-filter-skeleton__equipment skeleton-shimmer"
							aria-hidden="true"
						/>
					{/if}
				</AppPanel>
			</div>
		{:else}
			<FilterBar
				bind:filters
				equipment={equipmentOptions}
				targets={targetOptions}
				lockBodyPart={filterLockBodyPart}
				{hideTargetChips}
			/>
		{/if}
	</div>

	<div class="catalog-list-layout__main">
{#if indexError}
	<EmptyState
		title={translate(lang, 'catalog.dataMissing')}
		description={indexError ? translate(lang, indexError) : ''}
	/>
{:else if showListSkeleton}
	{#if savedOnly}
		<RecordsListSkeleton variant="saved" includeSearch={false} label={translate(lang, 'catalog.loading')} />
	{:else}
		<CatalogExerciseListSkeleton
			label={translate(lang, 'catalog.loading')}
			variant={likelySections ? 'sections' : cardVariant}
			rows={CATALOG_PAGE_SIZE}
		/>
	{/if}
{:else}
	<p class="catalog-list-count mb-3 text-sm text-[var(--color-muted)]" aria-live="polite">
		{translate(lang, 'catalog.countShown', {
			shown: shownCount,
			n: countN
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
				icon={savedOnly && !filters.query.trim() ? Bookmark : null}
				title={translate(
					lang,
					savedOnly && !filters.query.trim() ? 'bookmarks.emptyTitle' : 'catalog.emptyTitle'
				)}
				description={translate(
					lang,
					savedOnly && !filters.query.trim() ? 'bookmarks.emptyDesc' : 'catalog.emptyDesc'
				)}
				actionHref={savedOnly && !filters.query.trim() ? '/exercises' : undefined}
				actionLabel={
					savedOnly && !filters.query.trim()
						? translate(lang, 'bookmarks.browse')
						: filtersActive
							? translate(lang, 'catalog.reset')
							: undefined
				}
				actionOnclick={
					savedOnly && !filters.query.trim()
						? undefined
						: filtersActive
							? resetCatalogFilters
							: undefined
				}
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
			{#if allSectionItems.length > 0}
				<section class="catalog-section" aria-labelledby="catalog-section-all">
					<h2 id="catalog-section-all" class="catalog-section__title">
						{translate(lang, 'catalog.sectionAll')}
					</h2>
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
				</section>
			{/if}
		</div>
		{#if hasMore}
			<div
				bind:this={loadMoreSentinel}
				class="catalog-list-load-more"
				aria-hidden="true"
			></div>
		{/if}
	{:else if savedOnly}
		<ul class="records-list">
			{#each shownFlat as exercise, i (exercise.id)}
				{@const title = exerciseName(exercise, lang)}
				{@const href = linkWithFrom(`/exercise/${exercise.id}`, detailFrom)}
				<li>
					<SwipeToDelete
						label={translate(lang, 'bookmarks.remove')}
						busy={unbookmarkBusyId === exercise.id}
						disabled={unbookmarkBusyId !== null && unbookmarkBusyId !== exercise.id}
						onDelete={() => void unbookmark(exercise.id)}
					>
						<div class="records-list-card">
							<div class="records-list-body">
								<a
									class="records-list-thumb"
									{href}
									tabindex="-1"
									aria-hidden="true"
								>
									<span class="media-well records-preview__thumb">
										<img
											src={`/${exercise.image}`}
											alt=""
											width="120"
											height="120"
											loading={i < 6 ? 'eager' : 'lazy'}
											decoding="async"
										/>
									</span>
								</a>
								<div class="records-list-content">
									<a class="records-list-text" {href}>
										<span class="records-preview__name">{title}</span>
										<span class="records-list-meta">
											<span class="catalog-saved-row__meta">
												{labelTarget(exercise.target, lang)} · {labelEquipment(
													exercise.equipment,
													lang
												)}
											</span>
										</span>
									</a>
								</div>
							</div>
							<AppButton
								variant="danger"
								class="records-list-delete"
								disabled={unbookmarkBusyId !== null}
								aria-busy={unbookmarkBusyId === exercise.id}
								aria-label={translate(lang, 'bookmarks.remove')}
								title={translate(lang, 'bookmarks.remove')}
								onclick={() => void unbookmark(exercise.id)}
							>
								{#if unbookmarkBusyId === exercise.id}
									<Spinner size="sm" block={false} />
								{:else}
									<LucideIcon icon={Trash2} size={ICON_SMALL} />
								{/if}
							</AppButton>
						</div>
					</SwipeToDelete>
				</li>
			{/each}
		</ul>
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
				<ExerciseCard {exercise} priority={i < 4} variant={cardVariant} {detailFrom} />
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
{/if}
