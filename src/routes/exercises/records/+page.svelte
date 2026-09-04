<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import CloudSyncBanner from '$lib/components/CloudSyncBanner.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import RecordsListSkeleton from '$lib/components/RecordsListSkeleton.svelte';
	import RecordsNoteChip from '$lib/components/RecordsNoteChip.svelte';
	import Coachmark from '$lib/components/onboarding/Coachmark.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import ScrollToTopFab from '$lib/components/ScrollToTopFab.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SwipeToDelete from '$lib/components/SwipeToDelete.svelte';
	import { hasLiftData, personalRecordChips } from '$lib/domain/records';
	import { filterCatalogWithFacets, normalizeSearchText } from '$lib/domain/filters';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate, translateError } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import type { ExerciseFilters, ExerciseIndexItem, PersonalRecord } from '$lib/domain/types';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { CATALOG_PAGE_SIZE, emptyCatalogFilters } from '$lib/stores/catalogUi';
	import { resolvedLocale } from '$lib/stores/locale';
	import { records, recordsSync } from '$lib/stores/records';
	import { isCloudListUncertain } from '$lib/domain/cloudSync';
	import { linkWithFrom } from '$lib/domain/navigation';
	import { onboarding } from '$lib/stores/onboarding';
	import { shouldShowCoachmark } from '$lib/domain/onboarding';
	import { toasts } from '$lib/stores/toasts';
	import { Trophy, Trash2 } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';

	const RECORDS_PATH = '/exercises/records';

	let { data } = $props();
	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let indexReady = $state(false);
	let busyId = $state<string | null>(null);
	let expandedNoteId = $state<string | null>(null);
	let filters = $state<ExerciseFilters>(emptyCatalogFilters());
	let visibleLimit = $state(CATALOG_PAGE_SIZE);
	let loadMoreSentinel = $state<HTMLElement | null>(null);
	let lang = $derived($resolvedLocale);
	let showRecordsEmptyCoachmark = $derived(shouldShowCoachmark($onboarding, 'records.empty'));
	let title = $derived(translate(lang, 'records.title'));
	let displayRecords = $derived($records.filter(hasLiftData));
	/**
	 * Empty → EmptyState. SSR cookie peek 0 → empty; unknown/>0 → skeleton.
	 * Cloud may still fill an empty local list while stale/loading.
	 */
	let showSkeleton = $derived(
		browser
			? displayRecords.length === 0 &&
					($recordsSync === 'stale' || $recordsSync === 'loading')
			: data.recordsCountPeek === null
				? true
				: data.recordsCountPeek > 0
	);
	let listUncertain = $derived(isCloudListUncertain($recordsSync));

	let recordMetas = $derived.by(() => {
		const out: ExerciseIndexItem[] = [];
		for (const record of displayRecords) {
			const meta = indexById.get(record.exerciseId);
			if (meta) out.push(meta);
		}
		return out;
	});

	let catalogFiltered = $derived(
		filterCatalogWithFacets(recordMetas, filters, lang)
	);
	let equipmentOptions = $derived(catalogFiltered.equipment);
	let targetOptions = $derived(catalogFiltered.targets);

	let filteredRecords = $derived.by(() => {
		const allowed = new Set(catalogFiltered.items.map((item) => item.id));
		const query = normalizeSearchText(filters.query);
		const out: PersonalRecord[] = [];
		for (const record of displayRecords) {
			const meta = indexById.get(record.exerciseId);
			if (meta) {
				if (!allowed.has(record.exerciseId)) {
					// Catalog search misses notes: keep rows whose note still matches.
					if (!query) continue;
					if (filters.equipment !== 'all' && meta.equipment !== filters.equipment) continue;
					if (filters.target !== 'all' && meta.target !== filters.target) continue;
					if (filters.bodyPart !== 'all' && meta.body_part !== filters.bodyPart) continue;
					if (!normalizeSearchText(record.note).includes(query)) continue;
				}
				out.push(record);
				continue;
			}
			if (filters.equipment !== 'all' || filters.target !== 'all' || filters.bodyPart !== 'all') {
				continue;
			}
			if (!query) {
				out.push(record);
				continue;
			}
			const idHit = normalizeSearchText(record.exerciseId).includes(query);
			const noteHit = normalizeSearchText(record.note).includes(query);
			if (idHit || noteHit) out.push(record);
		}
		return out;
	});

	let shownRecords = $derived(filteredRecords.slice(0, visibleLimit));
	let hasMore = $derived(indexReady && visibleLimit < filteredRecords.length);
	let filtersActive = $derived(
		Boolean(filters.query.trim()) ||
			filters.bodyPart !== 'all' ||
			filters.equipment !== 'all' ||
			filters.target !== 'all'
	);

	function exerciseHref(exerciseId: string): string {
		return linkWithFrom(`/exercise/${exerciseId}`, RECORDS_PATH);
	}

	function loadMore() {
		if (!hasMore) return;
		visibleLimit = Math.min(filteredRecords.length, visibleLimit + CATALOG_PAGE_SIZE);
	}

	function resetFilters() {
		filters = emptyCatalogFilters();
	}

	onMount(() => {
		void records.refresh();
		loadExerciseIndex()
			.then((items) => {
				indexById = new Map(items.map((item) => [item.id, item]));
			})
			.finally(() => {
				indexReady = true;
			});
	});

	$effect(() => {
		filters.query;
		filters.bodyPart;
		filters.equipment;
		filters.target;
		visibleLimit = CATALOG_PAGE_SIZE;
	});

	$effect(() => {
		if (!browser || !hasMore || !loadMoreSentinel) return;
		const el = loadMoreSentinel;
		visibleLimit;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) loadMore();
			},
			{ root: null, rootMargin: '320px 0px', threshold: 0 }
		);
		io.observe(el);
		const rect = el.getBoundingClientRect();
		if (rect.top <= window.innerHeight + 320) loadMore();
		return () => io.disconnect();
	});

	function formatDate(iso: string): string {
		try {
			return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
				day: 'numeric',
				month: 'short'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	async function onRemove(exerciseId: string) {
		if (busyId) return;
		const snapshot = get(records).find((r) => r.exerciseId === exerciseId);
		if (!snapshot) return;
		busyId = exerciseId;
		try {
			await records.remove(exerciseId);
			toasts.showUndo(
				translate(lang, 'records.deleted'),
				async () => {
					await records.save(snapshot);
				},
				'info'
			);
		} catch (err) {
			toasts.show(translateError(lang, err, 'records.deleteFail'), 'error');
		} finally {
			busyId = null;
		}
	}
</script>

<SeoHead title={title} noindex />

<section class="content-page content-page--catalog records-page">
	<ScreenHeader
		fixed
		{title}
		backHref="/exercises"
		backLabelVisible
		backLabel={translate(lang, 'catalog.hubTitle')}
	/>

	<CloudSyncBanner
		sync={$recordsSync}
		{lang}
		suppressed={showSkeleton}
		onRetry={() => void records.refresh({ force: true })}
	/>

	{#if showSkeleton}
		<div class="catalog-list-layout">
			<div class="catalog-list-layout__filters">
				<div class="catalog-filters-shell">
					<AppPanel class="catalog-filters">
						<AppSkeleton class="records-skeleton__search skeleton-shimmer" aria-hidden="true" />
						<AppSkeleton
							class="catalog-filter-skeleton__equipment skeleton-shimmer"
							aria-hidden="true"
						/>
					</AppPanel>
				</div>
			</div>
			<div class="catalog-list-layout__main">
				<RecordsListSkeleton includeSearch={false} label={translate(lang, 'common.loading')} />
			</div>
		</div>
	{:else if displayRecords.length === 0}
		<EmptyState
			centered
			icon={Trophy}
			title={translate(lang, 'records.emptyTitle')}
			description={translate(lang, 'records.emptyDesc')}
			actionHref="/exercises"
			actionLabel={translate(lang, 'bookmarks.browse')}
		>
			{#snippet actions()}
				{#if showRecordsEmptyCoachmark}
					<Coachmark
						message={translate(lang, 'onboarding.coachRecordsEmpty')}
						onDismiss={() => onboarding.dismissCoachmark('records.empty')}
					/>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<div class="catalog-list-layout">
			<div class="catalog-list-layout__filters">
				<FilterBar
					bind:filters
					equipment={equipmentOptions}
					targets={targetOptions}
				/>
			</div>
			<div class="catalog-list-layout__main">
				{#if filteredRecords.length === 0}
					<EmptyState
						centered
						title={translate(lang, 'catalog.emptyTitle')}
						description={translate(lang, 'catalog.emptyDesc')}
						actionLabel={translate(lang, 'catalog.reset')}
						actionOnclick={resetFilters}
					/>
				{:else}
					<p class="catalog-list-count mb-3 text-sm text-[var(--color-muted)]" aria-live="polite">
						{translate(lang, 'catalog.countShown', {
							shown: shownRecords.length,
							n: filtersActive ? filteredRecords.length : displayRecords.length
						})}
					</p>
					<ul class="records-list soft-enter" class:cloud-sync-list--uncertain={listUncertain}>
						{#each shownRecords as record (record.exerciseId)}
							{@const meta = indexById.get(record.exerciseId)}
							{@const recordTitle = meta
								? exerciseName(meta, lang)
								: translate(lang, 'records.fallback', { id: record.exerciseId })}
							{@const chips = personalRecordChips({ ...record, note: '' }, lang)}
							{@const liftChip = chips[0] ?? ''}
							{@const noteChip = record.note.trim()}
							{@const noteOpen = expandedNoteId === record.exerciseId}
							<li>
								<SwipeToDelete
									label={translate(lang, 'records.delete')}
									disabled={busyId !== null}
									busy={busyId === record.exerciseId}
									onDelete={() => void onRemove(record.exerciseId)}
								>
									<div class="records-list-card">
										<div
											class="records-list-body"
											class:records-list-body--note={Boolean(noteChip)}
										>
											<a
												class="records-list-thumb"
												href={exerciseHref(record.exerciseId)}
												tabindex="-1"
												aria-hidden="true"
											>
												{#if meta}
													<span class="media-well records-preview__thumb">
														<img src={`/${meta.image}`} alt="" width="120" height="120" />
													</span>
												{:else}
													<span
														class="media-well records-preview__thumb records-preview__thumb--empty animate-pulse"
														aria-hidden="true"
													></span>
												{/if}
											</a>
											<div class="records-list-content">
												<a class="records-list-text" href={exerciseHref(record.exerciseId)}>
													<span class="records-preview__name">{recordTitle}</span>
													<span class="records-list-meta">
														{#if liftChip}
															<span class="records-preview__chips">
																<span class="records-preview__chip">{liftChip}</span>
															</span>
														{/if}
														<span class="records-list-date">{formatDate(record.updatedAt)}</span>
													</span>
												</a>
												{#if noteChip}
													<RecordsNoteChip
														text={noteChip}
														{lang}
														open={noteOpen}
														onToggle={() => {
															expandedNoteId = noteOpen ? null : record.exerciseId;
														}}
													/>
												{/if}
											</div>
										</div>
										<AppButton
											variant="danger"
											class="records-list-delete"
											aria-label={translate(lang, 'records.delete')}
											title={translate(lang, 'records.delete')}
											disabled={busyId !== null}
											aria-busy={busyId === record.exerciseId}
											onclick={() => void onRemove(record.exerciseId)}
										>
											{#if busyId === record.exerciseId}
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
				{/if}
			</div>
		</div>
	{/if}

	<ScrollToTopFab />
</section>
