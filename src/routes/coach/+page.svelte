<script lang="ts">
	import '$lib/styles/blocks/coach.css';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { buildCoachHints, suggestPlanReplace } from '$lib/domain/coachHints';
	import { computeProgressOverview } from '$lib/domain/progressOverview';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelBodyPart } from '$lib/domain/labels.ru';
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

	let replace = $derived.by(() => {
		if (!homePlan || indexById.size === 0 || !overview.laggingBodyPart) return null;
		return suggestPlanReplace(
			homePlan.exercises.map((ex) => ex.exerciseId),
			[overview.laggingBodyPart],
			[...indexById.values()],
			(id) => indexById.get(id)?.body_part ?? null
		);
	});

	let replaceSharePct = $derived.by(() => {
		if (!replace) return null;
		return overview.bodyParts.find((part) => part.bodyPart === replace.bodyPart)?.sharePct ?? null;
	});

	let hints = $derived.by(() => {
		const finished = $live.history
			.filter((s) => s.finishedAt)
			.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
		const focus = finished[0];
		if (!focus || indexById.size === 0) return [];
		const catalog = [...indexById.values()];
		const bodyPartFor = (id: string) => indexById.get(id)?.body_part ?? null;
		return buildCoachHints(focus, finished, catalog, bodyPartFor, { planExerciseIds });
	});

	let visibleHints = $derived(hints.filter((hint) => !hintHidden($coachHidden, hint.bodyPart)));

	/** One card up top, the rest behind "show more". */
	let shownHints = $derived(hintsExpanded ? visibleHints : visibleHints.slice(0, 1));

	let balanceRows = $derived(overview.bodyParts.slice(0, 4));

	let laggingParts = $derived(new Set(visibleHints.map((hint) => hint.bodyPart)));

	async function replaceHint() {
		if (!replace) return;
		try {
			const planId = await replaceExerciseInHomePlan(replace.fromExerciseId, replace.toExerciseId);
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
</script>

<SeoHead title={translate(lang, 'nav.coach')} noindex />

<section class="content-page content-page--narrow pb-mobile-actions">
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
		<PageSkeleton rows={2} />
	{:else}
		{#if balanceRows.length > 0}
			<AppPanel class="coach-balance text-left">
				<div class="coach-balance__head">
					<p class="coach-balance__title">{translate(lang, 'coach.balanceTitle')}</p>
					<a href="/progress" class="coach-balance__link">
						{translate(lang, 'home.progressOpen')}
					</a>
				</div>
				<p class="coach-balance__hint">{translate(lang, 'coach.balanceHint')}</p>
				<ul class="coach-balance__list">
					{#each balanceRows as row (row.bodyPart)}
						<li
							class="coach-balance__row"
							class:is-lagging={laggingParts.has(row.bodyPart)}
						>
							<span class="coach-balance__part">{labelBodyPart(row.bodyPart, lang)}</span>
							<span class="coach-balance__track" aria-hidden="true">
								<span
									class="coach-balance__fill"
									style={`width:${Math.max(row.sharePct, 2)}%`}
								></span>
							</span>
							<span class="coach-balance__pct">{row.sharePct}%</span>
						</li>
					{/each}
				</ul>
			</AppPanel>
		{/if}

		{#if visibleHints.length === 0 && !replace}
			<AppPanel class="text-left">
				<p class="coach-muted">
					{translate(lang, finishedCount === 0 ? 'coach.empty' : 'coach.nothingYet')}
				</p>
				{#if finishedCount === 0}
					<a href="/" class="btn-primary coach-empty-cta">
						{translate(lang, 'coach.emptyCta')}
					</a>
				{/if}
			</AppPanel>
		{:else}
			{#each shownHints as hint (hint.id)}
				{@const meta = indexById.get(hint.exerciseId)}
				<AppPanel class="coach-card text-left">
					<p class="coach-card__title">
						{meta ? exerciseName(meta, lang) : hint.exerciseId}
					</p>
					<p class="coach-card__meta">
						{labelBodyPart(hint.bodyPart, lang)} · {translate(lang, 'coach.hintShare', {
							pct: hint.sharePct
						})}
					</p>
					<p class="coach-why">{translate(lang, hint.reasonKey)}</p>
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
				<AppPanel class="coach-card text-left">
					<p class="coach-card__title">
						{fromMeta ? exerciseName(fromMeta, lang) : replace.fromExerciseId}
					</p>
					<p class="coach-card__meta">
						→ {toMeta ? exerciseName(toMeta, lang) : replace.toExerciseId}
					</p>
					<p class="coach-card__meta">{labelBodyPart(replace.bodyPart, lang)}</p>
					<p class="coach-why">
						{replaceSharePct != null
							? translate(lang, 'coach.replaceWhy', {
									part: labelBodyPart(replace.bodyPart, lang),
									pct: replaceSharePct
								})
							: translate(lang, 'coach.replaceWhyGeneric')}
					</p>
					<p class="coach-why">{translate(lang, 'coach.replaceWhat')}</p>
					<AppButton onclick={() => void replaceHint()}>
						{translate(lang, 'coach.replace')}
					</AppButton>
				</AppPanel>
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
