<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { formatPersonalRecord } from '$lib/domain/records';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate } from '$lib/i18n/messages';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { records } from '$lib/stores/records';
	import { toasts } from '$lib/stores/toasts';
	import { onMount } from 'svelte';

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let lang = $derived($resolvedLocale);

	onMount(() => {
		void records.refresh();
		loadExerciseIndex().then((items) => {
			indexById = new Map(items.map((item) => [item.id, item]));
		});
	});

	function formatDate(iso: string): string {
		try {
			return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
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
			toasts.show(err instanceof Error ? err.message : 'Error', 'error');
		}
	}
</script>

<svelte:head>
	<title>{translate(lang, 'records.title')} — Repdraft</title>
</svelte:head>

<section>
	<div class="page-header">
		<h1 class="page-title">{translate(lang, 'records.title')}</h1>
		<p class="page-lead">
			{#if $auth.user}
				{translate(lang, 'records.cloud')}
			{:else}
				{translate(lang, 'records.local')}
				<a class="text-[var(--color-accent)] underline" href="/auth">{translate(lang, 'records.signIn')}</a
				>{translate(lang, 'records.syncSuffix')}
			{/if}
		</p>
	</div>

	{#if $records.length === 0}
		<EmptyState
			title={translate(lang, 'records.emptyTitle')}
			description={translate(lang, 'records.emptyDesc')}
			actionHref="/"
			actionLabel={translate(lang, 'builder.toCatalog')}
		/>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each $records as record (record.exerciseId)}
				{@const meta = indexById.get(record.exerciseId)}
				<li class="list-row">
					<div class="flex min-w-0 items-center gap-3">
						{#if meta}
							<img
								src={`/${meta.image}`}
								alt=""
								width="56"
								height="56"
								class="h-14 w-14 shrink-0 rounded-lg bg-[var(--color-surface-muted)] object-contain"
							/>
						{/if}
						<div class="min-w-0">
							<a
								class="font-semibold hover:text-[var(--color-accent)]"
								href={`/exercise/${record.exerciseId}`}
							>
								{meta
									? exerciseName(meta, lang)
									: translate(lang, 'records.fallback', { id: record.exerciseId })}
							</a>
							<p class="text-sm font-semibold text-[var(--color-accent)]">
								{formatPersonalRecord(record, lang)}
							</p>
							<p class="text-xs text-[var(--color-muted)]">{formatDate(record.updatedAt)}</p>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
						<a class="btn-secondary" href={`/exercise/${record.exerciseId}`}
							>{translate(lang, 'records.edit')}</a
						>
						<button
							type="button"
							class="btn-danger"
							onclick={() =>
								void onRemove(
									record.exerciseId,
									meta ? exerciseName(meta, lang) : record.exerciseId
								)}
						>
							{translate(lang, 'records.delete')}
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
