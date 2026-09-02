<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';
	import CloudSyncBanner from '$lib/components/CloudSyncBanner.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import RecordsListSkeleton from '$lib/components/RecordsListSkeleton.svelte';
	import RecordsNoteChip from '$lib/components/RecordsNoteChip.svelte';
	import Coachmark from '$lib/components/onboarding/Coachmark.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SwipeToDelete from '$lib/components/SwipeToDelete.svelte';
	import { hasLiftData, personalRecordChips } from '$lib/domain/records';
	import { normalizeSearchText } from '$lib/domain/filters';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate, translateError } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { records, recordsReady, recordsSync } from '$lib/stores/records';
	import { isCloudListUncertain } from '$lib/domain/cloudSync';
	import { linkWithFrom } from '$lib/domain/navigation';
	import { onboarding } from '$lib/stores/onboarding';
	import { shouldShowCoachmark } from '$lib/domain/onboarding';
	import { toasts } from '$lib/stores/toasts';
	import { ArrowLeft, Trophy, Trash2 } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	const RECORDS_PATH = '/exercises/records';

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let indexReady = $state(false);
	let busyId = $state<string | null>(null);
	let expandedNoteId = $state<string | null>(null);
	let searchQuery = $state('');
	let lang = $derived($resolvedLocale);
	let showRecordsEmptyCoachmark = $derived(shouldShowCoachmark($onboarding, 'records.empty'));
	let title = $derived(translate(lang, 'records.title'));
	/** Avoid empty-state flash while cloud merge is still in flight (local may be []). */
	let showSkeleton = $derived(
		!$recordsReady ||
			$recordsSync === 'loading' ||
			$recordsSync === 'idle' ||
			($recordsSync === 'stale' && $records.length === 0)
	);
	let listUncertain = $derived(isCloudListUncertain($recordsSync));
	let displayRecords = $derived($records.filter(hasLiftData));
	let filteredRecords = $derived.by(() => {
		const query = normalizeSearchText(searchQuery);
		if (!query) return displayRecords;
		return displayRecords.filter((record) => {
			const meta = indexById.get(record.exerciseId);
			const title = meta
				? normalizeSearchText(exerciseName(meta, lang))
				: normalizeSearchText(record.exerciseId);
			const note = normalizeSearchText(record.note);
			return title.includes(query) || note.includes(query);
		});
	});

	function exerciseHref(exerciseId: string): string {
		return linkWithFrom(`/exercise/${exerciseId}`, RECORDS_PATH);
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

	async function onRemove(exerciseId: string, name: string) {
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
	<ScreenHeader class="lg:hidden" {title} backHref="/exercises" />

	<div class="catalog-subroute-header">
		<a class="catalog-zone-crumb-link" href="/exercises">
			<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
			{translate(lang, 'catalog.hubTitle')}
		</a>
		<div class="page-header page-header--compact catalog-zone-head">
			<h1 class="page-title catalog-zone-title">{title}</h1>
			<p class="page-lead">
				{#if !$auth.ready}
					<span
						class="inline-block h-4 w-48 max-w-full animate-pulse rounded bg-[var(--color-surface-muted)]"
						aria-hidden="true"
					></span>
				{:else if $auth.user}
					{#if $recordsSync === 'error'}
						{translate(lang, 'records.local')}
					{:else}
						{translate(lang, 'records.cloud')}
					{/if}
				{:else}
					{translate(lang, 'records.local')}
					{' '}
					<a
						class="font-semibold text-[var(--color-accent-text)] underline"
						href="/auth?next=%2Fexercises%2Frecords"
						>{translate(lang, 'records.signIn')}</a
					>{translate(lang, 'records.syncSuffix')}
				{/if}
			</p>
		</div>
	</div>

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
					<AppPanel class="catalog-filters catalog-filters--saved">
						<AppSkeleton class="records-skeleton__search skeleton-shimmer" aria-hidden="true" />
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
			<div class="catalog-list-layout__filters records-page__search">
				<div class="catalog-filters-shell">
					<AppPanel class="catalog-filters catalog-filters--saved">
						<SearchInput
							bind:value={searchQuery}
							debounceMs={150}
							placeholder={translate(lang, 'catalog.search')}
						/>
					</AppPanel>
				</div>
			</div>
			<div class="catalog-list-layout__main">
				{#if filteredRecords.length === 0}
					<EmptyState
						centered
						title={translate(lang, 'catalog.emptyTitle')}
						description={translate(lang, 'catalog.emptyDesc')}
						actionLabel={translate(lang, 'catalog.reset')}
						actionOnclick={() => {
							searchQuery = '';
						}}
					/>
				{:else}
					<p class="catalog-list-count mb-3 text-sm text-[var(--color-muted)]" aria-live="polite">
						{translate(lang, 'catalog.countShown', {
							shown: filteredRecords.length,
							n: displayRecords.length
						})}
					</p>
					<ul class="records-list soft-enter" class:cloud-sync-list--uncertain={listUncertain}>
						{#each filteredRecords as record (record.exerciseId)}
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
									onDelete={() => void onRemove(record.exerciseId, recordTitle)}
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
											onclick={() => void onRemove(record.exerciseId, recordTitle)}
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
				{/if}
			</div>
		</div>
	{/if}
</section>
