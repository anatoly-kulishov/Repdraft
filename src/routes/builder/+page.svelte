<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import WorkoutExerciseRow from '$lib/components/WorkoutExerciseRow.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { BUILDER_ADD_EXERCISE_HREF } from '$lib/domain/catalogLinks';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { groupMemberRole } from '$lib/domain/workout';
	import { translate } from '$lib/i18n/messages';
	import { draft, draftHydrated } from '$lib/stores/draft';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Plus, ArrowLeft } from '@lucide/svelte';

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let indexReady = $state(false);
	let selectedIds = $state<string[]>([]);
	let saving = $state(false);
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
		if (saving) return;
		saving = true;
		try {
			await plans.saveCurrent();
			draft.resetDraft();
			selectedIds = [];
			toasts.show(translate(lang, 'builder.savedToast'), 'success');
			await goto('/workouts');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : translate(lang, 'builder.saveFail'), 'error');
		} finally {
			saving = false;
		}
	}

	function clearDraft() {
		if (confirm(translate(lang, 'builder.confirmClear'))) {
			draft.resetDraft();
			selectedIds = [];
		}
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
</script>

<svelte:head>
	<title>{translate(lang, 'builder.createTitle')} — Repdraft</title>
</svelte:head>

<section
	class="builder-page content-page md:pb-0"
	class:pb-mobile-actions={pageReady && $draft.exercises.length > 0}
>
	<div class="lg:hidden">
		<ScreenHeader title={translate(lang, 'builder.createTitle')} backHref="/workouts" />
	</div>

	<div class="builder-toolbar mb-5 hidden flex-wrap items-center justify-between gap-3 lg:flex">
		<div class="min-w-0">
			<a
				class="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted)] no-underline hover:text-[var(--color-ink)]"
				href="/workouts"
			>
				<LucideIcon icon={ArrowLeft} size={ICON_BUTTON} />
				{translate(lang, 'builder.backWorkouts')}
			</a>
			<h1 class="page-title mt-1">{translate(lang, 'builder.createTitle')}</h1>
		</div>
		<button
			type="button"
			class="btn-primary inline-flex min-h-11 shrink-0 items-center gap-2 px-5"
			disabled={!pageReady || saving || $draft.exercises.length === 0}
			aria-busy={saving}
			onclick={() => void save()}
		>
			{#if saving}
				<Spinner size="sm" block={false} />
				{translate(lang, 'auth.wait')}
			{:else}
				{translate(lang, 'builder.save')}
			{/if}
		</button>
	</div>

	{#if !pageReady}
		<PageSkeleton rows={3} showField={true} />
	{:else}
		<div class="soft-enter">
			<label class="field-label mb-4 block max-w-xl">
				{translate(lang, 'builder.name')}
				<input
					class="field mt-1.5 w-full"
					type="text"
					placeholder={translate(lang, 'builder.namePh')}
					value={$draft.name}
					oninput={(e) => draft.setName((e.currentTarget as HTMLInputElement).value)}
				/>
			</label>

			{#if $draft.exercises.length === 0}
				<EmptyState
					title={translate(lang, 'builder.emptyTitle')}
					description={translate(lang, 'builder.emptyDesc')}
					actionHref={BUILDER_ADD_EXERCISE_HREF}
					actionLabel={translate(lang, 'builder.addExercise')}
				/>
			{:else}
				<p class="section-title mb-2">{translate(lang, 'builder.exercisesSection')}</p>

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

				<div class="builder-exercise-list">
					{#each $draft.exercises as item, index (item.exerciseId)}
						{@const role = groupMemberRole($draft.exercises, index)}
						{@const meta = indexById.get(item.exerciseId) ?? null}
						<div
							class="builder-exercise-item"
							class:builder-exercise-item--superset={role !== 'solo'}
							class:builder-exercise-item--group-continues={role === 'middle' || role === 'last'}
						>
							<WorkoutExerciseRow
								{item}
								{index}
								total={$draft.exercises.length}
								{meta}
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

				<a class="btn-secondary mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2" href={BUILDER_ADD_EXERCISE_HREF}>
					<LucideIcon icon={Plus} size={ICON_BUTTON} />
					{translate(lang, 'builder.addExercise')}
				</a>

				<button
					type="button"
					class="btn-link mx-auto mt-3 block !text-[var(--color-muted)]"
					onclick={clearDraft}
				>
					{translate(lang, 'builder.clear')}
				</button>

				<div class="sticky-actions lg:hidden">
					<div class="sticky-actions__inner flex flex-col gap-1">
						<button
							type="button"
							class="btn-primary btn-block"
							disabled={saving}
							aria-busy={saving}
							onclick={() => void save()}
						>
							{#if saving}
								<span class="inline-flex items-center justify-center gap-2">
									<Spinner size="sm" block={false} />
									{translate(lang, 'auth.wait')}
								</span>
							{:else}
								{translate(lang, 'builder.save')}
							{/if}
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</section>
