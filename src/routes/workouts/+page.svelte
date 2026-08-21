<script lang="ts">
	import CloudSyncBanner from '$lib/components/CloudSyncBanner.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SegmentControl from '$lib/components/SegmentControl.svelte';
	import WorkoutsPageSkeleton from '$lib/components/WorkoutsPageSkeleton.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SwipeToDelete from '$lib/components/SwipeToDelete.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import { Copy, ClipboardList, Clock, Play, Plus, Trash2 } from '@lucide/svelte';
	import { loadExerciseIndex, peekExerciseIndex } from '$lib/data/loadExercises';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { completedSetCount, sessionDurationMs } from '$lib/domain/session';
	import { planExerciseSlotCount, planTargetSummary } from '$lib/domain/workout';
	import { BUILDER_NEW_HREF } from '$lib/domain/catalogLinks';
	import { formatDurationMinutes, formatRelativeDay } from '$lib/i18n/format';
	import { translate, translateError } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { live } from '$lib/stores/live';
	import { plans, plansReady, plansSync } from '$lib/stores/plans';
	import { isCloudListUncertain } from '$lib/domain/cloudSync';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	type WorkoutsTab = 'plans' | 'history';

	function parseWorkoutsTab(value: string | null): WorkoutsTab {
		return value === 'history' ? 'history' : 'plans';
	}

	let lang = $derived($resolvedLocale);
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
	let listUncertain = $derived(isCloudListUncertain($plansSync));

	let filteredPlans = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return $plans;
		return $plans.filter((p) => p.name.toLowerCase().includes(q));
	});

	let history = $derived($live.history);
	let historyBusyId = $state<string | null>(null);
	let planBusyId = $state<string | null>(null);
	let planBusyOp = $state<'copy' | 'delete' | null>(null);

	type ConfirmOffer =
		| { kind: 'delete-plan'; id: string; name: string }
		| { kind: 'delete-session'; id: string; name: string }
		| { kind: 'clear-history' };

	let confirmOffer = $state<ConfirmOffer | null>(null);

	const tabOptions = $derived([
		{ id: 'plans', label: translate(lang, 'workouts.tabPlans') },
		{ id: 'history', label: translate(lang, 'workouts.tabHistory') }
	]);

	onMount(() => {
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
	});

	function setTab(tab: WorkoutsTab) {
		const url = new URL($page.url);
		if (tab === 'plans') url.searchParams.delete('tab');
		else url.searchParams.set('tab', tab);
		const next = `${url.pathname}${url.search}${url.hash}`;
		void goto(next, { replaceState: true, keepFocus: true, noScroll: true });
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

	async function onRemove(id: string, name: string) {
		if (planBusyId) return;
		confirmOffer = { kind: 'delete-plan', id, name };
	}

	async function commitRemovePlan() {
		if (!confirmOffer || confirmOffer.kind !== 'delete-plan') return;
		const { id } = confirmOffer;
		confirmOffer = null;
		if (planBusyId) return;
		planBusyId = id;
		planBusyOp = 'delete';
		try {
			await plans.removePlan(id);
			toasts.show(translate(lang, 'workouts.deleted'), 'info');
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

	async function onRemoveSession(session: (typeof history)[number]) {
		confirmOffer = { kind: 'delete-session', id: session.id, name: session.planName };
	}

	async function commitRemoveSession() {
		if (!confirmOffer || confirmOffer.kind !== 'delete-session') return;
		const { id } = confirmOffer;
		confirmOffer = null;
		historyBusyId = id;
		try {
			await live.removeFromHistory(id);
			toasts.show(translate(lang, 'workouts.sessionDeleted'), 'info');
		} catch (err) {
			toasts.show(translateError(lang, err, 'workouts.sessionDeleteFail'), 'error');
		} finally {
			historyBusyId = null;
		}
	}

	async function onClearHistory() {
		confirmOffer = { kind: 'clear-history' };
	}

	async function commitClearHistory() {
		if (!confirmOffer || confirmOffer.kind !== 'clear-history') return;
		confirmOffer = null;
		historyBusyId = '__clear__';
		try {
			await live.clearHistory();
			toasts.show(translate(lang, 'workouts.historyCleared'), 'info');
		} catch (err) {
			toasts.show(translateError(lang, err, 'workouts.historyClearFail'), 'error');
		} finally {
			historyBusyId = null;
		}
	}

	function dismissConfirmOffer() {
		confirmOffer = null;
	}

	let confirmTitle = $derived.by(() => {
		if (!confirmOffer) return '';
		switch (confirmOffer.kind) {
			case 'delete-plan':
				return translate(lang, 'workouts.confirmDelete', { name: confirmOffer.name });
			case 'delete-session':
				return translate(lang, 'workouts.confirmDeleteSession', { name: confirmOffer.name });
			case 'clear-history':
				return translate(lang, 'workouts.confirmClearHistory');
			default: {
				const _exhaustive: never = confirmOffer;
				return _exhaustive;
			}
		}
	});

	let confirmPrimaryLabel = $derived(
		confirmOffer?.kind === 'clear-history'
			? translate(lang, 'common.clear')
			: translate(lang, 'common.delete')
	);

	function commitConfirmOffer() {
		if (!confirmOffer) return;
		switch (confirmOffer.kind) {
			case 'delete-plan':
				void commitRemovePlan();
				return;
			case 'delete-session':
				void commitRemoveSession();
				return;
			case 'clear-history':
				void commitClearHistory();
				return;
			default: {
				const _exhaustive: never = confirmOffer;
				return _exhaustive;
			}
		}
	}
</script>

<svelte:head>
	<title>{translate(lang, 'workouts.title')} · Repdraft</title>
</svelte:head>

<section class="workouts-page content-page content-page--narrow">
	<div class="page-header workouts-page__header">
		<div class="workouts-page__intro min-w-0">
			<h1 class="page-title">{translate(lang, 'workouts.title')}</h1>
			<p class="page-lead workouts-page-lead">
				{#if !$auth.ready || !$auth.dataBootstrap}
					<span
						class="inline-block h-4 w-48 max-w-full animate-pulse rounded bg-[var(--color-surface-muted)]"
						aria-hidden="true"
					></span>
				{:else if $auth.user}
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
			</p>
		</div>
		<a
			class="btn-primary workouts-page__create min-h-11 shrink-0"
			href={BUILDER_NEW_HREF}
			class:workouts-page__create--hidden={activeTab === 'history'}
		>
			{translate(lang, 'workouts.newWorkout')}
		</a>
	</div>

	<CloudSyncBanner
		sync={$plansSync}
		{lang}
		suppressed={!pageReady}
		onRetry={() => void plans.refresh({ force: true })}
	/>

	{#if !pageReady}
		<WorkoutsPageSkeleton label={translate(lang, 'common.loading')} />
	{:else}
		<div
			class="workouts-page__tabs"
			class:workouts-page__tabs--split={activeTab === 'history' && history.length > 0}
		>
			<SegmentControl
				options={tabOptions}
				value={activeTab}
				ariaLabel={translate(lang, 'workouts.tabsAria')}
				onchange={(id) => setTab(parseWorkoutsTab(id))}
			/>
			{#if activeTab === 'history' && history.length > 0}
				<button
					type="button"
					class="btn-link workouts-page__clear-history"
					disabled={historyBusyId !== null}
					onclick={() => void onClearHistory()}
				>
					{translate(lang, 'workouts.clearHistory')}
				</button>
			{/if}
		</div>

		{#if activeTab === 'plans'}
			{#if $plans.length === 0}
				<EmptyState
					centered
					icon={ClipboardList}
					title={translate(lang, 'workouts.emptyTitle')}
					description={translate(lang, 'workouts.emptyDesc')}
					actionHref={BUILDER_NEW_HREF}
					actionLabel={translate(lang, 'workouts.create')}
				/>
			{:else}
				<div class="workouts-page__search">
					<SearchInput bind:value={searchQuery} placeholder={translate(lang, 'workouts.searchPh')} />
				</div>
				{#if filteredPlans.length === 0}
					<p class="panel-dashed text-sm text-[var(--color-muted)]">
						{translate(lang, 'catalog.emptyTitle')}
					</p>
				{:else}
					<ul class="entity-list entity-list--cards" class:cloud-sync-list--uncertain={listUncertain}>
						{#each filteredPlans as plan (plan.id)}
							{@const muscles = planTargetSummary(plan, indexById, lang)}
							<li>
								<SwipeToDelete
									label={translate(lang, 'workouts.delete')}
									disabled={planBusyId !== null}
									busy={planBusyId === plan.id && planBusyOp === 'delete'}
									onDelete={() => void onRemove(plan.id, plan.name)}
								>
									<div class="entity-row">
										<a class="entity-row__main" href={`/workouts/${plan.id}`}>
											<span class="entity-row__title">{plan.name}</span>
											{#if muscles}
												<span class="entity-row__meta">{muscles}</span>
											{:else}
												<span class="entity-row__meta" aria-hidden="true">&nbsp;</span>
											{/if}
											<span class="entity-row__meta">
												{translate(lang, 'workouts.exCount', { n: planExerciseSlotCount(plan) })}
											</span>
										</a>
										<div class="entity-row__actions">
											<button
												type="button"
												class="btn-ghost entity-row__start entity-row__start--desktop inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3"
												onclick={() => onOpen(plan.id)}
												disabled={plan.exercises.length === 0 || planBusyId !== null}
											>
												<LucideIcon icon={Play} size={ICON_BUTTON} />
												{translate(lang, 'workouts.open')}
											</button>
											<button
												type="button"
												class="btn-ghost"
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
											</button>
											<button
												type="button"
												class="btn-ghost is-danger"
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
											</button>
										</div>
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
				icon={Clock}
				title={translate(lang, 'workouts.historyEmptyTitle')}
				description={translate(lang, 'workouts.historyEmptyDesc')}
			/>
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
									<span class="entity-row__title">{session.planName}</span>
									<span class="entity-row__meta">
										{translate(lang, 'home.recentMeta', {
											when: formatRelativeDay(session.finishedAt ?? session.startedAt, lang),
											min: formatDurationMinutes(sessionDurationMs(session)) ?? '—',
											sets: completedSetCount(session)
										})}
									</span>
								</a>
								<div class="entity-row__actions">
									<button
										type="button"
										class="btn-ghost is-danger"
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
									</button>
								</div>
							</div>
						</SwipeToDelete>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	<a
		class="workouts-fab"
		class:workouts-fab--hidden={activeTab === 'history'}
		href={BUILDER_NEW_HREF}
		aria-label={translate(lang, 'workouts.newWorkout')}
		title={translate(lang, 'workouts.newWorkout')}
	>
		<LucideIcon icon={Plus} size={ICON_PRIMARY} />
	</a>
</section>

<BottomSheet
	open={confirmOffer != null}
	titleId="workouts-confirm-title"
	onDismiss={dismissConfirmOffer}
>
	<p id="workouts-confirm-title" class="bottom-sheet__title">{confirmTitle}</p>
	{#snippet actions()}
		<button type="button" class="btn-secondary min-h-12" onclick={dismissConfirmOffer}>
			{translate(lang, 'common.cancel')}
		</button>
		<button type="button" class="btn-danger min-h-12" onclick={commitConfirmOffer}>
			{confirmPrimaryLabel}
		</button>
	{/snippet}
</BottomSheet>
