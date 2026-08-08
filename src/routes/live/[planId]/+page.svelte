<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { completedSetCount, totalSetCount } from '$lib/domain/session';
	import type { ExerciseIndexItem, WorkoutPlan } from '$lib/domain/types';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { translate } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { localWorkoutRepository } from '$lib/storage/localWorkoutRepository';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { onDestroy, onMount } from 'svelte';

	let { params } = $props();

	let lang = $derived($resolvedLocale);
	let session = $derived($live.session);
	let restUntil = $derived($live.restUntil);
	let loading = $state(true);
	let missing = $state(false);
	let names = $state(new Map<string, ExerciseIndexItem>());
	let now = $state(Date.now());
	let tick: ReturnType<typeof setInterval> | null = null;

	let restLeft = $derived(
		restUntil != null ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0
	);

	/** Prefer memory → localStorage; cloud only as last resort with a short timeout. */
	async function resolvePlan(id: string): Promise<WorkoutPlan | null> {
		const cached = get(plans).find((p) => p.id === id);
		if (cached) return cached;

		const local = await localWorkoutRepository.get(id);
		if (local) return local;

		try {
			return await Promise.race([
				plans.getPlan(id),
				new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))
			]);
		} catch {
			return null;
		}
	}

	onMount(() => {
		tick = setInterval(() => {
			now = Date.now();
			if (restUntil != null && restUntil <= Date.now()) {
				live.skipRest();
			}
		}, 250);

		void (async () => {
			live.hydrate();
			// History + names in background — don't block starting the session.
			void live.refreshHistory();
			void loadExerciseIndex()
				.then((index) => {
					names = new Map(index.map((ex) => [ex.id, ex]));
				})
				.catch(() => {
					names = new Map();
				});

			try {
				const plan = await resolvePlan(params.planId);
				if (!plan || plan.exercises.length === 0) {
					missing = true;
					return;
				}

				const active = get(live).session;
				if (active && !active.finishedAt && active.planId === plan.id) {
					return;
				}
				if (active && !active.finishedAt && active.planId !== plan.id) {
					if (!confirm(translate(lang, 'live.confirmDiscard'))) {
						await goto(`/live/${active.planId}`);
						return;
					}
					live.discard();
				}

				await live.startFromPlan(plan);
			} catch (err) {
				console.error('live boot failed', err);
				missing = true;
			} finally {
				loading = false;
			}
		})();
	});

	onDestroy(() => {
		if (tick) clearInterval(tick);
	});

	function titleFor(id: string): string {
		const item = names.get(id);
		return item ? exerciseName(item, lang) : translate(lang, 'records.fallback', { id });
	}

	function formatLast(exerciseId: string): string | null {
		const last = live.lastFor(exerciseId);
		if (!last) return null;
		const w = last.weightKg != null ? `${last.weightKg}` : '—';
		const r = last.reps != null ? `${last.reps}` : '—';
		return `${w} × ${r}`;
	}

	function parseNum(raw: string): number | null {
		const t = raw.trim().replace(',', '.');
		if (!t) return null;
		const n = Number(t);
		return Number.isFinite(n) ? n : null;
	}

	function onWeight(ei: number, si: number, value: string) {
		live.patchSet(ei, si, { weightKg: parseNum(value) });
	}

	function onReps(ei: number, si: number, value: string) {
		live.patchSet(ei, si, { reps: parseNum(value) });
	}

	function onComplete(ei: number, si: number) {
		live.patchSet(ei, si, { completed: true });
	}

	async function onFinish() {
		if (!confirm(translate(lang, 'live.confirmFinish'))) return;
		try {
			await live.finish();
			toasts.show(translate(lang, 'live.saved'), 'success');
			await goto('/workouts');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : 'Error', 'error');
		}
	}

	function onDiscard() {
		if (!confirm(translate(lang, 'live.confirmDiscard'))) return;
		live.discard();
		void goto('/workouts');
	}
</script>

<svelte:head>
	<title
		>{session ? session.planName : translate(lang, 'live.title')} — Repdraft</title
	>
</svelte:head>

{#if loading}
	<PageSkeleton rows={4} />
{:else if missing || !session}
	<EmptyState
		title={translate(lang, 'live.noPlan')}
		description={translate(lang, 'live.emptyPlan')}
		actionHref="/workouts"
		actionLabel={translate(lang, 'live.backPlans')}
	/>
{:else}
	<section class="pb-mobile-actions lg:pb-0">
		<div class="page-header">
			<p class="text-sm text-[var(--color-muted)]">
				<a href="/workouts" class="text-[var(--color-accent)] no-underline"
					>{translate(lang, 'live.backPlans')}</a
				>
			</p>
			<h1 class="page-title">{session.planName}</h1>
			<p class="page-lead">
				{translate(lang, 'live.progress', {
					done: completedSetCount(session),
					total: totalSetCount(session)
				})}
			</p>
		</div>

		{#if restLeft > 0}
			<div
				class="panel mb-4 flex items-center justify-between gap-3 !border-[var(--color-accent)] !p-3"
				role="status"
				aria-live="polite"
			>
				<div>
					<p class="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
						{translate(lang, 'live.rest')}
					</p>
					<p class="text-2xl font-semibold tabular-nums text-[var(--color-ink)]">{restLeft}s</p>
				</div>
				<button type="button" class="btn-secondary" onclick={() => live.skipRest()}
					>{translate(lang, 'live.skipRest')}</button
				>
			</div>
		{/if}

		<ul class="flex flex-col gap-3">
			{#each session.exercises as ex, ei (ex.exerciseId + '-' + ei)}
				<li class="panel !p-3">
					<div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
						<h2 class="text-base font-semibold text-[var(--color-ink)]">
							{titleFor(ex.exerciseId)}
						</h2>
						{#if formatLast(ex.exerciseId)}
							<p class="text-xs text-[var(--color-muted)]">
								{translate(lang, 'live.last')}:
								<span class="font-medium text-[var(--color-ink)]">{formatLast(ex.exerciseId)}</span>
							</p>
						{/if}
					</div>

					<ul class="flex flex-col gap-2">
						{#each ex.sets as set, si (si)}
							<li
								class="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2 rounded-lg bg-[var(--color-surface-muted)] p-2 sm:gap-3"
								class:opacity-60={set.completed}
							>
								<span class="pb-2 text-xs font-semibold text-[var(--color-muted)]"
									>{si + 1}</span
								>
								<label class="block text-xs text-[var(--color-muted)]">
									{translate(lang, 'live.weight')}
									<input
										class="mt-0.5 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm tabular-nums text-[var(--color-ink)]"
										type="number"
										inputmode="decimal"
										min="0"
										step="0.5"
										disabled={set.completed}
										value={set.weightKg ?? ''}
										oninput={(e) => onWeight(ei, si, e.currentTarget.value)}
									/>
								</label>
								<label class="block text-xs text-[var(--color-muted)]">
									{translate(lang, 'live.reps')}
									<input
										class="mt-0.5 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm tabular-nums text-[var(--color-ink)]"
										type="number"
										inputmode="numeric"
										min="0"
										step="1"
										disabled={set.completed}
										value={set.reps ?? ''}
										oninput={(e) => onReps(ei, si, e.currentTarget.value)}
									/>
								</label>
								{#if set.completed}
									<span
										class="pb-2 text-xs font-semibold text-[var(--color-accent)]"
										aria-label={translate(lang, 'live.done')}>✓</span
									>
								{:else}
									<button
										type="button"
										class="btn-primary !px-2.5 !py-1.5 text-sm"
										onclick={() => onComplete(ei, si)}
									>
										{translate(lang, 'live.done')}
									</button>
								{/if}
							</li>
						{/each}
					</ul>

					<button
						type="button"
						class="btn-ghost mt-2 text-sm"
						onclick={() => live.addSet(ei)}
					>
						{translate(lang, 'live.addSet')}
					</button>
				</li>
			{/each}
		</ul>

		<div
			class="mt-5 flex flex-wrap gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:static"
		>
			<button type="button" class="btn-primary" onclick={() => void onFinish()}
				>{translate(lang, 'live.finish')}</button
			>
			<button type="button" class="btn-ghost is-danger" onclick={onDiscard}
				>{translate(lang, 'live.discard')}</button
			>
		</div>
	</section>
{/if}
