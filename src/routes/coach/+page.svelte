<script lang="ts">
	import '$lib/styles/blocks/coach.css';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { BorderBeam, MetalFx } from '$lib/components/fx';
	import { suggestPlanReplace } from '$lib/domain/coachHints';
	import { buildCoachInsights, insightZones, type CoachInsight } from '$lib/domain/coachInsights';
	import { computeProgressOverview } from '$lib/domain/progressOverview';
	import {
		WEEKLY_SETS_AIM,
		pickCatalogExerciseForBodyPart,
		weeklySetsByZone
	} from '$lib/domain/trainingLoad';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelCatalogZone } from '$lib/domain/catalogLinks';
	import { loadExerciseIndexWithCustoms } from '$lib/data/exerciseIndexWithCustoms';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { translate, translateError } from '$lib/i18n/messages';
	import { pluralRu } from '$lib/i18n/plural';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import {
		appendExerciseToPlan,
		removeExerciseFromPlan,
		replaceExerciseInHomePlan
	} from '$lib/workout/planPatch';
	import { homeNextPlan } from '$lib/stores/homeNextPlan';
	import { live } from '$lib/stores/live';
	import { plans } from '$lib/stores/plans';
	import { coachHidden, hideHint, hintHidden, markCoachSeen, unhideHint } from '$lib/stores/coachHints';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);
	let indexById = $state(new Map<string, ExerciseIndexItem>());
	let indexReady = $state(false);
	let hintsExpanded = $state(false);
	let planSheetOpen = $state(false);
	let planSheetBusy = $state(false);
	let pendingExerciseId = $state<string | null>(null);

	onMount(() => {
		markCoachSeen();
		void loadExerciseIndexWithCustoms()
			.then((index) => {
				indexById = new Map(index.map((ex) => [ex.id, ex]));
			})
			.finally(() => {
				// Even a failed load must not leave the page stuck on the skeleton.
				indexReady = true;
			});
	});

	let homePlan = $derived.by(() => {
		const list = $plans;
		const pinned = $homeNextPlan;
		return (pinned ? list.find((p) => p.id === pinned) : null) ?? list[0] ?? null;
	});

	let overview = $derived(
		computeProgressOverview($live.history, new Date(), (id) => indexById.get(id)?.body_part ?? null)
	);

	let finishedCount = $derived($live.history.filter((s) => s.finishedAt).length);

	let reviewedLine = $derived(
		lang === 'ru'
			? translate(lang, 'coach.reviewed', {
					n: `${overview.workouts30d} ${pluralRu(overview.workouts30d, [
						'тренировку',
						'тренировки',
						'тренировок'
					])}`
				})
			: translate(lang, 'coach.reviewed', {
					n: `${overview.workouts30d} ${overview.workouts30d === 1 ? 'workout' : 'workouts'}`
				})
	);

	/** Never suggest an exercise the user already runs in any plan. */
	let planExerciseIds = $derived(
		$plans.flatMap((plan) => plan.exercises.map((ex) => ex.exerciseId))
	);

	let finishedHistory = $derived(
		$live.history
			.filter((s) => s.finishedAt)
			.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
	);

	/**
	 * Working sets per zone over 7 days, thinnest first. The old panel showed a
	 * 30-day volume share, which reads as a verdict and punishes small groups;
	 * weekly sets against the 10+ aim is the metric the summary already uses.
	 */
	let weeklySets = $derived.by(() => {
		if (indexById.size === 0) return { rows: [], byZone: new Map<string, number>() };
		const rows = weeklySetsByZone(finishedHistory, (id) => indexById.get(id)?.body_part ?? null);
		return { rows, byZone: new Map(rows.map((row) => [row.bodyPart, row.sets] as const)) };
	});

	let balanceRows = $derived(weeklySets.rows.slice(0, 4));

	function weeklyFor(zone: string): number {
		return weeklySets.byZone.get(zone) ?? 0;
	}

	/** Zones still short of the weekly aim, thinnest first. */
	let weeklyGaps = $derived(
		weeklySets.rows.filter((row) => row.sets < WEEKLY_SETS_AIM).map((row) => row.bodyPart)
	);

	/**
	 * Deeper cards from `coachInsights`: progression, deload, volume spike,
	 * skipped exercises, push/pull balance. They sit above the plain
	 * "lagging group" hints because they say what to actually change today.
	 */
	let insights = $derived.by(() => {
		if (indexById.size === 0) return [];
		return buildCoachInsights(finishedHistory, {
			planExerciseIds: homePlan?.exercises.map((ex) => ex.exerciseId) ?? [],
			allPlanExerciseIds: planExerciseIds,
			catalog: [...indexById.values()],
			equipmentFor: (id) => indexById.get(id)?.equipment ?? null,
			bodyPartFor: (id) => indexById.get(id)?.body_part ?? null
		});
	});

	let visibleInsights = $derived(insights.filter((item) => !hintHidden($coachHidden, item.scope)));

	/**
	 * Swap a plan exercise from a zone that is short this week. Same idea as
	 * `coachHints.suggestPlanReplace`, but the signal is weekly sets, so the
	 * replace card and the panel above always agree. Zones that already have a
	 * deep insight card are skipped: the advice would repeat itself.
	 */
	let replace = $derived.by(() => {
		const taken = new Set(insightZones(visibleInsights));
		const lagging = weeklyGaps.filter((zone) => !taken.has(zone));
		if (!homePlan || indexById.size === 0 || lagging.length === 0) return null;
		return suggestPlanReplace(
			homePlan.exercises.map((ex) => ex.exerciseId),
			lagging,
			[...indexById.values()],
			(id) => indexById.get(id)?.body_part ?? null
		);
	});

	type WeeklyHint = { id: string; bodyPart: string; exerciseId: string; sets: number };

	/**
	 * Add-cards for zones below the weekly aim. Zones that already have a card
	 * (deep insight or replace) are skipped, and exercises already in any plan
	 * are never proposed again.
	 */
	let hints = $derived.by((): WeeklyHint[] => {
		if (indexById.size === 0) return [];
		const catalog = [...indexById.values()];
		const exclude = new Set(planExerciseIds);
		const skip = new Set([
			...(replace ? [replace.bodyPart] : []),
			...insightZones(visibleInsights)
		]);
		const out: WeeklyHint[] = [];
		for (const zone of weeklyGaps) {
			if (skip.has(zone)) continue;
			const exerciseId = pickCatalogExerciseForBodyPart(catalog, zone, exclude);
			if (!exerciseId) continue;
			out.push({
				id: `weekly-${zone}-${exerciseId}`,
				bodyPart: zone,
				exerciseId,
				sets: weeklyFor(zone)
			});
			if (out.length >= 3) break;
		}
		return out;
	});

	let visibleHints = $derived(hints.filter((hint) => !hintHidden($coachHidden, hint.bodyPart)));

	/** One card up top, the rest behind "show more". */
	let shownHints = $derived(hintsExpanded ? visibleHints : visibleHints.slice(0, 1));

	let laggingParts = $derived.by(() => {
		const parts = new Set(visibleHints.map((hint) => hint.bodyPart));
		if (replace) parts.add(replace.bodyPart);
		for (const zone of insightZones(visibleInsights)) parts.add(zone);
		return parts;
	});

	async function replaceHint() {
		if (!replace) return;
		await applyReplace(replace.fromExerciseId, replace.toExerciseId);
	}

	async function replaceInsight(insight: CoachInsight) {
		const action = insight.action;
		if (action.type !== 'replace') return;
		await applyReplace(action.fromExerciseId, action.toExerciseId);
	}

	async function applyReplace(fromExerciseId: string, toExerciseId: string) {
		try {
			const planId = await replaceExerciseInHomePlan(fromExerciseId, toExerciseId);
			if (!planId) {
				toasts.show(translate(lang, 'coach.noPlan'), 'error');
				return;
			}
			toasts.show(translate(lang, 'coach.replaced'), 'success');
			await goto(`/builder/${planId}`);
		} catch (err) {
			toasts.show(translateError(lang, err, 'common.error'), 'error');
		}
	}

	function openPlanSheet(exerciseId: string) {
		pendingExerciseId = exerciseId;
		planSheetOpen = true;
	}

	async function addToPlan(planId: string) {
		const exerciseId = pendingExerciseId;
		if (!exerciseId || planSheetBusy) return;
		planSheetBusy = true;
		try {
			const patch = await appendExerciseToPlan(planId, exerciseId);
			if (!patch) {
				toasts.show(translate(lang, 'coach.noPlan'), 'error');
				return;
			}
			planSheetOpen = false;
			if (!patch.added) {
				toasts.show(translate(lang, 'coach.added'), 'success');
				return;
			}
			const planName =
				$plans.find((plan) => plan.id === planId)?.name.trim() ||
				translate(lang, 'workouts.newName');
			toasts.showUndo(
				translate(lang, 'coach.addedNamed', { plan: planName }),
				async () => {
					await removeExerciseFromPlan(planId, exerciseId);
				},
				'success'
			);
		} catch (err) {
			toasts.show(translateError(lang, err, 'common.error'), 'error');
		} finally {
			planSheetBusy = false;
		}
	}

	function hideRow(bodyPart: string) {
		hideHint(bodyPart);
		toasts.showUndo(translate(lang, 'coach.hidden'), () => {
			unhideHint(bodyPart);
		});
	}

	function hideScope(scope: string) {
		hideHint(scope);
		toasts.showUndo(translate(lang, 'coach.hidden'), () => {
			unhideHint(scope);
		});
	}
</script>

<SeoHead title={translate(lang, 'nav.coach')} noindex />

<section class="content-page content-page--narrow">
	<ScreenHeader
		title={translate(lang, 'nav.coach')}
		backHref="/auth"
		backLabelVisible
		preferHistoryBack
	/>
	<p class="coach-lead">{translate(lang, 'coach.lead')}</p>
	{#if overview.workouts30d > 0}
		<p class="coach-lead">{reviewedLine}</p>
	{/if}
	{#if !indexReady}
		<PageSkeleton variant="coach" showBalance={overview.workouts30d > 0} />
	{:else}
		{#if balanceRows.length > 0}
			<BorderBeam size="sm" class="coach-fx-beam">
				<AppPanel class="coach-balance text-left">
					<div class="coach-balance__head">
						<p class="coach-balance__title">{translate(lang, 'coach.weekSetsTitle')}</p>
						<a href="/progress" class="coach-balance__link">
							{translate(lang, 'home.progressOpen')}
						</a>
					</div>
					<p class="coach-balance__hint">
						{translate(lang, 'coach.weekSetsHint', { aim: WEEKLY_SETS_AIM })}
					</p>
					<ul class="coach-balance__list">
						{#each balanceRows as row (row.bodyPart)}
							<li
								class="coach-balance__row"
								class:is-lagging={laggingParts.has(row.bodyPart)}
							>
								<span class="coach-balance__part">{labelCatalogZone(row.bodyPart, lang)}</span>
								<span class="coach-balance__track" aria-hidden="true">
									<span
										class="coach-balance__fill"
										style={`width:${Math.min(100, Math.max(Math.round((row.sets / WEEKLY_SETS_AIM) * 100), 2))}%`}
									></span>
								</span>
								<span class="coach-balance__pct">{row.sets}</span>
							</li>
						{/each}
					</ul>
				</AppPanel>
			</BorderBeam>
		{/if}

		{#each visibleInsights as insight (insight.id)}
			{@const meta = insight.exerciseId ? indexById.get(insight.exerciseId) : null}
			{@const action = insight.action}
			<AppPanel class="coach-card text-left">
				<p class="coach-card__title">{translate(lang, insight.titleKey, insight.titleParams)}</p>
				{#if meta}
					<p class="coach-card__meta">
						{translate(
							lang,
							'coach.insightMeta',
							{
								name: exerciseName(meta, lang),
								part: insight.zone ? labelCatalogZone(insight.zone, lang) : '',
								drops: insight.whyParams.drops ?? '',
								total: insight.whyParams.total ?? ''
							}
						)}
					</p>
				{/if}
				<p class="coach-why">{translate(lang, insight.whyKey, insight.whyParams)}</p>
				<div class="coach-card__actions">
					{#if action.type === 'add'}
						<AppButton onclick={() => openPlanSheet(action.exerciseId)}>
							{translate(lang, 'coach.addToPlan')}
						</AppButton>
					{:else if action.type === 'replace'}
						<AppButton onclick={() => void replaceInsight(insight)}>
							{translate(lang, 'coach.replace')}
						</AppButton>
					{/if}
					<button
						type="button"
						class="coach-card__hide"
						onclick={() => hideScope(insight.scope)}
					>
						{translate(lang, 'coach.hideHint')}
					</button>
				</div>
			</AppPanel>
		{/each}

		{#if visibleHints.length === 0 && visibleInsights.length === 0 && !replace}
			<BorderBeam size="sm" class="coach-fx-beam">
				<AppPanel class="text-left">
					<p class="coach-muted">
						{translate(lang, finishedCount === 0 ? 'coach.empty' : 'coach.nothingYet')}
					</p>
					{#if finishedCount === 0}
						<MetalFx class="coach-empty-cta-wrap">
							<a href="/" class="btn-primary coach-empty-cta fx-cta-sheen">
								{translate(lang, 'coach.emptyCta')}
							</a>
						</MetalFx>
					{/if}
				</AppPanel>
			</BorderBeam>
		{:else}
			{#each shownHints as hint, hintIndex (hint.id)}
				{@const meta = indexById.get(hint.exerciseId)}
				{#if hintIndex === 0}
					<BorderBeam size="sm" class="coach-fx-beam">
						<AppPanel class="coach-card text-left">
							<p class="coach-card__title">
								{meta ? exerciseName(meta, lang) : hint.exerciseId}
							</p>
							<p class="coach-card__meta">
								{translate(lang, 'coach.hintWeeklyMeta', {
									part: labelCatalogZone(hint.bodyPart, lang),
									sets: hint.sets,
									aim: WEEKLY_SETS_AIM
								})}
							</p>
							<p class="coach-why">
								{translate(lang, 'coach.hintWeeklyWhy', { aim: WEEKLY_SETS_AIM })}
							</p>
							<div class="coach-card__actions">
								<MetalFx>
									<AppButton class="fx-cta-sheen" onclick={() => openPlanSheet(hint.exerciseId)}>
										{translate(lang, 'coach.addToPlan')}
									</AppButton>
								</MetalFx>
								<button
									type="button"
									class="coach-card__hide"
									onclick={() => hideRow(hint.bodyPart)}
								>
									{translate(lang, 'coach.hideHint')}
								</button>
							</div>
						</AppPanel>
					</BorderBeam>
				{:else}
					<AppPanel class="coach-card text-left">
						<p class="coach-card__title">
							{meta ? exerciseName(meta, lang) : hint.exerciseId}
						</p>
						<p class="coach-card__meta">
							{translate(lang, 'coach.hintWeeklyMeta', {
								part: labelCatalogZone(hint.bodyPart, lang),
								sets: hint.sets,
								aim: WEEKLY_SETS_AIM
							})}
						</p>
						<p class="coach-why">
							{translate(lang, 'coach.hintWeeklyWhy', { aim: WEEKLY_SETS_AIM })}
						</p>
						<div class="coach-card__actions">
							<AppButton onclick={() => openPlanSheet(hint.exerciseId)}>
								{translate(lang, 'coach.addToPlan')}
							</AppButton>
							<button
								type="button"
								class="coach-card__hide"
								onclick={() => hideRow(hint.bodyPart)}
							>
								{translate(lang, 'coach.hideHint')}
							</button>
						</div>
					</AppPanel>
				{/if}
			{/each}

			{#if visibleHints.length > 1}
				<button
					type="button"
					class="coach-hints-more"
					onclick={() => (hintsExpanded = !hintsExpanded)}
				>
					{hintsExpanded
						? translate(lang, 'coach.showLess')
						: translate(lang, 'coach.showMore', { n: visibleHints.length - 1 })}
				</button>
			{/if}

			{#if replace}
				{@const fromMeta = indexById.get(replace.fromExerciseId)}
				{@const toMeta = indexById.get(replace.toExerciseId)}
				<BorderBeam size="sm" class="coach-fx-beam">
					<AppPanel class="coach-card text-left">
						<p class="coach-card__title">
							{fromMeta ? exerciseName(fromMeta, lang) : replace.fromExerciseId}
						</p>
						<p class="coach-card__meta">
							→ {toMeta ? exerciseName(toMeta, lang) : replace.toExerciseId}
						</p>
						<p class="coach-card__meta">
							{translate(lang, 'coach.hintWeeklyMeta', {
								part: labelCatalogZone(replace.bodyPart, lang),
								sets: weeklyFor(replace.bodyPart),
								aim: WEEKLY_SETS_AIM
							})}
						</p>
						<p class="coach-why">
							{translate(lang, 'coach.replaceWhyWeekly', {
								part: labelCatalogZone(replace.bodyPart, lang),
								sets: weeklyFor(replace.bodyPart),
								aim: WEEKLY_SETS_AIM
							})}
						</p>
						<p class="coach-why">{translate(lang, 'coach.replaceWhat')}</p>
						<MetalFx>
							<AppButton class="fx-cta-sheen" onclick={() => void replaceHint()}>
								{translate(lang, 'coach.replace')}
							</AppButton>
						</MetalFx>
					</AppPanel>
				</BorderBeam>
			{/if}
		{/if}
	{/if}
</section>

<BottomSheet
	bind:open={planSheetOpen}
	titleId="coach-plan-title"
	onDismiss={() => (planSheetOpen = false)}
	dismissible={!planSheetBusy}
>
	<p id="coach-plan-title" class="bottom-sheet__title">
		{translate(lang, 'coach.addToPlan')}
	</p>
	{#if $plans.length === 0}
		<p class="bottom-sheet__hint">{translate(lang, 'coach.assignEmpty')}</p>
	{:else}
		<ul class="coach-assign-list">
			{#each $plans as plan (plan.id)}
				{@const hasExercise = pendingExerciseId
					? plan.exercises.some((ex) => ex.exerciseId === pendingExerciseId)
					: false}
				<li>
					<button
						type="button"
						class="coach-assign-row"
						disabled={hasExercise || planSheetBusy}
						onclick={() => void addToPlan(plan.id)}
					>
						<span class="coach-assign-row__name">
							{plan.name || translate(lang, 'workouts.newName')}
						</span>
						<span class="coach-assign-row__meta">
							{hasExercise
								? translate(lang, 'coach.planHasExercise')
								: translate(lang, 'coach.assignExercises', {
										n: plan.exercises.length
									})}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet actions()}
		<AppButton variant="secondary" onclick={() => (planSheetOpen = false)} disabled={planSheetBusy}>
			{translate(lang, 'common.cancel')}
		</AppButton>
	{/snippet}
</BottomSheet>

<style>
	.coach-lead {
		margin: 0 0 1rem;
		font-size: 0.9375rem;
		opacity: 0.8;
		line-height: 1.4;
	}
	.coach-muted {
		margin: 0;
		opacity: 0.75;
		line-height: 1.4;
	}
	.coach-empty-cta {
		display: inline-flex;
		margin-top: 0.75rem;
		min-height: 3rem;
		align-items: center;
	}
	:global(.coach-empty-cta-wrap) {
		display: inline-flex;
		margin-top: 0.75rem;
	}
	:global(.coach-empty-cta-wrap .coach-empty-cta) {
		margin-top: 0;
	}
	:global(.coach-fx-beam) {
		display: block;
		margin-bottom: 0.75rem;
		border-radius: var(--radius-panel);
	}
	:global(.coach-fx-beam .coach-card),
	:global(.coach-fx-beam .coach-balance) {
		margin-bottom: 0;
	}
	:global(.coach-card) {
		margin-bottom: 0.75rem;
	}
	.coach-card__title {
		margin: 0;
		font-weight: 800;
		font-size: 1.0625rem;
	}
	.coach-card__meta {
		margin: 0.35rem 0 0.35rem;
		font-size: 0.875rem;
		opacity: 0.75;
	}
	.coach-why {
		margin: 0 0 0.45rem;
		font-size: 0.8125rem;
		line-height: 1.35;
		opacity: 0.85;
	}
	.coach-card__actions {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.35rem;
	}
	.coach-card__hide {
		align-self: center;
		min-height: 2.5rem;
		padding: 0 0.75rem;
		border: 0;
		background: none;
		font: inherit;
		font-size: 0.8125rem;
		color: var(--color-muted);
		cursor: pointer;
	}
	.coach-card__hide:hover {
		color: var(--color-ink);
	}
	.coach-hints-more {
		display: block;
		width: 100%;
		min-height: 2.75rem;
		margin: -0.25rem 0 0.9rem;
		border: 0;
		border-radius: var(--radius-panel);
		background: var(--color-panel);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-accent-text);
		cursor: pointer;
	}
	:global(.coach-balance) {
		margin-bottom: 0.9rem;
	}
	.coach-balance__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.coach-balance__title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 700;
	}
	.coach-balance__link {
		font-size: 0.8125rem;
		color: var(--color-accent-text);
		text-decoration: none;
	}
	.coach-balance__hint {
		margin: 0.25rem 0 0.6rem;
		font-size: 0.75rem;
		line-height: 1.4;
		color: var(--color-muted);
	}
	.coach-balance__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.coach-balance__row {
		display: grid;
		grid-template-columns: minmax(0, 6.5rem) minmax(0, 1fr) 2.5rem;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		color: var(--color-secondary);
	}
	.coach-balance__row.is-lagging {
		color: var(--color-ink);
		font-weight: 600;
	}
	.coach-balance__part {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.coach-balance__track {
		height: 0.4rem;
		border-radius: 999px;
		background: var(--color-border);
		overflow: hidden;
	}
	.coach-balance__fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--color-muted);
	}
	.coach-balance__row.is-lagging .coach-balance__fill {
		background: var(--color-accent);
	}
	.coach-balance__pct {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	@media (prefers-reduced-motion: no-preference) {
		.coach-balance__fill {
			transition: width 0.3s ease;
		}
	}
</style>
