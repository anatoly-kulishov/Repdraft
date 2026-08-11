<script lang="ts">
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_PRIMARY } from '$lib/components/icons/sizes';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import type { ExerciseIndexItem, WorkoutPlan } from '$lib/domain/types';
	import { groupMemberRole, planPrescribedSetCount, planTargetSummary } from '$lib/domain/workout';
	import { translate } from '$lib/i18n/messages';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { ChevronRight, Pencil, Play } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';

	let { params } = $props();

	let lang = $derived($resolvedLocale);
	let plan = $state<WorkoutPlan | null>(null);
	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let loading = $state(true);
	let missing = $state(false);

	let muscles = $derived(plan ? planTargetSummary(plan, indexById, lang) : '');
	let totalSets = $derived(plan ? planPrescribedSetCount(plan) : 0);

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
	<a
		class="btn-ghost workout-preview-edit-link min-h-10 px-2.5 text-sm font-medium"
		href={plan ? `/builder/${plan.id}` : '/workouts'}
	>
		<LucideIcon icon={Pencil} size={ICON_BUTTON} />
		<span class="hidden sm:inline">{translate(lang, 'preview.edit')}</span>
	</a>
{/snippet}

<svelte:head>
	<title>{plan?.name ?? translate(lang, 'preview.title')} — Repdraft</title>
</svelte:head>

{#if loading}
	<section class="workout-preview pb-mobile-actions" aria-busy="true">
		<div class="workout-preview-skeleton-summary" aria-hidden="true"></div>
		<div class="workout-preview-skeleton-list" aria-hidden="true">
			<div class="workout-preview-skeleton-row"></div>
			<div class="workout-preview-skeleton-row"></div>
			<div class="workout-preview-skeleton-row"></div>
			<div class="workout-preview-skeleton-row"></div>
		</div>
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
		<div class="md:hidden">
			<ScreenHeader title={plan.name} backHref="/workouts" actions={headerActions} />
		</div>
		<div class="subroute-desktop-head hidden md:block">
			<SubrouteBack href="/workouts" label={translate(lang, 'builder.backWorkouts')} />
			<h1 class="page-title">{plan.name}</h1>
		</div>

		<div class="workout-preview-summary panel">
			{#if muscles}
				<p class="workout-preview-summary-muscles">{muscles}</p>
			{/if}
			<p class="workout-preview-summary-stats">
				{translate(lang, 'preview.stats', {
					exercises: plan.exercises.length,
					sets: totalSets
				})}
			</p>
		</div>

		<ul class="workout-preview-list">
			{#each plan.exercises as item, index (item.exerciseId + '-' + index)}
				{@const meta = indexById.get(item.exerciseId) ?? null}
				{@const role = groupMemberRole(plan.exercises, index)}
				<li
					class="workout-preview-item"
					class:is-group={role !== 'solo'}
					class:is-group-first={role === 'first'}
					class:is-group-middle={role === 'middle'}
					class:is-group-last={role === 'last'}
				>
					{#if role === 'first'}
						<p class="workout-preview-group-badge">{translate(lang, 'builder.supersetBadge')}</p>
					{/if}
					{#if meta}
						<a
							class="workout-preview-row"
							href={`/exercise/${meta.id}?from=${encodeURIComponent(`/workouts/${plan.id}`)}`}
						>
							<img
								class="workout-preview-thumb"
								src={`/${meta.image}`}
								alt=""
								width="56"
								height="56"
								loading="lazy"
								decoding="async"
							/>
							<div class="workout-preview-row-body">
								<p class="workout-preview-row-title">{exerciseName(meta, lang)}</p>
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
					{:else}
						<div class="workout-preview-row is-static">
							<span class="workout-preview-thumb is-placeholder" aria-hidden="true"></span>
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
			<button type="button" class="btn-primary inline-flex min-h-12 items-center gap-2 px-6" onclick={onStart}>
				<LucideIcon icon={Play} size={ICON_PRIMARY} />
				{translate(lang, 'workouts.start')}
			</button>
			<a
				class="btn-secondary inline-flex min-h-12 items-center gap-2 px-5"
				href={`/builder/${plan.id}`}
			>
				<LucideIcon icon={Pencil} size={ICON_BUTTON} />
				{translate(lang, 'preview.edit')}
			</a>
		</div>

		<div class="sticky-actions lg:hidden">
			<div class="sticky-actions__inner">
				<button type="button" class="btn-primary btn-block min-h-12 gap-2" onclick={onStart}>
					<LucideIcon icon={Play} size={ICON_PRIMARY} />
					{translate(lang, 'workouts.start')}
				</button>
			</div>
		</div>
	</section>
{/if}
