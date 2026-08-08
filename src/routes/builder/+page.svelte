<script lang="ts">
	import { onMount } from 'svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import WorkoutExerciseRow from '$lib/components/WorkoutExerciseRow.svelte';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { draft } from '$lib/stores/draft';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let savedBanner = $state(false);
	let lang = $derived($resolvedLocale);

	onMount(() => {
		loadExerciseIndex().then((items) => {
			indexById = new Map(items.map((item) => [item.id, item]));
		});
	});

	async function save() {
		try {
			await plans.saveCurrent();
			savedBanner = true;
			toasts.show(translate(lang, 'builder.savedToast'), 'success');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : translate(lang, 'builder.saveFail'), 'error');
		}
	}

	function clearDraft() {
		if (confirm(translate(lang, 'builder.confirmClear'))) {
			draft.resetDraft();
			savedBanner = false;
		}
	}

	function newWorkout() {
		if (
			$draft.exercises.length > 0 &&
			!confirm(translate(lang, 'builder.confirmNew'))
		) {
			return;
		}
		draft.resetDraft();
		savedBanner = false;
	}
</script>

<svelte:head>
	<title>{translate(lang, 'builder.title')} — Repdraft</title>
</svelte:head>

<section class="pb-28 md:pb-0">
	<div class="page-header flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<h1 class="page-title">{translate(lang, 'builder.title')}</h1>
			<p class="page-lead">{translate(lang, 'builder.lead')}</p>
		</div>
		<button type="button" class="btn-secondary w-full sm:w-auto" onclick={newWorkout}>
			{translate(lang, 'builder.new')}
		</button>
	</div>

	<label class="field-label mb-4">
		{translate(lang, 'builder.name')}
		<input
			class="field mt-1 w-full max-w-xl"
			type="text"
			value={$draft.name}
			oninput={(e) => draft.setName((e.currentTarget as HTMLInputElement).value)}
		/>
	</label>

	<div class="actions-inline">
		<button type="button" class="btn-primary" onclick={save} disabled={$draft.exercises.length === 0}>
			{translate(lang, 'builder.save')}
		</button>
		<button type="button" class="btn-secondary" onclick={clearDraft}>{translate(lang, 'builder.clear')}</button>
		<a class="btn-secondary" href="/">{translate(lang, 'builder.toCatalog')}</a>
	</div>

	{#if savedBanner}
		<p
			class="mb-4 rounded-lg border border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,white)] px-3 py-2 text-sm"
		>
			{translate(lang, 'builder.saved')}
			<a class="font-semibold text-[var(--color-accent)] underline" href="/workouts"
				>{translate(lang, 'builder.myWorkouts')}</a
			>
		</p>
	{/if}

	{#if $draft.exercises.length === 0}
		<EmptyState
			title={translate(lang, 'builder.emptyTitle')}
			description={translate(lang, 'builder.emptyDesc')}
			actionHref="/"
			actionLabel={translate(lang, 'builder.toCatalog')}
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

	<div class="sticky-actions">
		<div class="mx-auto grid max-w-6xl grid-cols-2 gap-2">
			<button
				type="button"
				class="btn-primary col-span-2"
				onclick={save}
				disabled={$draft.exercises.length === 0}
			>
				{translate(lang, 'builder.save')}
			</button>
			<button type="button" class="btn-secondary" onclick={clearDraft}>{translate(lang, 'builder.clear')}</button>
			<a class="btn-secondary" href="/">{translate(lang, 'builder.toCatalog')}</a>
		</div>
	</div>
</section>
