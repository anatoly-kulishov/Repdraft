<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { formatPersonalRecord } from '$lib/domain/records';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { records } from '$lib/stores/records';
	import { toasts } from '$lib/stores/toasts';
	import { onMount } from 'svelte';

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());

	onMount(() => {
		void records.refresh();
		loadExerciseIndex().then((items) => {
			indexById = new Map(items.map((item) => [item.id, item]));
		});
	});

	function formatDate(iso: string): string {
		try {
			return new Intl.DateTimeFormat('ru-RU', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	async function onRemove(exerciseId: string, name: string) {
		if (!confirm(`Удалить рекорд для «${name}»?`)) return;
		try {
			await records.remove(exerciseId);
			toasts.show('Рекорд удалён', 'info');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : 'Ошибка', 'error');
		}
	}
</script>

<svelte:head>
	<title>Рекорды — Repdraft</title>
</svelte:head>

<section>
	<div class="mb-4">
		<h1 class="font-[family-name:var(--font-display)] text-2xl md:text-3xl">Личные рекорды</h1>
		<p class="mt-1 text-sm text-[var(--color-muted)]">
			Опционально: отмечайте лучшие результаты по упражнениям. Хранятся только на этом устройстве.
		</p>
	</div>

	{#if $records.length === 0}
		<EmptyState
			title="Пока нет рекордов"
			description="Откройте упражнение в каталоге и заполните блок «Личный рекорд»."
			actionHref="/"
			actionLabel="К каталогу"
		/>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each $records as record (record.exerciseId)}
				{@const meta = indexById.get(record.exerciseId)}
				<li
					class="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
				>
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
								{meta?.name ?? `Упражнение ${record.exerciseId}`}
							</a>
							<p class="text-sm font-semibold text-[var(--color-accent)]">
								{formatPersonalRecord(record)}
							</p>
							<p class="text-xs text-[var(--color-muted)]">{formatDate(record.updatedAt)}</p>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
						<a class="btn-secondary" href={`/exercise/${record.exerciseId}`}>Изменить</a>
						<button
							type="button"
							class="btn-ghost px-3 text-red-700"
							onclick={() => void onRemove(record.exerciseId, meta?.name ?? record.exerciseId)}
						>
							Удалить
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
