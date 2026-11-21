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
	import { Check, Play } from 'phosphor-svelte';
	import { ATHLETE_GOAL_IDS, type AthleteGoalId } from '$lib/domain/athleteProfile';
	import { BUILDER_NEW_HREF } from '$lib/domain/catalogLinks';
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
	import { clampPlanName } from '$lib/domain/inputLimits';
	import type { WorkoutPlan } from '$lib/domain/types';
	import { planExerciseSlotCount } from '$lib/domain/workout';
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
	let resetOpen = $state(false);
	let startingPlanId = $state<string | null>(null);

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
		toasts.show(translate(lang, 'cycle.createdToast'), 'success');
	}

	function onReset() {
		resetOpen = false;
		cycle.reset();
		expandedWeek = null;
		draftPlanIds = [];
		toasts.show(translate(lang, 'cycle.resetToast'), 'success');
	}

	function toggleWeek(week: number) {
		expandedWeek = expandedWeek === week ? null : week;
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
			await live.startFromPlan(variant, { lockPrescription: true });
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
			<p class="cycle-summary__title">{active.name}</p>
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
								<li class="cycle-week__plan">
									<span class="cycle-week__plan-name">{row.planName}</span>
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
