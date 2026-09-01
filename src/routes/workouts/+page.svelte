<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import CloudSyncBanner from '$lib/components/CloudSyncBanner.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ExerciseReorderHandle from '$lib/components/ExerciseReorderHandle.svelte';
	import BackupImportAction from '$lib/components/BackupImportAction.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import WorkoutsPageSkeleton from '$lib/components/WorkoutsPageSkeleton.svelte';
	import SwipeToDelete, { type SwipeRowAction } from '$lib/components/SwipeToDelete.svelte';
	import AppFab from '$lib/components/AppFab.svelte';
	import Coachmark from '$lib/components/onboarding/Coachmark.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { Copy, ArrowLeft, ClipboardList, Clock, Flag, Play, Plus, Trash2 } from '@lucide/svelte';
	import { loadExerciseIndex, peekExerciseIndex } from '$lib/data/loadExercises';
	import { peekLocalPlanCount } from '$lib/storage/localWorkoutRepository';
	import { peekLocalHistoryCount } from '$lib/storage/localSessionRepository';
	import type { WorkoutsSkeletonVariant } from '$lib/components/WorkoutsPageSkeleton.svelte';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { completedSetCount, sessionDurationMs } from '$lib/domain/session';
	import { planExerciseSlotCount, planTargetSummary, resolveHomeNextPlan } from '$lib/domain/workout';
	import { BUILDER_NEW_HREF } from '$lib/domain/catalogLinks';
	import { formatDurationMinutes, formatRelativeDay } from '$lib/i18n/format';
	import { translate, translateError } from '$lib/i18n/messages';
	import { navigateBack } from '$lib/navigation/back';
	import { auth } from '$lib/stores/auth';
	import { homeNextPlan } from '$lib/stores/homeNextPlan';
	import { live } from '$lib/stores/live';
	import { plans, plansReady, plansSync } from '$lib/stores/plans';
	import { planOrder } from '$lib/stores/planOrder';
	import { isCloudListUncertain } from '$lib/domain/cloudSync';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { onboarding } from '$lib/stores/onboarding';
	import { shouldShowCoachmark } from '$lib/domain/onboarding';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { cn } from '$lib/utils.js';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	let { data } = $props();

	type WorkoutsTab = 'plans' | 'history';

	function parseWorkoutsTab(value: string | null): WorkoutsTab {
		return value === 'history' ? 'history' : 'plans';
	}

	let lang = $derived($resolvedLocale);
	let showWorkoutsPreviewCoachmark = $derived(shouldShowCoachmark($onboarding, 'workouts.preview'));
	let activeTab = $derived(parseWorkoutsTab($page.url.searchParams.get('tab')));
	let searchQuery = $state('');
	const peeked = peekExerciseIndex();
	let indexById = $state<Map<string, ExerciseIndexItem>>(
		peeked ? new Map(peeked.map((item) => [item.id, item])) : new Map()
	);
	let indexReady = $state(peeked != null);

	let pageReady = $derived(
		$auth.ready && $auth.dataBootstrap && $plansReady && indexReady && $live.historyHydrated
	);
	let skeletonVariant = $derived.by((): WorkoutsSkeletonVariant => {
		if (activeTab === 'history') {
			if ($live.historyHydrated) {
				return history.length === 0 ? 'history-empty' : 'history-list';
			}
			if (data.bootPeek.historyRows > 0) return 'history-list';
			if (data.bootPeek.hasHistory) return 'history-list';
			return peekLocalHistoryCount() > 0 ? 'history-list' : 'history-empty';
		}
		if ($plansReady) return $plans.length === 0 ? 'plans-empty' : 'plans-list';
		if (data.bootPeek.planRows > 0) return 'plans-list';
		if (data.bootPeek.planRows === 0) return 'plans-empty';
		return peekLocalPlanCount() === 0 ? 'plans-empty' : 'plans-list';
	});
	let skeletonRows = $derived.by(() => {
		const cap = (n: number) => Math.min(Math.max(n, 1), 4);
		if (activeTab === 'history') {
			if ($live.historyHydrated) return cap(history.length);
			if (data.bootPeek.historyRows > 0) return cap(data.bootPeek.historyRows);
			const peekedHistory = peekLocalHistoryCount();
			if (peekedHistory > 0) return cap(peekedHistory);
			return 1;
		}
		if (skeletonVariant === 'plans-empty') return 0;
		if ($plansReady) return cap($plans.length);
		if (data.bootPeek.planRows > 0) return cap(data.bootPeek.planRows);
		const peekedPlans = peekLocalPlanCount();
		if (peekedPlans === 0) return 0;
		return cap(peekedPlans);
	});
	let plansEmptyLayout = $derived(
		activeTab === 'plans' &&
			(skeletonVariant === 'plans-empty' || (pageReady && $plans.length === 0))
	);
	let listUncertain = $derived(isCloudListUncertain($plansSync));

	let filteredPlans = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return $plans;
		return $plans.filter((p) => p.name.toLowerCase().includes(q));
	});

	let history = $derived($live.history);
	let nextPlan = $derived.by(() =>
		resolveHomeNextPlan($plans, history[0]?.planId, $homeNextPlan)
	);

	let displayedPlans = $derived(filteredPlans);

	let canReorderPlans = $derived(!searchQuery.trim() && $plans.length > 1);
	let reorderFrom = $state<number | null>(null);
	let reorderOver = $state<number | null>(null);

	function reorderPlan(from: number, to: number) {
		if (!canReorderPlans || planBusyId !== null) return;
		plans.reorderInOrder(from, to);
	}

	function planLeadingSwipeActions(plan: (typeof $plans)[number]): SwipeRowAction[] {
		if (nextPlan?.id === plan.id) return [];
		return [
			{
				label: translate(lang, 'home.nextPlanBadge'),
				ariaLabel: translate(lang, 'home.setNextPlan'),
				icon: Flag,
				variant: 'success',
				onAction: () => pinNextPlan(plan.id, plan.name)
			}
		];
	}

	function planTrailingSwipeActions(plan: (typeof $plans)[number]): SwipeRowAction[] {
		return [
			{
				label: translate(lang, 'workouts.delete'),
				icon: Trash2,
				variant: 'danger',
				onAction: () => void onRemove(plan.id, plan.name),
				busy: planBusyId === plan.id && planBusyOp === 'delete'
			}
		];
	}

	let historyBusyId = $state<string | null>(null);
	let historyClearBusy = $state(false);
	let planBusyId = $state<string | null>(null);
	let planBusyOp = $state<'copy' | 'delete' | null>(null);

	let clearHistoryOfferOpen = $state(false);
	let demoBusy = $state(false);

	async function onTryDemoPlan() {
		if (demoBusy) return;
		demoBusy = true;
		try {
			const planId = await onboarding.installDemoPlan();
			await goto(`/workouts/${planId}`);
		} catch (err) {
			toasts.show(translateError(lang, err, 'onboarding.demoFail'), 'error');
		} finally {
			demoBusy = false;
		}
	}

	let pageTitle = $derived(
		translate(lang, activeTab === 'history' ? 'workouts.tabHistory' : 'workouts.title')
	);
	let showPlansLead = $derived(activeTab === 'plans');
	let showPlansLeadSlot = $derived(activeTab === 'plans');

	onMount(() => {
		const onReorder = (event: Event) => {
			const detail = (event as CustomEvent<{ from: number | null; over: number | null }>).detail;
			reorderFrom = detail.from;
			reorderOver = detail.over;
		};
		document.addEventListener('repdraft:plan-reorder', onReorder);

		void loadExerciseIndex()
			.then((items) => {
				indexById = new Map(items.map((item) => [item.id, item]));
			})
			.finally(() => {
				indexReady = true;
			});
		if (!get(live).historyHydrated) {
			void live.refreshHistory();
		}

		return () => {
			document.removeEventListener('repdraft:plan-reorder', onReorder);
		};
	});

	function setTab(tab: WorkoutsTab) {
		const url = new URL($page.url);
		if (tab === 'plans') url.searchParams.delete('tab');
		else url.searchParams.set('tab', tab);
		const next = `${url.pathname}${url.search}${url.hash}`;
		void goto(next, { keepFocus: true, noScroll: true });
	}

	async function onDuplicate(id: string) {
		if (planBusyId) return;
		planBusyId = id;
		planBusyOp = 'copy';
		try {
			const result = await plans.duplicate(id);
			if (!result) {
				toasts.show(translate(lang, 'workouts.copyFail'), 'error');
				return;
			}
			toasts.show(
				translate(lang, result.synced ? 'workouts.copied' : 'workouts.copiedLocal'),
				result.synced ? 'success' : 'info'
			);
		} catch (err) {
			toasts.show(translateError(lang, err, 'workouts.copyFail'), 'error');
		} finally {
			planBusyId = null;
			planBusyOp = null;
		}
	}

	async function onRemove(id: string, _name: string) {
		if (planBusyId) return;
		const plan = get(plans).find((p) => p.id === id) ?? (await plans.getPlan(id));
		if (!plan) return;
		const orderIndex = get(planOrder).indexOf(id);

		planBusyId = id;
		planBusyOp = 'delete';
		try {
			await plans.removePlan(id);
			toasts.showUndo(
				translate(lang, 'workouts.deleted'),
				async () => {
					await plans.restorePlan(plan, orderIndex);
				},
				'info'
			);
		} catch (err) {
			toasts.show(translateError(lang, err, 'workouts.deleteFail'), 'error');
		} finally {
			planBusyId = null;
			planBusyOp = null;
		}
	}

	function onOpen(planId: string) {
		void goto(`/workouts/${planId}`);
	}

	function pinNextPlan(planId: string, planName: string) {
		homeNextPlan.pin(planId);
		toasts.show(translate(lang, 'home.setNextPlanDone', { name: planName }), 'success');
	}

	function offerClearHistory() {
		if (history.length === 0 || historyClearBusy) return;
		clearHistoryOfferOpen = true;
	}

	async function commitClearHistory() {
		clearHistoryOfferOpen = false;
		if (historyClearBusy) return;
		const snapshot = structuredClone(get(live).history);
		if (snapshot.length === 0) return;
		historyClearBusy = true;
		try {
			await live.clearHistory();
			toasts.showUndo(
				translate(lang, 'workouts.historyCleared'),
				async () => {
					try {
						await live.restoreHistory(snapshot);
					} catch (err) {
						toasts.show(translateError(lang, err, 'workouts.historyRestoreFail'), 'error');
					}
				},
				'info'
			);
		} catch (err) {
			toasts.show(translateError(lang, err, 'workouts.historyClearFail'), 'error');
		} finally {
			historyClearBusy = false;
		}
	}

	async function onRemoveSession(session: (typeof history)[number]) {
		if (historyBusyId) return;
		const snapshot = structuredClone(session);
		historyBusyId = session.id;
		try {
			await live.removeFromHistory(session.id);
			toasts.showUndo(
				translate(lang, 'workouts.sessionDeleted'),
				async () => {
					await live.restoreSession(snapshot);
				},
				'info'
			);
		} catch (err) {
			toasts.show(translateError(lang, err, 'workouts.sessionDeleteFail'), 'error');
		} finally {
			historyBusyId = null;
		}
	}

	function dismissClearHistoryOffer() {
		clearHistoryOfferOpen = false;
	}
</script>

{#snippet historyClearAction()}
	{#if history.length > 0}
		<AppButton
			variant="ghost"
			class="workouts-page__clear-history is-danger shrink-0"
			disabled={historyClearBusy || historyBusyId !== null}
			aria-busy={historyClearBusy}
			onclick={offerClearHistory}
			aria-label={translate(lang, 'workouts.clearHistory')}
			title={translate(lang, 'workouts.clearHistory')}
		>
			<LucideIcon icon={Trash2} size={ICON_BUTTON} />
		</AppButton>
	{/if}
{/snippet}

<svelte:head>
	<title>{pageTitle} · Repdraft</title>
</svelte:head>

<section
	class="workouts-page content-page content-page--narrow"
	class:workouts-page--history-tab={activeTab === 'history'}
	class:workouts-page--plans-empty={plansEmptyLayout}
>
	{#if activeTab === 'history'}
		<ScreenHeader
			class="lg:hidden"
			title={pageTitle}
			backHref="/workouts"
			actions={historyClearAction}
		/>
	{/if}
	<div class="page-header workouts-page__header">
		<div
			class="workouts-page__toolbar"
			class:workouts-page__toolbar--history={activeTab === 'history'}
		>
			{#if activeTab === 'history'}
				<AppButton
					variant="ghost"
					class="workouts-page__nav-btn workouts-page__nav-btn--back hidden lg:inline-flex"
					onclick={() => navigateBack('/workouts')}
					aria-label={translate(lang, 'builder.backWorkouts')}
					title={translate(lang, 'builder.backWorkouts')}
				>
					<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
				</AppButton>
			{/if}
			<div class="workouts-page__intro min-w-0">
				<h1 class="page-title">{pageTitle}</h1>
				{#if showPlansLeadSlot}
					<p class="page-lead workouts-page-lead">
						{#if !pageReady}
							{translate(lang, 'workouts.local')}
						{:else if showPlansLead}
							{#if $auth.user}
								{#if $plansSync === 'stale'}
									{translate(lang, 'sync.cloudLoading')}
								{:else if $plansSync === 'error'}
									{translate(lang, 'workouts.local')}
								{:else}
									{translate(lang, 'workouts.cloud')}
								{/if}
							{:else}
								{translate(lang, 'workouts.local')}
							{/if}
						{/if}
					</p>
				{/if}
			</div>
			<div class="workouts-page__toolbar-actions">
				{#if activeTab === 'history'}
					{@render historyClearAction()}
				{:else if activeTab === 'plans'}
					<AppButton
						variant="secondary"
						class="workouts-page__toolbar-icon-btn workouts-page__icon-btn"
						onclick={() => setTab('history')}
						aria-label={translate(lang, 'workouts.openHistory')}
						title={translate(lang, 'workouts.openHistory')}
					>
						<LucideIcon icon={Clock} size={ICON_SMALL} />
					</AppButton>
					<AppButton
						href={BUILDER_NEW_HREF}
						class="workouts-page__toolbar-icon-btn workouts-page__create shrink-0"
						aria-label={translate(lang, 'workouts.newWorkout')}
						title={translate(lang, 'workouts.newWorkout')}
					>
						<LucideIcon icon={Plus} size={ICON_SMALL} />
					</AppButton>
				{/if}
			</div>
		</div>
	</div>

	<CloudSyncBanner
		sync={$plansSync}
		{lang}
		suppressed={!pageReady}
		onRetry={() => void plans.refresh({ force: true })}
	/>

	{#if !pageReady}
		<WorkoutsPageSkeleton
			label={translate(lang, 'common.loading')}
			variant={skeletonVariant}
			rows={skeletonRows}
		/>
	{:else}
	{#if activeTab === 'plans'}
			{#if $plans.length === 0}
				<EmptyState
					centered
					icon={ClipboardList}
					title={translate(lang, 'workouts.emptyTitle')}
					description={translate(lang, 'workouts.emptyDesc')}
					actionHref={BUILDER_NEW_HREF}
					actionLabel={translate(lang, 'workouts.create')}
				>
					{#snippet actions()}
						<BackupImportAction variant="secondary" block />
						<AppButton
							variant="link"
							block
							class="mt-2"
							disabled={demoBusy}
							aria-busy={demoBusy}
							onclick={() => void onTryDemoPlan()}
						>
							{translate(lang, 'onboarding.emptyPlansDemo')}
						</AppButton>
					{/snippet}
				</EmptyState>
			{:else}
				<div class="workouts-page__search">
					<SearchInput bind:value={searchQuery} placeholder={translate(lang, 'workouts.searchPh')} />
				</div>
				{#if filteredPlans.length === 0}
					<EmptyState
						title={translate(lang, 'catalog.emptyTitle')}
						description={translate(lang, 'catalog.emptyDesc')}
						actionLabel={translate(lang, 'catalog.reset')}
						actionOnclick={() => {
							searchQuery = '';
						}}
					/>
				{:else}
					{#if showWorkoutsPreviewCoachmark}
						<Coachmark
							message={translate(lang, 'onboarding.coachWorkoutsPreview')}
							onDismiss={() => onboarding.dismissCoachmark('workouts.preview')}
						/>
					{/if}
					<ul
						class="entity-list entity-list--cards"
						class:cloud-sync-list--uncertain={listUncertain}
						class:workouts-page__list--reorder-mode={canReorderPlans}
						data-reorder-list
					>
						{#each displayedPlans as plan, index (plan.id)}
							{@const muscles = planTargetSummary(plan, indexById, lang)}
							{@const isNext = nextPlan?.id === plan.id}
							<li
								class="plan-list-item"
								class:plan-list-item--reorder-dragging={reorderFrom === index}
								class:plan-list-item--reorder-over={reorderOver === index}
								data-plan-index={index}
							>
								<SwipeToDelete
									disabled={planBusyId !== null || reorderFrom !== null}
									leadingActions={planLeadingSwipeActions(plan)}
									actions={planTrailingSwipeActions(plan)}
								>
									<div class="entity-row">
										<a class="entity-row__main" href={`/workouts/${plan.id}`}>
											<span class="entity-row__title">{plan.name}</span>
											{#if muscles}
												<span class="entity-row__meta">{muscles}</span>
											{:else}
												<span class="entity-row__meta" aria-hidden="true">&nbsp;</span>
											{/if}
											<span class="entity-row__meta-row">
												<span class="entity-row__meta">
													{translate(lang, 'workouts.exCount', {
														n: planExerciseSlotCount(plan)
													})}
												</span>
												{#if isNext}
													<span class="entity-row__badge"
														>{translate(lang, 'home.nextPlanBadge')}</span
													>
												{/if}
											</span>
										</a>
										<div class="entity-row__actions">
											<AppButton
												variant="ghost"
												class={cn(
													'entity-row__pin entity-row__pin--desktop',
													isNext && 'is-pinned'
												)}
												onclick={() => pinNextPlan(plan.id, plan.name)}
												disabled={planBusyId !== null || isNext}
												aria-label={translate(lang, 'home.setNextPlan')}
												title={translate(
													lang,
													isNext ? 'home.nextPlanBadge' : 'home.setNextPlan'
												)}
											>
												<LucideIcon icon={Flag} size={ICON_SMALL} />
											</AppButton>
											<AppButton
												variant="ghost"
												class="entity-row__start entity-row__start--desktop"
												onclick={() => onOpen(plan.id)}
												disabled={plan.exercises.length === 0 || planBusyId !== null}
												aria-label={translate(lang, 'workouts.open')}
												title={translate(lang, 'workouts.open')}
											>
												<LucideIcon icon={Play} size={ICON_SMALL} />
											</AppButton>
											<AppButton
												variant="ghost"
												aria-label={translate(lang, 'workouts.duplicate')}
												title={translate(lang, 'workouts.duplicate')}
												disabled={planBusyId !== null}
												aria-busy={planBusyId === plan.id && planBusyOp === 'copy'}
												onclick={() => void onDuplicate(plan.id)}
											>
												{#if planBusyId === plan.id && planBusyOp === 'copy'}
													<Spinner size="sm" block={false} />
												{:else}
													<LucideIcon icon={Copy} size={ICON_SMALL} />
												{/if}
											</AppButton>
											<AppButton
												variant="ghost"
												class="is-danger"
												aria-label={translate(lang, 'workouts.delete')}
												title={translate(lang, 'workouts.delete')}
												disabled={planBusyId !== null}
												aria-busy={planBusyId === plan.id && planBusyOp === 'delete'}
												onclick={() => void onRemove(plan.id, plan.name)}
											>
												{#if planBusyId === plan.id && planBusyOp === 'delete'}
													<Spinner size="sm" block={false} />
												{:else}
													<LucideIcon icon={Trash2} size={ICON_SMALL} />
												{/if}
											</AppButton>
										</div>
										{#if canReorderPlans}
											<ExerciseReorderHandle
												{index}
												holdMs={0}
												label={translate(lang, 'builder.reorder')}
												onreorder={reorderPlan}
												targetSelector="[data-plan-index]"
												indexAttribute="data-plan-index"
												rootActiveClass="is-plan-reorder-active"
												eventName="repdraft:plan-reorder"
											/>
										{/if}
									</div>
								</SwipeToDelete>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		{:else if history.length === 0}
			<EmptyState
				centered
				class="empty-state--history"
				icon={Clock}
				title={translate(lang, 'workouts.historyEmptyTitle')}
				description={translate(lang, 'onboarding.historyEmptyLead')}
			>
				{#snippet actions()}
					<div class="workouts-history-mock entity-row" aria-hidden="true">
						<div class="entity-row__main">
							<span class="workouts-history-mock__label">
								{translate(lang, 'onboarding.historyMockEyebrow')}
							</span>
							<span class="entity-row__title">{translate(lang, 'onboarding.historyMockTitle')}</span>
							<span class="entity-row__meta">{translate(lang, 'onboarding.historyMockMeta')}</span>
						</div>
					</div>
					<BackupImportAction variant="link" block />
					{#if $plans.length > 0 && nextPlan}
						<AppButton href={`/workouts/${nextPlan.id}`} block>
							{translate(lang, 'workouts.start')}
						</AppButton>
					{:else}
						<AppButton
							block
							disabled={demoBusy}
							aria-busy={demoBusy}
							onclick={() => void onTryDemoPlan()}
						>
							{translate(lang, 'onboarding.tryDemo')}
						</AppButton>
					{/if}
				{/snippet}
			</EmptyState>
		{:else}
			<ul class="entity-list entity-list--cards">
				{#each history as session (session.id)}
					<li>
						<SwipeToDelete
							label={translate(lang, 'workouts.deleteSession')}
							disabled={historyBusyId !== null}
							busy={historyBusyId === session.id}
							onDelete={() => void onRemoveSession(session)}
						>
							<div class="entity-row">
								<a class="entity-row__main" href={`/workouts/history/${session.id}`}>
									<span class="entity-row__eyebrow">
										{formatRelativeDay(session.finishedAt ?? session.startedAt, lang)}
									</span>
									<span class="entity-row__title">{session.planName}</span>
									<span class="entity-row__meta">
										{translate(lang, 'workouts.historyMeta', {
											min: formatDurationMinutes(sessionDurationMs(session)) ?? '-',
											sets: completedSetCount(session)
										})}
									</span>
								</a>
								<div class="entity-row__actions">
									<AppButton
										variant="ghost"
										class="is-danger"
										disabled={historyBusyId !== null}
										aria-busy={historyBusyId === session.id}
										aria-label={translate(lang, 'workouts.deleteSession')}
										title={translate(lang, 'workouts.deleteSession')}
										onclick={() => void onRemoveSession(session)}
									>
										{#if historyBusyId === session.id}
											<Spinner size="sm" block={false} />
										{:else}
											<LucideIcon icon={Trash2} size={ICON_SMALL} />
										{/if}
									</AppButton>
								</div>
							</div>
						</SwipeToDelete>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	<AppFab
		class="lg:hidden"
		href={BUILDER_NEW_HREF}
		label={translate(lang, 'workouts.newWorkout')}
		hidden={activeTab === 'history' || (activeTab === 'plans' && $plans.length === 0)}
	/>
</section>

<BottomSheet
	open={clearHistoryOfferOpen}
	titleId="workouts-clear-history-title"
	onDismiss={dismissClearHistoryOffer}
>
	<p id="workouts-clear-history-title" class="bottom-sheet__title">
		{translate(lang, 'workouts.clearHistory')}
	</p>
	<p class="bottom-sheet__hint">{translate(lang, 'workouts.confirmClearHistory')}</p>
	{#snippet actions()}
		<AppButton variant="secondary" onclick={dismissClearHistoryOffer}>
			{translate(lang, 'common.cancel')}
		</AppButton>
		<AppButton variant="danger" onclick={commitClearHistory} disabled={historyClearBusy}>
			{translate(lang, 'common.clear')}
		</AppButton>
	{/snippet}
</BottomSheet>
