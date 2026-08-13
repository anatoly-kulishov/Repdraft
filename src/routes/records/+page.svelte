<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SwipeToDelete from '$lib/components/SwipeToDelete.svelte';
	import { formatPersonalRecord, personalRecordChips } from '$lib/domain/records';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate, translateError } from '$lib/i18n/messages';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { records, recordsReady } from '$lib/stores/records';
	import { toasts } from '$lib/stores/toasts';
	import { ArrowLeft, Trash2 } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let indexReady = $state(false);
	let busyId = $state<string | null>(null);
	let lang = $derived($resolvedLocale);
	let title = $derived(translate(lang, 'records.title'));
	let pageReady = $derived($recordsReady && ($records.length === 0 || indexReady));

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
	<title>{title} — Repdraft</title>
</svelte:head>

<section class="content-page content-page--narrow records-page">
	<ScreenHeader class="md:hidden" {title} backHref="/exercises" />

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
					{translate(lang, 'records.cloud')}
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

	{#if !pageReady}
		<PageSkeleton rows={4} />
	{:else if $records.length === 0}
		<EmptyState
			title={translate(lang, 'records.emptyTitle')}
			description={translate(lang, 'records.emptyDesc')}
		/>
	{:else}
		<ul class="soft-enter flex flex-col gap-2.5">
			{#each $records as record (record.exerciseId)}
				{@const meta = indexById.get(record.exerciseId)}
				{@const recordTitle = meta
					? exerciseName(meta, lang)
					: translate(lang, 'records.fallback', { id: record.exerciseId })}
				{@const full = formatPersonalRecord(record, lang)}
				{@const chips = personalRecordChips(record, lang)}
				<li>
					<SwipeToDelete
						label={translate(lang, 'records.delete')}
						disabled={busyId !== null}
						busy={busyId === record.exerciseId}
						onDelete={() => void onRemove(record.exerciseId, recordTitle)}
					>
						<div class="list-row !flex-row !items-start !gap-3 !py-3">
							<a
								class="flex min-w-0 flex-1 items-start gap-3 no-underline"
								href={`/exercise/${record.exerciseId}`}
							>
								{#if meta}
									<img
										src={`/${meta.image}`}
										alt=""
										width="120"
										height="120"
										class="records-preview__thumb shrink-0"
									/>
								{:else}
									<div
										class="records-preview__thumb records-preview__thumb--empty shrink-0 animate-pulse"
										aria-hidden="true"
									></div>
								{/if}
								<div class="min-w-0">
									<p class="truncate font-semibold text-[var(--color-ink)]">{recordTitle}</p>
									{#if chips.length > 0}
										<div class="records-preview__chips mt-0.5" title={full}>
											{#each chips as chip, i (i)}
												<span class="records-preview__chip">{chip}</span>
											{/each}
										</div>
									{/if}
									<p class="mt-0.5 text-xs text-[var(--color-muted)]">{formatDate(record.updatedAt)}</p>
								</div>
							</a>
							<button
								type="button"
								class="btn-ghost is-danger shrink-0"
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
