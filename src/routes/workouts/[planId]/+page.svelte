<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import ExerciseTechniqueSheet from '$lib/components/ExerciseTechniqueSheet.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_PRIMARY } from '$lib/components/icons/sizes';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import type { ExerciseIndexItem, WorkoutPlan } from '$lib/domain/types';
	import { altGroupMemberRole, groupMemberRole, planExerciseSlotCount, planPrescribedSetCount, planTargetSummary } from '$lib/domain/workout';
	import { translate } from '$lib/i18n/messages';
	import { peekLocalPlan } from '$lib/storage/localWorkoutRepository';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { ChevronRight, Pencil, Play } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';

	let { params } = $props();

	let lang = $derived($resolvedLocale);
	let plan = $state<WorkoutPlan | null>(null);
	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let loading = $state(true);
	let missing = $state(false);
	let fromPath = $derived($page.url.pathname);
	let technique = $state<{
		id: string;
		title: string;
		hint: string;
		image: string;
	} | null>(null);

	let muscles = $derived(plan ? planTargetSummary(plan, indexById, lang) : '');
	let totalSets = $derived(plan ? planPrescribedSetCount(plan) : 0);
	let skeletonExerciseRows = $derived.by(() => {
		const peeked = peekLocalPlan(params.planId);
		const n = peeked?.exercises.length ?? 0;
		return Math.min(Math.max(n, 1), 6);
	});

	onMount(() => {
		void (async () => {
			const id = params.planId;
			if (!id) {
				missing = true;
				loading = false;
				return;
			}
			try {
				const [found, index] = await Promise.all([plans.getPlan(id), loadExerciseIndex()]);
				indexById = new Map(index.map((item) => [item.id, item]));
				if (!found || found.exercises.length === 0) {
					missing = true;
				} else {
					plan = found;
				}
			} catch {
				missing = true;
			} finally {
				loading = false;
			}
		})();
	});

	function onStart() {
		if (!plan) return;
		void goto(`/live/${plan.id}`);
	}
</script>

{#snippet headerActions()}
	<AppButton
		variant="ghost"
		class="workout-preview-edit-link"
		href={plan ? `/builder/${plan.id}` : '/workouts'}
		aria-label={translate(lang, 'preview.edit')}
		title={translate(lang, 'preview.edit')}
	>
		<LucideIcon icon={Pencil} size={ICON_BUTTON} />
	</AppButton>
{/snippet}

<svelte:head>
	<title>{plan?.name ?? translate(lang, 'preview.title')} · Repdraft</title>
</svelte:head>

{#if loading}
	<section class="workout-preview content-page content-page--narrow pb-mobile-actions" aria-busy="true">
		<div class="workout-preview-skeleton-head lg:hidden" aria-hidden="true">
			<div class="workout-preview-skeleton-head__bar"></div>
		</div>
		<div class="workout-preview-skeleton-desktop-head hidden lg:block" aria-hidden="true">
			<div class="workout-preview-skeleton-head__bar workout-preview-skeleton-head__bar--back"></div>
			<div class="workout-preview-skeleton-head__bar workout-preview-skeleton-head__bar--title"></div>
		</div>
		<div class="workout-preview-skeleton-summary" aria-hidden="true">
			<div class="workout-preview-skeleton-summary__line workout-preview-skeleton-summary__line--lead"></div>
			<div class="workout-preview-skeleton-summary__line workout-preview-skeleton-summary__line--meta"></div>
		</div>
		<ul class="workout-preview-skeleton-list" aria-hidden="true">
			{#each Array.from({ length: skeletonExerciseRows }, (_, i) => i) as i (i)}
				<li class="workout-preview-skeleton-row">
					<div class="workout-preview-skeleton-row__thumb"></div>
					<div class="workout-preview-skeleton-row__body">
						<div class="workout-preview-skeleton-row__title"></div>
						<div class="workout-preview-skeleton-row__sub"></div>
					</div>
					<div class="workout-preview-skeleton-row__chevron"></div>
				</li>
			{/each}
		</ul>
	</section>
{:else if missing || !plan}
	<EmptyState
		title={translate(lang, 'live.noPlan')}
		description={translate(lang, 'live.emptyPlan')}
		actionHref="/workouts"
		actionLabel={translate(lang, 'live.backPlans')}
	/>
{:else}
	<section class="workout-preview content-page content-page--narrow pb-mobile-actions lg:pb-8">
		<div class="lg:hidden">
			<ScreenHeader
				fixed
				class="workout-preview-header"
				title={plan.name}
				backHref="/workouts"
				actions={headerActions}
			/>
		</div>
		<div class="subroute-desktop-head">
			<SubrouteBack href="/workouts" label={translate(lang, 'builder.backWorkouts')} />
			<h1 class="page-title">{plan.name}</h1>
		</div>

		<AppPanel class="workout-preview-summary">
			{#if muscles}
				<p class="workout-preview-summary-muscles">{muscles}</p>
			{/if}
			<p class="workout-preview-summary-stats">
				{translate(lang, 'preview.stats', {
					exercises: planExerciseSlotCount(plan),
					sets: totalSets
				})}
			</p>
		</AppPanel>

		<ul class="workout-preview-list">
			{#each plan.exercises as item, index (item.exerciseId + '-' + index)}
				{@const meta = indexById.get(item.exerciseId) ?? null}
				{@const role = groupMemberRole(plan.exercises, index)}
				{@const altRole = altGroupMemberRole(plan.exercises, index)}
				<li
					class="workout-preview-item"
					class:is-group={role !== 'solo'}
					class:is-group-first={role === 'first'}
					class:is-group-middle={role === 'middle'}
					class:is-group-last={role === 'last'}
					class:is-or={altRole !== 'solo'}
					class:is-or-first={altRole === 'first'}
					class:is-or-middle={altRole === 'middle'}
					class:is-or-last={altRole === 'last'}
				>
					{#if role === 'first'}
						<p class="workout-preview-group-badge">{translate(lang, 'builder.supersetBadge')}</p>
					{/if}
					{#if altRole === 'first'}
						<p class="workout-preview-or-badge">{translate(lang, 'builder.orBadge')}</p>
					{/if}
					{#if altRole === 'middle' || altRole === 'last'}
						<p class="workout-preview-or-divider" aria-hidden="true">
							{translate(lang, 'builder.orDivider')}
						</p>
					{/if}
					{#if meta}
						{@const title = exerciseName(meta, lang)}
						{@const detailHref = `/exercise/${meta.id}?from=${encodeURIComponent(fromPath)}`}
						<div class="workout-preview-row">
							<AppButton
								variant="ghost"
								class="workout-preview-thumb-btn media-well workout-preview-thumb !h-auto !min-h-[48px] !min-w-[48px] !p-0"
								aria-label={translate(lang, 'exercise.openTechnique', { name: title })}
								onclick={() => {
									technique = {
										id: meta.id,
										title,
										hint: labelTarget(meta.target, lang),
										image: meta.image
									};
								}}
							>
								<img
									src={`/${meta.image}`}
									alt=""
									width="120"
									height="120"
									loading="lazy"
									decoding="async"
								/>
							</AppButton>
							<a class="workout-preview-row-main" href={detailHref}>
								<div class="workout-preview-row-body">
									<p class="workout-preview-row-title">{title}</p>
									<p class="workout-preview-row-sub tabular-nums">
										{#if role === 'solo'}
											{item.sets} × {item.reps}
										{:else if role === 'first'}
											{item.sets}
											{translate(lang, 'builder.rounds').toLowerCase()} · {item.reps}
											{translate(lang, 'builder.reps').toLowerCase()}
										{:else}
											{item.reps} {translate(lang, 'builder.reps').toLowerCase()}
										{/if}
										<span class="workout-preview-row-dot" aria-hidden="true">·</span>
										{labelTarget(meta.target, lang)} · {labelEquipment(meta.equipment, lang)}
									</p>
								</div>
								<span class="workout-preview-chevron" aria-hidden="true">
									<LucideIcon icon={ChevronRight} size={ICON_BUTTON} />
								</span>
							</a>
						</div>
					{:else}
						<div class="workout-preview-row is-static">
							<span class="media-well workout-preview-thumb is-placeholder" aria-hidden="true"></span>
							<div class="workout-preview-row-body">
								<p class="workout-preview-row-title">{item.exerciseId}</p>
								<p class="workout-preview-row-sub tabular-nums">{item.sets} × {item.reps}</p>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>

		<div class="workout-preview-actions-desktop hidden flex-wrap gap-2 lg:flex">
			<AppButton class="inline-flex items-center gap-2 px-6" onclick={onStart}>
				<LucideIcon icon={Play} size={ICON_PRIMARY} />
				{translate(lang, 'workouts.start')}
			</AppButton>
			<AppButton
				variant="ghost"
				class="workout-preview-edit-link"
				href={`/builder/${plan.id}`}
				aria-label={translate(lang, 'preview.edit')}
				title={translate(lang, 'preview.edit')}
			>
				<LucideIcon icon={Pencil} size={ICON_BUTTON} />
			</AppButton>
		</div>

		<div class="sticky-actions lg:hidden">
			<div class="sticky-actions__inner">
				<AppButton block class="gap-2" onclick={onStart}>
					<LucideIcon icon={Play} size={ICON_PRIMARY} />
					{translate(lang, 'workouts.start')}
				</AppButton>
			</div>
		</div>
	</section>
{/if}

{#if technique}
	<ExerciseTechniqueSheet
		open
		titleId={`preview-technique-${technique.id}`}
		title={technique.title}
		hint={technique.hint}
		imagePath={technique.image}
		detailHref={`/exercise/${technique.id}?from=${encodeURIComponent(fromPath)}`}
		onDismiss={() => {
			technique = null;
		}}
	/>
{/if}
