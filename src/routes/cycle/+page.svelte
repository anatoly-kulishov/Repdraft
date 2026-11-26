<script lang="ts">
	import '$lib/styles/blocks/cycle.css';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppChip from '$lib/components/AppChip.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import ConfirmSheet from '$lib/components/ConfirmSheet.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import CycleWaveChart from '$lib/components/cycle/CycleWaveChart.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { CaretDown, Check, Play } from 'phosphor-svelte';
	import { ATHLETE_GOAL_IDS, type AthleteGoalId } from '$lib/domain/athleteProfile';
	import { BUILDER_NEW_HREF } from '$lib/domain/catalogLinks';
	import { loadExerciseIndexWithCustoms, peekExerciseIndexWithCustoms } from '$lib/data/exerciseIndexWithCustoms';
	import {
		CYCLE_LENGTHS,
		cycleProgressNow,
		cycleWeekPlanRows,
		cycleWeekVariant,
		cycleWeeksSummary,
		defaultCycleStartDate,
		newCycle,
		type CycleLength,
		type CycleWeekKind
	} from '$lib/domain/cycle';
	import {
		cycleTargetSetCount,
		cycleTargetWeights,
		cycleWeekTargets
	} from '$lib/domain/cycleTargets';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { clampPlanName } from '$lib/domain/inputLimits';
	import type { ExerciseIndexItem, WorkoutExercise, WorkoutPlan } from '$lib/domain/types';
	import { measureOf, planExerciseSlotCount } from '$lib/domain/workout';
	import { translate, translatePlural } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { readActiveSession } from '$lib/storage/localSessionRepository';
	import { cycle } from '$lib/stores/cycle';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';
	import { plans } from '$lib/stores/plans';
	import { athleteProfile } from '$lib/stores/prefs';
	import { toasts } from '$lib/stores/toasts';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	let lang = $derived($resolvedLocale);
	let active = $derived($cycle);

	let progress = $derived(active ? cycleProgressNow(active) : null);
	let summary = $derived(active ? cycleWeeksSummary(active, $live.history) : []);
	/** Default name equals the page title, so the summary only repeats a renamed cycle. */
	let nameAddsInfo = $derived(
		Boolean(active) &&
			(active?.name ?? '').trim().toLowerCase() !==
				translate(lang, 'cycle.title').trim().toLowerCase()
	);
	let plansById = $derived(new Map($plans.map((plan) => [plan.id, plan])));
	let totalPlanned = $derived(active ? active.weeks * active.planIds.length : 0);
	let totalDone = $derived(summary.reduce((sum, week) => sum + week.done, 0));
	let currentWeek = $derived(progress?.week ?? 1);
	let currentSummary = $derived(summary.find((week) => week.isCurrent) ?? null);

	let draftName = $state('');
	let draftGoal = $state<AthleteGoalId>('muscle');
	let draftWeeks = $state<CycleLength>(10);
	let draftPlanIds = $state<string[]>([]);
	let expandedWeek = $state<number | null>(null);
	/** Day (plan) whose prescription is open inside the expanded week. */
	let expandedDay = $state<string | null>(null);
	let resetOpen = $state(false);
	let startingPlanId = $state<string | null>(null);
	/** Catalog rows for names and equipment (bar weight / plate step). */
	let exerciseIndex = $state<ExerciseIndexItem[]>(peekExerciseIndexWithCustoms() ?? []);
	let exerciseById = $derived(new Map(exerciseIndex.map((item) => [item.id, item])));

	function equipmentFor(exerciseId: string): string | null {
		return exerciseById.get(exerciseId)?.equipment ?? null;
	}

	function exerciseLabel(exerciseId: string): string {
		const item = exerciseById.get(exerciseId);
		return item ? exerciseName(item, lang) : exerciseId;
	}

	/** Timed sets prescribe a duration, so the row says «3 × 45 сек» / «3 × 20 мин». */
	function planExerciseMeasure(
		plan: WorkoutPlan,
		exerciseId: string
	): WorkoutExercise['measure'] {
		const ex = plan.exercises.find((row) => row.exerciseId === exerciseId);
		return ex ? measureOf(ex, exerciseById.get(exerciseId)) : undefined;
	}

	/** Sets/reps of the week plus the load the athlete's own history calls for. */
	function targetRows(plan: WorkoutPlan, week: number) {
		if (!active) return [];
		return cycleWeekTargets(plan, week, active, {
			sessions: $live.history,
			equipmentFor
		});
	}

	function goalLabel(id: AthleteGoalId): string {
		return translate(lang, `intake.goal.${id}`);
	}

	function kindLabel(kind: CycleWeekKind): string {
		return translate(lang, `cycle.kind.${kind}`);
	}

	function startDateLabel(dayKey: string): string {
		const date = new Date(`${dayKey}T00:00:00`);
		return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' }).format(date);
	}

	function togglePlan(planId: string) {
		draftPlanIds = draftPlanIds.includes(planId)
			? draftPlanIds.filter((id) => id !== planId)
			: [...draftPlanIds, planId];
	}

	function onCreate() {
		if (draftPlanIds.length === 0) return;
		const name =
			clampPlanName(draftName.trim()) || translate(lang, 'cycle.defaultName');
		cycle.save(
			newCycle({ name, weeks: draftWeeks, goal: draftGoal, planIds: draftPlanIds })
		);
		draftName = '';
		expandedWeek = 1;
		expandedDay = null;
		toasts.show(translate(lang, 'cycle.createdToast'), 'success');
	}

	function onReset() {
		resetOpen = false;
		cycle.reset();
		expandedWeek = null;
		expandedDay = null;
		draftPlanIds = [];
		toasts.show(translate(lang, 'cycle.resetToast'), 'success');
	}

	function toggleWeek(week: number) {
		// One open week, one open day inside it: folding the week also drops the
		// open day, so the next week cannot open with a leftover plan expanded.
		expandedDay = null;
		expandedWeek = expandedWeek === week ? null : week;
	}

	function toggleDay(planId: string) {
		expandedDay = expandedDay === planId ? null : planId;
	}

	async function startWeekPlan(week: number, plan: WorkoutPlan) {
		if (!active || startingPlanId) return;
		const alreadyActive = readActiveSession();
		if (alreadyActive && !alreadyActive.finishedAt) {
			toasts.show(translate(lang, 'cycle.activeSession'), 'error');
			return;
		}
		startingPlanId = plan.id;
		try {
			const variant = cycleWeekVariant(plan, week, active, {
				weekLabel: translate(lang, 'cycle.variantTag', { week })
			});
			const targets = cycleWeekTargets(plan, week, active, {
				sessions: $live.history,
				equipmentFor
			});
			// The week's sets/reps/load land in the started session, not only on screen.
			await live.startFromPlan(variant, {
				lockPrescription: true,
				weights: cycleTargetWeights(targets)
			});
			toasts.show(translate(lang, 'cycle.startToast', { week }), 'success');
			await goto(`/live/${plan.id}`);
		} finally {
			startingPlanId = null;
		}
	}

	onMount(() => {
		const goals = get(athleteProfile).goals;
		if (goals[0]) draftGoal = goals[0];
		const current = get(cycle);
		if (current) expandedWeek = cycleProgressNow(current).week;
		void loadExerciseIndexWithCustoms()
			.then((items) => (exerciseIndex = items))
			.catch(() => {
				// Names fall back to exercise ids; weights fall back to the default plate step.
			});
	});
</script>

<SeoHead title={translate(lang, 'cycle.title')} noindex />

<section class="content-page content-page--narrow cycle-page">
	<ScreenHeader
		title={translate(lang, 'cycle.title')}
		backHref="/workouts"
		backLabelVisible
		preferHistoryBack
	/>

	<p class="cycle-lead">{translate(lang, 'cycle.lead')}</p>

	{#if !active}
		{#if $plans.length === 0}
			<EmptyState
				centered
				title={translate(lang, 'cycle.plansEmpty')}
				description={translate(lang, 'cycle.createHint')}
				actionHref={BUILDER_NEW_HREF}
				actionLabel={translate(lang, 'cycle.plansEmptyCta')}
			/>
		{:else}
			<AppPanel class="cycle-setup">
				<p class="cycle-setup__lead">{translate(lang, 'cycle.createHint')}</p>

				<label class="cycle-field">
					<span class="cycle-field__label">{translate(lang, 'cycle.nameLabel')}</span>
					<AppInput
						bind:value={draftName}
						maxlength={48}
						placeholder={translate(lang, 'cycle.namePlaceholder')}
					/>
				</label>

				<div class="cycle-field">
					<span class="cycle-field__label">{translate(lang, 'cycle.goalLabel')}</span>
					<div class="cycle-chips">
						{#each ATHLETE_GOAL_IDS as goalId (goalId)}
							<AppChip active={draftGoal === goalId} onclick={() => (draftGoal = goalId)}>
								{goalLabel(goalId)}
							</AppChip>
						{/each}
					</div>
				</div>

				<div class="cycle-field">
					<span class="cycle-field__label">{translate(lang, 'cycle.lengthLabel')}</span>
					<div class="cycle-chips">
						{#each CYCLE_LENGTHS as weeks (weeks)}
							<AppChip active={draftWeeks === weeks} onclick={() => (draftWeeks = weeks)}>
								{translate(lang, 'cycle.weeksShort', { n: weeks })}
							</AppChip>
						{/each}
					</div>
				</div>

				<div class="cycle-field">
					<span class="cycle-field__label">{translate(lang, 'cycle.plansLabel')}</span>
					<p class="cycle-field__hint">{translate(lang, 'cycle.plansHint')}</p>
					<ul class="cycle-plans">
						{#each $plans as plan (plan.id)}
							{@const order = draftPlanIds.indexOf(plan.id)}
							<li>
								<button
									type="button"
									class="cycle-plan-row"
									class:cycle-plan-row--active={order >= 0}
									aria-pressed={order >= 0}
									onclick={() => togglePlan(plan.id)}
								>
									<span class="cycle-plan-row__order" aria-hidden="true">
										{order >= 0 ? order + 1 : ''}
									</span>
									<span class="cycle-plan-row__main">
										<span class="cycle-plan-row__name">{plan.name}</span>
										<span class="cycle-plan-row__meta">
											{translatePlural(lang, 'home.pillExercises', planExerciseSlotCount(plan))}
										</span>
									</span>
									<span class="cycle-plan-row__check" aria-hidden="true">
										{#if order >= 0}
											<LucideIcon icon={Check} size={ICON_SMALL} />
										{/if}
									</span>
								</button>
							</li>
						{/each}
					</ul>
					{#if draftPlanIds.length > 0}
						<p class="cycle-field__hint">
							{translate(lang, 'cycle.selected', { n: draftPlanIds.length })}
						</p>
					{/if}
				</div>

				<p class="cycle-field__hint cycle-field__hint--start">
					{translate(lang, 'cycle.startLabel')}:
					{translate(lang, 'cycle.startValue', { date: startDateLabel(defaultCycleStartDate()) })}
				</p>

				<AppButton
					block
					class="fx-cta-sheen"
					disabled={draftPlanIds.length === 0}
					onclick={onCreate}
				>
					{translate(lang, 'cycle.createCta')}
				</AppButton>
				<p class="cycle-hint">{translate(lang, 'cycle.localHint')}</p>
			</AppPanel>
		{/if}
	{:else}
		<AppPanel class="cycle-summary">
			<p class="cycle-summary__eyebrow">
				{goalLabel(active.goal)} · {translate(lang, 'cycle.weeksShort', { n: active.weeks })}
			</p>
			{#if nameAddsInfo}
				<p class="cycle-summary__title">{active.name}</p>
			{/if}
			{#if progress}
				<p class="cycle-summary__week">
					{translate(lang, 'cycle.cardWeek', { week: currentWeek, total: active.weeks })}
					{#if currentSummary}
						<span class="cycle-summary__kind">{kindLabel(currentSummary.kind)}</span>
					{/if}
				</p>
			{/if}
			<div
				class="cycle-bar"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={totalPlanned}
				aria-valuenow={totalDone}
				aria-label={translate(lang, 'cycle.totalDone', {
					done: totalDone,
					planned: totalPlanned
				})}
			>
				<span
					class="cycle-bar__fill"
					style:width="{totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0}%"
				></span>
			</div>
			<p class="cycle-summary__meta">
				{translate(lang, 'cycle.totalDone', { done: totalDone, planned: totalPlanned })}
			</p>
			{#if progress?.done}
				<div class="cycle-finished">
					<p class="cycle-finished__title">{translate(lang, 'cycle.finishedTitle')}</p>
					<p class="cycle-finished__hint">{translate(lang, 'cycle.finishedHint')}</p>
				</div>
			{/if}
		</AppPanel>

		<AppPanel class="cycle-chart-panel">
			<div class="cycle-legend">
				<span class="cycle-legend__item">
					<span class="cycle-legend__swatch cycle-legend__swatch--volume"></span>
					{translate(lang, 'cycle.legendVolume')}
				</span>
				<span class="cycle-legend__item">
					<span class="cycle-legend__swatch cycle-legend__swatch--intensity"></span>
					{translate(lang, 'cycle.legendIntensity')}
				</span>
			</div>
			<CycleWaveChart
				weeks={summary}
				label={translate(lang, 'cycle.chartLabel', { n: active.weeks })}
			/>
		</AppPanel>

		<ul class="cycle-weeks">
			{#each summary as week (week.week)}
				{@const open = expandedWeek === week.week}
				{@const rows = open
					? cycleWeekPlanRows(active, week.week, $plans, $live.history)
					: []}
				<li class="cycle-week" class:cycle-week--now={week.isCurrent}>
					<button
						type="button"
						class="cycle-week__head"
						aria-expanded={open}
						onclick={() => toggleWeek(week.week)}
					>
						<span class="cycle-week__main">
							<span class="cycle-week__title">
								{translate(lang, 'cycle.weekRow', { week: week.week })}
								<span class="cycle-week__kind">{kindLabel(week.kind)}</span>
							</span>
							<span class="cycle-week__meta">
								{translate(lang, 'cycle.waveMeta', {
									volume: week.volumePct,
									intensity: week.intensityPct
								})}
							</span>
						</span>
						<span class="cycle-week__done">
							{translate(lang, 'cycle.doneOf', { done: week.done, planned: week.planned })}
						</span>
					</button>
					{#if open}
						<ul class="cycle-week__plans">
							{#each rows as row (row.planId)}
								{@const plan = plansById.get(row.planId)}
								{@const dayOpen = !!plan && expandedDay === row.planId}
								{@const targets = dayOpen && plan ? targetRows(plan, week.week) : []}
								<li class="cycle-week__plan" class:cycle-week__plan--open={dayOpen}>
									<div class="cycle-week__plan-head">
										{#if plan}
											<button
												type="button"
												class="cycle-week__plan-toggle"
												aria-expanded={dayOpen}
												onclick={() => toggleDay(row.planId)}
											>
												<span class="cycle-week__plan-main">
													<span class="cycle-week__plan-name">{row.planName}</span>
													<span class="cycle-week__plan-meta">
														{translatePlural(
															lang,
															'home.pillExercises',
															planExerciseSlotCount(plan)
														)}
													</span>
												</span>
												<span class="cycle-week__plan-chevron" aria-hidden="true">
													<LucideIcon icon={CaretDown} size={ICON_SMALL} />
												</span>
											</button>
										{:else}
											<span class="cycle-week__plan-main">
												<span class="cycle-week__plan-name">{row.planName}</span>
											</span>
										{/if}
										{#if row.done}
											<span class="cycle-week__plan-done">
												<LucideIcon icon={Check} size={ICON_SMALL} />
												{translate(lang, 'cycle.donePlan')}
											</span>
										{:else if plan}
											<AppButton
												variant="secondary"
												class="cycle-week__plan-cta"
												disabled={startingPlanId !== null}
												aria-busy={startingPlanId === plan.id}
												onclick={() => void startWeekPlan(week.week, plan)}
											>
												<LucideIcon icon={Play} size={ICON_SMALL} />
												{translate(lang, 'cycle.start')}
											</AppButton>
										{:else}
											<span class="cycle-week__plan-done">{translate(lang, 'live.noPlan')}</span>
										{/if}
									</div>
									{#if dayOpen && plan}
										{#if targets.length > 0}
											<ul
												class="cycle-week__rx"
												aria-label={translate(lang, 'cycle.prescriptionTitle')}
											>
												{#each targets as target, ti (ti)}
													<li class="cycle-week__rx-row">
														<span class="cycle-week__rx-name">
															{exerciseLabel(target.exerciseId)}
														</span>
														<span class="cycle-week__rx-nums">
															<span class="cycle-week__rx-sets">
																{translate(
																	lang,
																	planExerciseMeasure(plan, target.exerciseId) === 'minutes'
																		? 'cycle.prescriptionMinutes'
																		: planExerciseMeasure(plan, target.exerciseId) === 'seconds'
																			? 'cycle.prescriptionSeconds'
																			: 'cycle.prescriptionSets',
																	{
																		sets: target.sets,
																		reps: target.reps,
																		n: target.reps
																	}
																)}
															</span>
															{#if target.weightKg != null}
																<span class="cycle-week__rx-load">
																	{translate(lang, 'cycle.prescriptionLoad', {
																		weight: target.weightKg
																	})}
																</span>
																{#if target.barKg > 0}
																	<span class="cycle-week__rx-bar">
																		{translate(lang, 'cycle.prescriptionBar', {
																			weight: target.barKg
																		})}
																	</span>
																{/if}
															{:else}
																<span
																	class="cycle-week__rx-load cycle-week__rx-load--open"
																>
																	{translate(lang, 'cycle.prescriptionOpen')}
																</span>
															{/if}
														</span>
													</li>
												{/each}
											</ul>
											<p class="cycle-week__rx-total">
												{translate(lang, 'cycle.setsTotal', {
													n: cycleTargetSetCount(targets)
												})}
											</p>
										{/if}
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>

		<div class="cycle-footer">
			<AppButton variant="secondary" block onclick={() => (resetOpen = true)}>
				{translate(lang, 'cycle.reset')}
			</AppButton>
			<p class="cycle-hint">{translate(lang, 'cycle.localHint')}</p>
		</div>
	{/if}
</section>

<ConfirmSheet
	open={resetOpen}
	titleId="cycle-reset-title"
	title={translate(lang, 'cycle.resetTitle')}
	hint={translate(lang, 'cycle.resetHint')}
	confirmLabel={translate(lang, 'cycle.resetConfirm')}
	onConfirm={onReset}
	onDismiss={() => (resetOpen = false)}
/>
