<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppLabel from '$lib/components/AppLabel.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import BuilderSupersetBannerSkeleton from '$lib/components/builder/BuilderSupersetBannerSkeleton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SwipeToDelete from '$lib/components/SwipeToDelete.svelte';
	import WorkoutExerciseRow from '$lib/components/WorkoutExerciseRow.svelte';
	import Coachmark from '$lib/components/onboarding/Coachmark.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { BUILDER_ADD_EXERCISE_HREF, WORKOUTS_HREF } from '$lib/domain/catalogLinks';
	import { PLAN_NAME_MAX, clampPlanName } from '$lib/domain/inputLimits';
	import type { ExerciseIndexItem, WorkoutExercise } from '$lib/domain/types';
	import { altGroupMemberRole, groupMemberRole, workoutPlanContentEqual } from '$lib/domain/workout';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { navigateBack } from '$lib/navigation/back';
	import { draft, draftHydrated } from '$lib/stores/draft';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { onboarding, onboardingHydrated } from '$lib/stores/onboarding';
	import { shouldShowCoachmark } from '$lib/domain/onboarding';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { readDraft, peekBuilderDraftExerciseCount } from '$lib/storage/localWorkoutRepository';
	import { Plus, Save, Trash2, ArrowLeft, Layers, ListTree } from '@lucide/svelte';

	let { data } = $props();

	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let indexReady = $state(false);
	let selectedIds = $state<string[]>([]);
	let saving = $state(false);
	let clearOfferOpen = $state(false);
	let introOfferOpen = $state(false);
	let freshStartConsumed = $state(false);
	let reorderFrom = $state<number | null>(null);
	let reorderOver = $state<number | null>(null);
	let lang = $derived($resolvedLocale);
	let showBuilderSupersetCoachmark = $derived(shouldShowCoachmark($onboarding, 'builder.superset'));
	let selectedCount = $derived(selectedIds.length);
	let pageReady = $derived(
		$draftHydrated && ($draft.exercises.length === 0 || indexReady)
	);
	let builderSkeletonExerciseCount = $derived.by(() => {
		if ($draft.exercises.length > 0) return $draft.exercises.length;
		if (browser) {
			const peeked = readDraft();
			if (peeked && peeked.exercises.length > 0) return peeked.exercises.length;
		}
		if (data.bootPeek.draftRows > 0) return data.bootPeek.draftRows;
		return peekBuilderDraftExerciseCount();
	});
	let builderSkeletonEmpty = $derived(builderSkeletonExerciseCount === 0);
	let builderSkeletonRows = $derived(
		builderSkeletonEmpty ? 0 : Math.min(Math.max(builderSkeletonExerciseCount, 1), 4)
	);
	let builderSkeletonGroupBanner = $derived.by((): 'none' | 'hint' | 'coachmark' => {
		if (builderSkeletonEmpty || builderSkeletonExerciseCount < 2) return 'none';
		// ponytail: hint bone matches steady-state list layout; coachmark panel is taller and flickers on hydrate
		return 'hint';
	});
	let draftUnchanged = $derived.by(() => {
		const draftPlan = $draft;
		const existing = $plans.find((plan) => plan.id === draftPlan.id);
		if (!existing) return false;
		const untitled = translate(lang, 'builder.untitled');
		const namedDraft = {
			...draftPlan,
			name: clampPlanName(draftPlan.name.replace(/\s+/g, ' ').trim()) || untitled
		};
		return workoutPlanContentEqual(existing, namedDraft);
	});

	/** After hydrate — otherwise localStorage would resurrect the previous draft name. */
	$effect(() => {
		if (freshStartConsumed || !$draftHydrated) return;
		if (!$page.url.searchParams.has('new')) return;
		freshStartConsumed = true;
		draft.resetDraft();
		selectedIds = [];
		void goto('/builder', { replaceState: true, noScroll: true, keepFocus: true });
	});

	$effect(() => {
		if (!pageReady || !$onboardingHydrated || $draft.exercises.length > 0 || introOfferOpen) return;
		if (shouldShowCoachmark($onboarding, 'builder.intro')) {
			introOfferOpen = true;
		}
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
		if (saving || draftUnchanged) return;
		saving = true;
		try {
			await plans.saveCurrent();
			onboarding.markChecklist('planReady');
			draft.resetDraft();
			selectedIds = [];
			toasts.show(translate(lang, 'builder.savedToast'), 'success');
			await goto(WORKOUTS_HREF);
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

	function removeExerciseFromBuilder(item: WorkoutExercise, index: number) {
		const snapshot = structuredClone(item);
		const wasSelected = selectedIds.includes(item.exerciseId);
		draft.removeFromDraft(item.exerciseId);
		selectedIds = selectedIds.filter((id) => id !== item.exerciseId);
		toasts.showUndo(
			translate(lang, 'exercise.removed'),
			() => {
				draft.restoreExerciseToDraft(snapshot, index);
				if (wasSelected && !selectedIds.includes(item.exerciseId)) {
					selectedIds = [...selectedIds, item.exerciseId];
				}
			},
			'info',
			undefined,
			'draft'
		);
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

	function convertAltGroup(altGroupId: string) {
		const memberIds = new Set(
			$draft.exercises.filter((ex) => ex.altGroupId === altGroupId).map((ex) => ex.exerciseId)
		);
		draft.convertAltToSuperset(altGroupId);
		selectedIds = selectedIds.filter((id) => !memberIds.has(id));
	}

	let headerTitle = $derived($draft.name.trim() || translate(lang, 'builder.namePh'));
</script>

{#snippet builderGroupButtons()}
	<AppButton variant="secondary" class="builder-group-bar__btn" onclick={makeSuperset}>
		<LucideIcon icon={Layers} size={ICON_SMALL} />
		{translate(lang, 'builder.superset')}
	</AppButton>
	<AppButton variant="secondary" class="builder-group-bar__btn" onclick={makeOrGroup}>
		<LucideIcon icon={ListTree} size={ICON_SMALL} />
		{translate(lang, 'builder.or', { n: selectedCount })}
	</AppButton>
{/snippet}

{#snippet builderClearAction()}
	{#if $draft.exercises.length > 0}
		<AppButton
			variant="ghost"
			class="builder-chrome__clear is-danger shrink-0"
			onclick={clearDraft}
			aria-label={translate(lang, 'builder.clear')}
			title={translate(lang, 'builder.clear')}
		>
			<LucideIcon icon={Trash2} size={ICON_BUTTON} />
		</AppButton>
	{/if}
{/snippet}

{#snippet builderSaveChrome()}
	<AppButton
		variant="secondary"
		class="builder-chrome__save builder-toolbar-save shrink-0"
		disabled={!pageReady || saving || $draft.exercises.length === 0 || draftUnchanged}
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
{/snippet}

<SeoHead title={headerTitle} noindex />

<section
	class="builder-page content-page md:pb-0"
	class:pb-mobile-actions={$draftHydrated && pageReady}
>
	<div class="builder-chrome">
		<div class="builder-chrome__head">
			<button
				type="button"
				class="builder-chrome__back"
				aria-label={`${translate(lang, 'a11y.back')}: ${translate(lang, 'builder.backWorkouts')}`}
				onclick={() => navigateBack('/workouts')}
			>
				<LucideIcon icon={ArrowLeft} size={ICON_PRIMARY} />
			</button>
			{#if $draftHydrated}
				<AppInput
					class="builder-chrome__name"
					type="text"
					placeholder={translate(lang, 'builder.namePh')}
					maxlength={PLAN_NAME_MAX}
					value={$draft.name}
					aria-label={translate(lang, 'builder.name')}
					oninput={(e) => draft.setName((e.currentTarget as HTMLInputElement).value)}
				/>
				<div class="builder-chrome__actions">
					{@render builderClearAction()}
					{@render builderSaveChrome()}
				</div>
			{:else}
				<div class="builder-chrome__name-skel" aria-hidden="true"></div>
			{/if}
		</div>
		{#if $draftHydrated && selectedCount >= 2}
			<div
				class="builder-group-bar"
				role="toolbar"
				aria-label={translate(lang, 'builder.groupToolbarAria')}
			>
				<p class="builder-group-bar__label">
					{translate(lang, 'builder.groupSelected', { n: selectedCount })}
				</p>
				<div class="builder-group-bar__actions">
					{@render builderGroupButtons()}
				</div>
			</div>
		{/if}
	</div>

	{#if !pageReady}
		<div class="soft-enter">
			<PageSkeleton
				variant={builderSkeletonEmpty ? 'builder-empty' : 'builder'}
				rows={builderSkeletonRows}
				groupBanner={builderSkeletonGroupBanner}
			/>
		</div>
		{#if !builderSkeletonEmpty}
			<div class="sticky-actions lg:hidden builder-skeleton-sticky" aria-hidden="true">
				<div class="sticky-actions__inner builder-sticky-actions">
					<span class="builder-skeleton-sticky__btn"></span>
					<span class="builder-skeleton-sticky__btn builder-skeleton-sticky__btn--primary"></span>
				</div>
			</div>
		{/if}
	{:else if $draftHydrated}
		<div class="soft-enter">
			<div class="builder-name-desktop mb-4 w-full">
				<AppLabel>
					<span class="builder-name-label-row">
						<span>{translate(lang, 'builder.name')}</span>
						<span
							id="builder-name-count"
							class="pr-note-count builder-name-count"
							class:pr-note-count--limit={$draft.name.length >= PLAN_NAME_MAX}
							aria-live="polite"
						>
							{$draft.name.length}/{PLAN_NAME_MAX}
						</span>
					</span>
					<AppInput
						class="mt-1 w-full"
						type="text"
						placeholder={translate(lang, 'builder.namePh')}
						maxlength={PLAN_NAME_MAX}
						value={$draft.name}
						aria-describedby="builder-name-count"
						oninput={(e) => draft.setName((e.currentTarget as HTMLInputElement).value)}
					/>
				</AppLabel>
			</div>

			{#if $draft.exercises.length === 0}
				<EmptyState
					centered
					class="builder-empty-state"
					icon={Plus}
					title={translate(lang, 'builder.emptyTitle')}
					description={translate(lang, 'builder.emptyDesc')}
					actionHref={BUILDER_ADD_EXERCISE_HREF}
					actionLabel={translate(lang, 'builder.addExerciseShort')}
				/>
			{:else}
				<div class="builder-section-head hidden lg:flex">
					<p class="section-title">{translate(lang, 'builder.exercisesSection')}</p>
					{#if selectedCount >= 2}
						<div class="builder-group-bar builder-group-bar--inline">
							<p class="builder-group-bar__label">
								{translate(lang, 'builder.groupSelected', { n: selectedCount })}
							</p>
							<div class="builder-group-bar__actions">
								{@render builderGroupButtons()}
							</div>
						</div>
					{/if}
				</div>

				{#if $draft.exercises.length >= 2 && selectedCount < 2}
					{#if showBuilderSupersetCoachmark}
						{#if $onboardingHydrated}
							<Coachmark
								message={translate(lang, 'onboarding.coachBuilderSuperset')}
								onDismiss={() => onboarding.dismissCoachmark('builder.superset')}
							/>
						{:else}
							<BuilderSupersetBannerSkeleton variant="coachmark" />
						{/if}
					{:else}
						<p class="builder-group-hint">{translate(lang, 'builder.groupHint')}</p>
					{/if}
				{/if}

				<div class="builder-exercise-list" data-reorder-list>
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
								onDelete={() => removeExerciseFromBuilder(item, index)}
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
									onremove={() => removeExerciseFromBuilder(item, index)}
									ontoggleSelect={() => toggleSelect(item.exerciseId)}
									ondissolve={item.groupId ? () => draft.dissolveSuperset(item.groupId!) : undefined}
									ondissolveOr={item.altGroupId
										? () => draft.dissolveOrGroup(item.altGroupId!)
										: undefined}
									onConvertToSuperset={item.altGroupId
										? () => convertAltGroup(item.altGroupId!)
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

				<div class="mt-4 hidden lg:block">
					<AppButton
						variant="secondary"
						href={BUILDER_ADD_EXERCISE_HREF}
						block
						class="items-center justify-center gap-2"
					>
						<LucideIcon icon={Plus} size={ICON_BUTTON} />
						{translate(lang, 'builder.addExercise')}
					</AppButton>
				</div>

				<div class="sticky-actions lg:hidden">
					<div class="sticky-actions__inner builder-sticky-actions">
						<AppButton
							variant="secondary"
							href={BUILDER_ADD_EXERCISE_HREF}
							class="builder-sticky-actions__btn gap-1.5"
							aria-label={translate(lang, 'builder.addExercise')}
						>
							<LucideIcon icon={Plus} size={ICON_BUTTON} />
							{translate(lang, 'builder.addExerciseShort')}
						</AppButton>
						<AppButton
							class="builder-sticky-actions__btn"
							disabled={!pageReady || saving || $draft.exercises.length === 0 || draftUnchanged}
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

<BottomSheet
	open={introOfferOpen}
	titleId="builder-intro-title"
	onDismiss={() => {
		introOfferOpen = false;
		onboarding.dismissCoachmark('builder.intro');
	}}
>
	<p id="builder-intro-title" class="bottom-sheet__title">
		{translate(lang, 'builder.title')}
	</p>
	<p class="bottom-sheet__lead">{translate(lang, 'onboarding.coachBuilderIntro')}</p>
	{#snippet actions()}
		<AppButton
			block
			onclick={() => {
				introOfferOpen = false;
				onboarding.dismissCoachmark('builder.intro');
			}}
		>
			{translate(lang, 'onboarding.gotIt')}
		</AppButton>
	{/snippet}
</BottomSheet>
