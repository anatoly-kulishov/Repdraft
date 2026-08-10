<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import WorkoutsPageSkeleton from '$lib/components/WorkoutsPageSkeleton.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import { Copy, Play, Plus, Trash2 } from '@lucide/svelte';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { completedSetCount, sessionDurationMs } from '$lib/domain/session';
	import { planTargetSummary } from '$lib/domain/workout';
	import { translate, translateError } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { live } from '$lib/stores/live';
	import { plans, plansReady } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);
	let searchQuery = $state('');
	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let indexReady = $state(false);
	let historyReady = $state(false);

	let pageReady = $derived(
		$auth.ready && $auth.dataBootstrap && $plansReady && indexReady && historyReady
	);

	let filteredPlans = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return $plans;
		return $plans.filter((p) => p.name.toLowerCase().includes(q));
	});

	let history = $derived($live.history.slice(0, 12));
	let historyBusyId = $state<string | null>(null);
	let planBusyId = $state<string | null>(null);
	let planBusyOp = $state<'copy' | 'delete' | null>(null);

	onMount(() => {
		void loadExerciseIndex()
			.then((items) => {
				indexById = new Map(items.map((item) => [item.id, item]));
			})
			.finally(() => {
				indexReady = true;
			});
		void live.refreshHistory().finally(() => {
			historyReady = true;
		});
	});

	function formatDate(iso: string): string {
		try {
			return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
				day: 'numeric',
				month: 'short'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	function whenLabel(iso: string): string {
		const d = new Date(iso);
		const now = new Date();
		const dayMs = 86_400_000;
		const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
		const diffDays = Math.round((startToday - startThat) / dayMs);
		if (diffDays === 0) return translate(lang, 'home.today');
		if (diffDays === 1) return translate(lang, 'home.yesterday');
		if (diffDays > 1 && diffDays < 8) {
			return translate(lang, 'home.daysAgo', { n: diffDays });
		}
		return formatDate(iso);
	}

	function durationMin(session: (typeof history)[number]): number | null {
		const ms = sessionDurationMs(session);
		if (ms == null) return null;
		return Math.max(1, Math.round(ms / 60_000));
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
		if (!confirm(translate(lang, 'workouts.confirmDelete', { name }))) return;
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

	function onStart(planId: string) {
		void goto(`/workouts/${planId}`);
	}

	async function onRemoveSession(session: (typeof history)[number]) {
		if (!confirm(translate(lang, 'workouts.confirmDeleteSession', { name: session.planName }))) {
			return;
		}
		historyBusyId = session.id;
		try {
			await live.removeFromHistory(session.id);
			toasts.show(translate(lang, 'workouts.sessionDeleted'), 'info');
		} catch (err) {
			toasts.show(translateError(lang, err, 'workouts.sessionDeleteFail'), 'error');
		} finally {
			historyBusyId = null;
		}
	}

	async function onClearHistory() {
		if (!confirm(translate(lang, 'workouts.confirmClearHistory'))) return;
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
</script>

<svelte:head>
	<title>{translate(lang, 'workouts.title')} — Repdraft</title>
</svelte:head>

<section class="workouts-page content-page">
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
					{translate(lang, 'workouts.cloud')}
				{:else}
					{translate(lang, 'workouts.local')}
					<a class="font-semibold text-[var(--color-accent)] underline" href="/auth?next=%2Fworkouts"
						>{translate(lang, 'workouts.signInSync')}</a
					>{translate(lang, 'workouts.syncSuffix')}
				{/if}
			</p>
		</div>
		<a
			class="btn-primary workouts-page__create min-h-11 shrink-0"
			href="/builder"
		>
			{translate(lang, 'workouts.newWorkout')}
		</a>
	</div>

	{#if !pageReady}
		<WorkoutsPageSkeleton label={translate(lang, 'common.loading')} />
	{:else if $plans.length === 0}
		<EmptyState
			title={translate(lang, 'workouts.emptyTitle')}
			description={translate(lang, 'workouts.emptyDesc')}
		/>
	{:else}
		<div class="workouts-page__search">
			<SearchInput bind:value={searchQuery} placeholder={translate(lang, 'workouts.searchPh')} />
		</div>
		{#if filteredPlans.length === 0}
		<p class="panel-dashed text-sm text-[var(--color-muted)]">{translate(lang, 'catalog.emptyTitle')}</p>
		{:else}
		<ul class="entity-list">
			{#each filteredPlans as plan (plan.id)}
				{@const muscles = planTargetSummary(plan, indexById, lang)}
				<li class="entity-row">
					<a class="entity-row__main" href={`/workouts/${plan.id}`}>
						<span class="entity-row__title">{plan.name}</span>
						{#if muscles}
							<span class="entity-row__meta">{muscles}</span>
						{:else}
							<span class="entity-row__meta" aria-hidden="true">&nbsp;</span>
						{/if}
						<span class="entity-row__meta">
							{translate(lang, 'workouts.exCount', { n: plan.exercises.length })}
						</span>
					</a>
					<div class="entity-row__actions">
						<button
							type="button"
							class="btn-primary inline-flex min-h-11 shrink-0 items-center gap-2 px-4"
							onclick={() => onStart(plan.id)}
							disabled={plan.exercises.length === 0 || planBusyId !== null}
						>
							<LucideIcon icon={Play} size={ICON_BUTTON} />
							{translate(lang, 'workouts.start')}
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
				</li>
			{/each}
		</ul>
		{/if}
	{/if}

	{#if pageReady && history.length > 0}
		<div class="mt-8">
			<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h2 class="section-title">{translate(lang, 'workouts.historyTitle')}</h2>
				<button
					type="button"
					class="btn-link text-sm !text-[var(--color-muted)]"
					disabled={historyBusyId !== null}
					onclick={() => void onClearHistory()}
				>
					{translate(lang, 'workouts.clearHistory')}
				</button>
			</div>
			<ul class="entity-list">
				{#each history as session (session.id)}
					<li class="entity-row">
						<a class="entity-row__main" href={`/workouts/history/${session.id}`}>
							<span class="entity-row__title">{session.planName}</span>
							<span class="entity-row__meta">
								{translate(lang, 'home.recentMeta', {
									when: whenLabel(session.finishedAt ?? session.startedAt),
									min: durationMin(session) ?? '—',
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
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<a
		class="workouts-fab"
		href="/builder"
		aria-label={translate(lang, 'workouts.newWorkout')}
		title={translate(lang, 'workouts.newWorkout')}
	>
		<LucideIcon icon={Plus} size={ICON_PRIMARY} />
	</a>
</section>
