<script lang="ts">
	import CloudSyncBanner from '$lib/components/CloudSyncBanner.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import RecordsListSkeleton from '$lib/components/RecordsListSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SwipeToDelete from '$lib/components/SwipeToDelete.svelte';
	import { personalRecordChips } from '$lib/domain/records';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate, translateError } from '$lib/i18n/messages';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { records, recordsReady, recordsSync } from '$lib/stores/records';
	import { isCloudListUncertain } from '$lib/domain/cloudSync';
	import { toasts } from '$lib/stores/toasts';
	import { ArrowLeft, ChevronDown, Trophy, Trash2 } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let indexReady = $state(false);
	let busyId = $state<string | null>(null);
	let expandedNoteId = $state<string | null>(null);
	let lang = $derived($resolvedLocale);
	let title = $derived(translate(lang, 'records.title'));
	/** Avoid empty-state flash while cloud merge is still in flight (local may be []). */
	let showSkeleton = $derived(
		!$recordsReady ||
			$recordsSync === 'loading' ||
			$recordsSync === 'idle' ||
			($recordsSync === 'stale' && $records.length === 0) ||
			($records.length > 0 && !indexReady)
	);
	let listUncertain = $derived(isCloudListUncertain($recordsSync));

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
		if (!confirm(translate(lang, 'records.confirmDelete', { name }))) return;
		busyId = exerciseId;
		try {
			await records.remove(exerciseId);
			toasts.show(translate(lang, 'records.deleted'), 'info');
		} catch (err) {
			toasts.show(translateError(lang, err, 'records.deleteFail'), 'error');
		} finally {
			busyId = null;
		}
	}
</script>

<svelte:head>
	<title>{title} · Repdraft</title>
</svelte:head>

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
					<a class="font-semibold text-[var(--color-accent)] underline" href="/auth?next=%2Frecords"
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
		<RecordsListSkeleton rows={4} label={translate(lang, 'common.loading')} />
	{:else if $records.length === 0}
		<EmptyState
			centered
			icon={Trophy}
			title={translate(lang, 'records.emptyTitle')}
			description={translate(lang, 'records.emptyDesc')}
		/>
	{:else}
		<ul class="records-list soft-enter" class:cloud-sync-list--uncertain={listUncertain}>
			{#each $records as record (record.exerciseId)}
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
							<div class="records-list-body">
								<a class="records-list-main" href={`/exercise/${record.exerciseId}`}>
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
									<span class="records-preview__text">
										<span class="records-preview__name">{recordTitle}</span>
										<span class="records-list-meta">
											{#if liftChip}
												<span class="records-preview__chips">
													<span class="records-preview__chip">{liftChip}</span>
												</span>
											{/if}
											<span class="records-list-date">{formatDate(record.updatedAt)}</span>
										</span>
									</span>
								</a>
								{#if noteChip}
									<button
										type="button"
										class="records-note-chip"
										class:is-open={noteOpen}
										aria-expanded={noteOpen}
										title={translate(lang, noteOpen ? 'pr.nowCollapse' : 'pr.nowExpand')}
										onclick={() => {
											expandedNoteId = noteOpen ? null : record.exerciseId;
										}}
									>
										<span class="records-note-chip__text">{noteChip}</span>
										<span class="records-note-chip__chevron" aria-hidden="true">
											<LucideIcon icon={ChevronDown} size={ICON_SMALL} />
										</span>
									</button>
								{/if}
							</div>
							<button
								type="button"
								class="btn-ghost is-danger records-list-delete"
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
							</button>
						</div>
					</SwipeToDelete>
				</li>
			{/each}
		</ul>
	{/if}
</section>
