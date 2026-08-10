<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { formatPersonalRecord } from '$lib/domain/records';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate, translateError } from '$lib/i18n/messages';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { records, recordsReady } from '$lib/stores/records';
	import { toasts } from '$lib/stores/toasts';
	import { Trash2 } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let indexReady = $state(false);
	let lang = $derived($resolvedLocale);
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
		if (!confirm(translate(lang, 'records.confirmDelete', { name }))) return;
		try {
			await records.remove(exerciseId);
			toasts.show(translate(lang, 'records.deleted'), 'info');
		} catch (err) {
			toasts.show(translateError(lang, err, 'records.deleteFail'), 'error');
		}
	}
</script>

<svelte:head>
	<title>{translate(lang, 'records.title')} — Repdraft</title>
</svelte:head>

<section class="content-page content-page--narrow">
	<div class="page-header">
		<h1 class="page-title">{translate(lang, 'records.title')}</h1>
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
				{@const title = meta
					? exerciseName(meta, lang)
					: translate(lang, 'records.fallback', { id: record.exerciseId })}
				<li class="list-row !gap-3 !py-3">
					<a
						class="flex min-w-0 flex-1 items-center gap-3 no-underline"
						href={`/exercise/${record.exerciseId}`}
					>
						{#if meta}
							<img
								src={`/${meta.image}`}
								alt=""
								width="48"
								height="48"
								class="h-12 w-12 shrink-0 rounded-lg bg-[var(--color-surface-muted)] object-contain"
							/>
						{:else}
							<div
								class="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-[var(--color-surface-muted)]"
								aria-hidden="true"
							></div>
						{/if}
						<div class="min-w-0">
							<p class="truncate font-semibold text-[var(--color-ink)]">{title}</p>
							<p class="truncate text-sm font-semibold text-[var(--color-accent)]" title={formatPersonalRecord(record, lang)}>
								{formatPersonalRecord(record, lang)}
							</p>
							<p class="text-xs text-[var(--color-muted)]">{formatDate(record.updatedAt)}</p>
						</div>
					</a>
					<button
						type="button"
						class="btn-ghost is-danger shrink-0"
						aria-label={translate(lang, 'records.delete')}
						title={translate(lang, 'records.delete')}
						onclick={() => void onRemove(record.exerciseId, title)}
					>
						<LucideIcon icon={Trash2} size={ICON_SMALL} />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>
