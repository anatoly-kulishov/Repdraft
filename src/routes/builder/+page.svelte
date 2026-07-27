<script lang="ts">
	import { onMount } from 'svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import WorkoutExerciseRow from '$lib/components/WorkoutExerciseRow.svelte';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { draft } from '$lib/stores/draft';
	import { plans } from '$lib/stores/plans';
	import { toasts } from '$lib/stores/toasts';

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let savedBanner = $state(false);

	onMount(() => {
		loadExerciseIndex().then((items) => {
			indexById = new Map(items.map((item) => [item.id, item]));
		});
	});

	async function save() {
		try {
			await plans.saveCurrent();
			savedBanner = true;
			toasts.show('Тренировка сохранена', 'success');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : 'Не удалось сохранить', 'error');
		}
	}

	function clearDraft() {
		if (confirm('Очистить черновик?')) {
			draft.resetDraft();
			savedBanner = false;
		}
	}

	function newWorkout() {
		if ($draft.exercises.length > 0 && !confirm('Начать новую тренировку? Текущий черновик будет сброшен.')) {
			return;
		}
		draft.resetDraft();
		savedBanner = false;
	}
</script>

<svelte:head>
	<title>Конструктор — Repdraft</title>
</svelte:head>

<section class="pb-24">
	<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="font-[family-name:var(--font-display)] text-2xl md:text-3xl">Конструктор</h1>
			<p class="mt-1 text-sm text-[var(--color-muted)]">Соберите план: подходы, повторы и отдых.</p>
		</div>
		<button type="button" class="btn-secondary" onclick={newWorkout}>Новая тренировка</button>
	</div>

	<label class="mb-4 block text-sm font-medium text-[var(--color-muted)]">
		Название
		<input
			class="field mt-1 w-full max-w-xl"
			type="text"
			value={$draft.name}
			oninput={(e) => draft.setName((e.currentTarget as HTMLInputElement).value)}
		/>
	</label>

	{#if savedBanner}
		<p class="mb-4 rounded-lg border border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,white)] px-3 py-2 text-sm">
			Сохранено.
			<a class="font-semibold text-[var(--color-accent)] underline" href="/workouts">Мои тренировки</a>
		</p>
	{/if}

	{#if $draft.exercises.length === 0}
		<EmptyState
			title="Черновик пуст"
			description="Добавьте упражнения из каталога."
			actionHref="/"
			actionLabel="К каталогу"
		/>
	{:else}
		<div class="flex flex-col gap-3">
			{#each $draft.exercises as item, index (item.exerciseId)}
				<WorkoutExerciseRow
					{item}
					{index}
					total={$draft.exercises.length}
					meta={indexById.get(item.exerciseId) ?? null}
					onupdate={(patch) => draft.updateExercise(item.exerciseId, patch)}
					onmove={(from, to) => draft.moveExercise(from, to)}
					onremove={() => draft.removeFromDraft(item.exerciseId)}
				/>
			{/each}
		</div>
	{/if}

	<div
		class="fixed inset-x-0 bottom-14 z-30 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_94%,white)] px-4 py-3 backdrop-blur md:bottom-0"
	>
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
			<button type="button" class="btn-primary" onclick={save} disabled={$draft.exercises.length === 0}>
				Сохранить
			</button>
			<button type="button" class="btn-secondary" onclick={clearDraft}>Очистить черновик</button>
			<a class="btn-ghost px-3" href="/">К каталогу</a>
		</div>
	</div>
</section>
