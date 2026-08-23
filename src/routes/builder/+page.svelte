<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppLabel from '$lib/components/AppLabel.svelte';
	import AppFab from '$lib/components/AppFab.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SwipeToDelete from '$lib/components/SwipeToDelete.svelte';
	import WorkoutExerciseRow from '$lib/components/WorkoutExerciseRow.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { BUILDER_ADD_EXERCISE_HREF, WORKOUTS_HREF } from '$lib/domain/catalogLinks';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { altGroupMemberRole, groupMemberRole } from '$lib/domain/workout';
	import { translate } from '$lib/i18n/messages';
	import { draft, draftHydrated } from '$lib/stores/draft';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Plus, Save, Trash2 } from '@lucide/svelte';

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let indexReady = $state(false);
	let selectedIds = $state<string[]>([]);
	let saving = $state(false);
	let clearOfferOpen = $state(false);
	let freshStartConsumed = $state(false);
	let reorderFrom = $state<number | null>(null);
	let reorderOver = $state<number | null>(null);
	let lang = $derived($resolvedLocale);
	let selectedCount = $derived(selectedIds.length);
	let pageReady = $derived(
		$draftHydrated && ($draft.exercises.length === 0 || indexReady)
	);

	/** After hydrate — otherwise localStorage would resurrect the previous draft name. */
	$effect(() => {
		if (freshStartConsumed || !$draftHydrated) return;
		if (!$page.url.searchParams.has('new')) return;
		freshStartConsumed = true;
		draft.resetDraft();
		selectedIds = [];
		void goto('/builder', { replaceState: true, noScroll: true, keepFocus: true });
	});

	onMount(() => {
		const onReorder = (event: Event) => {
			const detail = (event as CustomEvent<{ from: number | null; over: number | null }>).detail;
			reorderFrom = detail.from;
			reorderOver = detail.over;
		};
		document.addEventListener('repdraft:builder-reorder', onReorder);

		loadExerciseIndex()
			.then((items) => {
				indexById = new Map(items.map((item) => [item.id, item]));
			})
			.finally(() => {
				indexReady = true;
			});

		return () => {
			document.removeEventListener('repdraft:builder-reorder', onReorder);
		};
	});

	async function save() {
		if (saving) return;
		saving = true;
		try {
			await plans.saveCurrent();
			draft.resetDraft();
			selectedIds = [];
			toasts.show(translate(lang, 'builder.savedToast'), 'success');
			await goto(WORKOUTS_HREF, { replaceState: true });
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : translate(lang, 'builder.saveFail'), 'error');
		} finally {
			saving = false;
		}
	}

	function clearDraft() {
		clearOfferOpen = true;
	}

	function commitClearDraft() {
		clearOfferOpen = false;
		draft.resetDraft();
		selectedIds = [];
	}

	function dismissClearOffer() {
		clearOfferOpen = false;
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

	function makeOrGroup() {
		if (selectedIds.length < 2) return;
		draft.formOrGroup(selectedIds);
		selectedIds = [];
	}
</script>

{#snippet builderClearAction()}
	{#if $draft.exercises.length > 0}
		<AppButton
			variant="ghost"
			class="is-danger shrink-0"
			onclick={clearDraft}
			aria-label={translate(lang, 'builder.clear')}
			title={translate(lang, 'builder.clear')}
		>
			<LucideIcon icon={Trash2} size={ICON_BUTTON} />
		</AppButton>
	{/if}
{/snippet}

<svelte:head>
	<title>{translate(lang, 'builder.createTitle')} · Repdraft</title>
</svelte:head>

<section
	class="builder-page content-page md:pb-0"
	class:pb-mobile-actions={pageReady && $draft.exercises.length > 0}
>
	<div class="lg:hidden">
		<ScreenHeader
			fixed
			title={translate(lang, 'builder.createTitle')}
			backHref="/workouts"
			actions={builderClearAction}
		/>
	</div>

	<div class="builder-toolbar mb-5 hidden flex-wrap items-center justify-between gap-3 lg:flex">
		<div class="min-w-0">
			<SubrouteBack href="/workouts" label={translate(lang, 'builder.backWorkouts')} />
			<h1 class="page-title mt-1">{translate(lang, 'builder.createTitle')}</h1>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			{@render builderClearAction()}
			<AppButton
				variant="secondary"
				class="builder-toolbar-save"
				disabled={!pageReady || saving || $draft.exercises.length === 0}
				aria-busy={saving}
				aria-label={translate(lang, 'builder.save')}
				title={translate(lang, 'builder.save')}
				onclick={() => void save()}
			>
				{#if saving}
					<Spinner size="sm" block={false} />
				{:else}
					<LucideIcon icon={Save} size={ICON_BUTTON} />
				{/if}
			</AppButton>
		</div>
	</div>

	{#if !pageReady}
		<PageSkeleton variant="builder" rows={3} />
	{:else}
		<div class="soft-enter">
			<AppLabel class="mb-5 block max-w-xl">
				{translate(lang, 'builder.name')}
				<AppInput
					class="mt-1.5 w-full"
					type="text"
					placeholder={translate(lang, 'builder.namePh')}
					value={$draft.name}
					oninput={(e) => draft.setName((e.currentTarget as HTMLInputElement).value)}
				/>
			</AppLabel>

			{#if $draft.exercises.length === 0}
				<EmptyState
					class="builder-empty-state"
					title={translate(lang, 'builder.emptyTitle')}
					description={translate(lang, 'builder.emptyDesc')}
					actionHref={BUILDER_ADD_EXERCISE_HREF}
					actionLabel={translate(lang, 'builder.addExercise')}
				/>
			{:else}
				<div class="builder-section-head">
					<p class="section-title">{translate(lang, 'builder.exercisesSection')}</p>
					{#if selectedCount >= 2}
						<div class="builder-section-head__actions">
							<AppButton variant="secondary" onclick={makeOrGroup}>
								{translate(lang, 'builder.or', { n: selectedCount })}
							</AppButton>
							<AppButton variant="secondary" onclick={makeSuperset}>
								{translate(lang, 'builder.superset')} · {selectedCount}
							</AppButton>
						</div>
					{/if}
				</div>
				{#if selectedCount < 2}
					<p class="builder-select-hint">{translate(lang, 'builder.selectHint')}</p>
				{/if}

				<div class="builder-exercise-list">
					{#each $draft.exercises as item, index (item.exerciseId)}
						{@const role = groupMemberRole($draft.exercises, index)}
						{@const altRole = altGroupMemberRole($draft.exercises, index)}
						{@const meta = indexById.get(item.exerciseId) ?? null}
						<div
							class="builder-exercise-item"
							class:builder-exercise-item--or={Boolean(item.altGroupId)}
							class:builder-exercise-item--reorder-dragging={reorderFrom === index}
							class:builder-exercise-item--reorder-over={reorderOver === index}
							data-builder-index={index}
						>
							<SwipeToDelete
								label={translate(lang, 'builder.remove')}
								onDelete={() => {
									draft.removeFromDraft(item.exerciseId);
									selectedIds = selectedIds.filter((id) => id !== item.exerciseId);
								}}
							>
								<WorkoutExerciseRow
									{item}
									{index}
									{meta}
									selected={selectedIds.includes(item.exerciseId)}
									groupRole={role}
									{altRole}
									onupdate={(patch) => draft.updateExercise(item.exerciseId, patch)}
									onreorder={(from, to) => draft.moveExercise(from, to)}
									onremove={() => {
										draft.removeFromDraft(item.exerciseId);
										selectedIds = selectedIds.filter((id) => id !== item.exerciseId);
									}}
									ontoggleSelect={() => toggleSelect(item.exerciseId)}
									ondissolve={item.groupId ? () => draft.dissolveSuperset(item.groupId!) : undefined}
									ondissolveOr={item.altGroupId
										? () => draft.dissolveOrGroup(item.altGroupId!)
										: undefined}
									ongroupSets={item.groupId
										? (sets) => draft.updateGroupSets(item.groupId!, sets)
										: undefined}
									ongroupRest={item.groupId
										? (rest) => draft.updateGroupRest(item.groupId!, rest)
										: undefined}
								/>
							</SwipeToDelete>
						</div>
					{/each}
				</div>

				<AppButton
					variant="secondary"
					href={BUILDER_ADD_EXERCISE_HREF}
					class="builder-add-link mt-4 w-full items-center justify-center gap-2"
				>
					<LucideIcon icon={Plus} size={ICON_BUTTON} />
					{translate(lang, 'builder.addExercise')}
				</AppButton>

				<div class="sticky-actions lg:hidden">
					<div class="sticky-actions__inner flex flex-col gap-1">
						<AppButton
							block
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
						</AppButton>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if pageReady}
		<AppFab
			class="lg:hidden"
			href={BUILDER_ADD_EXERCISE_HREF}
			label={translate(lang, 'builder.addExercise')}
			placement={$draft.exercises.length > 0 ? 'sticky' : 'tabbar'}
		/>
	{/if}
</section>

<BottomSheet
	open={clearOfferOpen}
	titleId="builder-clear-title"
	onDismiss={dismissClearOffer}
>
	<p id="builder-clear-title" class="bottom-sheet__title">
		{translate(lang, 'builder.confirmClear')}
	</p>
	{#snippet actions()}
		<AppButton variant="secondary" onclick={dismissClearOffer}>
			{translate(lang, 'common.cancel')}
		</AppButton>
		<AppButton variant="danger" onclick={commitClearDraft}>
			{translate(lang, 'common.clear')}
		</AppButton>
	{/snippet}
</BottomSheet>
