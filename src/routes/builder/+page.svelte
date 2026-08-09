<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import WorkoutExerciseRow from '$lib/components/WorkoutExerciseRow.svelte';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { groupBounds } from '$lib/domain/workout';
	import { translate } from '$lib/i18n/messages';
	import { draft, draftHydrated } from '$lib/stores/draft';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let indexReady = $state(false);
	let selectedIds = $state<string[]>([]);
	let lang = $derived($resolvedLocale);
	let selectedCount = $derived(selectedIds.length);
	let pageReady = $derived(
		$draftHydrated && ($draft.exercises.length === 0 || indexReady)
	);

	onMount(() => {
		loadExerciseIndex()
			.then((items) => {
				indexById = new Map(items.map((item) => [item.id, item]));
			})
			.finally(() => {
				indexReady = true;
			});
	});

	async function save() {
		try {
			await plans.saveCurrent();
			draft.resetDraft();
			selectedIds = [];
			toasts.show(translate(lang, 'builder.savedToast'), 'success');
			await goto('/workouts');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : translate(lang, 'builder.saveFail'), 'error');
		}
	}

	function clearDraft() {
		if (confirm(translate(lang, 'builder.confirmClear'))) {
			draft.resetDraft();
			selectedIds = [];
		}
	}

	function newWorkout() {
		if ($draft.exercises.length > 0 && !confirm(translate(lang, 'builder.confirmNew'))) {
			return;
		}
		draft.resetDraft();
		selectedIds = [];
	}

	function toggleSelect(exerciseId: string) {
		if (selectedIds.includes(exerciseId)) {
			selectedIds = selectedIds.filter((id) => id !== exerciseId);
		} else {
			selectedIds = [...selectedIds, exerciseId];
		}
	}

	function makeSuperset() {
		if (selectedIds.length < 2) return;
		draft.formSuperset(selectedIds);
		selectedIds = [];
	}

	function roleFor(index: number): 'solo' | 'first' | 'middle' | 'last' {
		const bounds = groupBounds($draft.exercises, index);
		if (!bounds) return 'solo';
		if (bounds.start === bounds.end) return 'solo';
		if (index === bounds.start) return 'first';
		if (index === bounds.end) return 'last';
		return 'middle';
	}
</script>

<svelte:head>
	<title>{translate(lang, 'builder.title')} — Repdraft</title>
</svelte:head>

<section class:pb-mobile-actions={pageReady && $draft.exercises.length > 0} class="md:pb-0">
	<div class="page-header flex items-start justify-between gap-3">
		<div class="min-w-0">
			<h1 class="page-title">{translate(lang, 'builder.title')}</h1>
			<p class="page-lead">{translate(lang, 'builder.lead')}</p>
		</div>
		{#if pageReady && $draft.exercises.length > 0}
			<button type="button" class="btn-secondary shrink-0" onclick={newWorkout}>
				{translate(lang, 'builder.new')}
			</button>
		{/if}
	</div>

	{#if !pageReady}
		<PageSkeleton rows={3} showField={true} />
	{:else}
		<div class="soft-enter">
		<label class="field-label mb-4 block">
			{translate(lang, 'builder.name')}
			<input
				class="field mt-1.5 w-full max-w-xl"
				type="text"
				placeholder={translate(lang, 'builder.namePh')}
				value={$draft.name}
				oninput={(e) => draft.setName((e.currentTarget as HTMLInputElement).value)}
			/>
		</label>

		{#if $draft.exercises.length > 0}
			<div class="actions-inline mb-4 items-center">
				<button type="button" class="btn-primary" onclick={save}>
					{translate(lang, 'builder.save')}
				</button>
				<button type="button" class="btn-link !text-[var(--color-muted)]" onclick={clearDraft}>
					{translate(lang, 'builder.clear')}
				</button>
			</div>

			<div class="mb-4 flex flex-wrap items-center gap-2">
				<button
					type="button"
					class="btn-secondary"
					disabled={selectedCount < 2}
					onclick={makeSuperset}
				>
					{translate(lang, 'builder.superset')}
					{#if selectedCount > 0}
						· {selectedCount}
					{/if}
				</button>
				<p class="text-xs text-[var(--color-muted)]">{translate(lang, 'builder.selectHint')}</p>
			</div>
		{/if}

		{#if $draft.exercises.length === 0}
			<EmptyState
				title={translate(lang, 'builder.emptyTitle')}
				description={translate(lang, 'builder.emptyDesc')}
			/>
		{:else}
			<div class="flex flex-col gap-3">
				{#each $draft.exercises as item, index (item.exerciseId)}
					{@const role = roleFor(index)}
					<div class={role === 'first' || role === 'middle' ? 'mb-[-0.75rem]' : ''}>
						<WorkoutExerciseRow
							{item}
							{index}
							total={$draft.exercises.length}
							meta={indexById.get(item.exerciseId) ?? null}
							selected={selectedIds.includes(item.exerciseId)}
							groupRole={role}
							onupdate={(patch) => draft.updateExercise(item.exerciseId, patch)}
							onmove={(from, to) => draft.moveByArrow(from, to > from ? 1 : -1)}
							onremove={() => {
								draft.removeFromDraft(item.exerciseId);
								selectedIds = selectedIds.filter((id) => id !== item.exerciseId);
							}}
							ontoggleSelect={() => toggleSelect(item.exerciseId)}
							ondissolve={item.groupId ? () => draft.dissolveSuperset(item.groupId!) : undefined}
							ongroupSets={item.groupId
								? (sets) => draft.updateGroupSets(item.groupId!, sets)
								: undefined}
							ongroupRest={item.groupId
								? (rest) => draft.updateGroupRest(item.groupId!, rest)
								: undefined}
						/>
					</div>
				{/each}
			</div>

			<div class="sticky-actions">
				<div class="mx-auto flex max-w-6xl flex-col gap-1">
					<button type="button" class="btn-primary btn-block" onclick={save}>
						{translate(lang, 'builder.save')}
					</button>
					<button
						type="button"
						class="btn-link mx-auto !text-[var(--color-muted)]"
						onclick={clearDraft}
					>
						{translate(lang, 'builder.clear')}
					</button>
				</div>
			</div>
		{/if}
		</div>
	{/if}
</section>
