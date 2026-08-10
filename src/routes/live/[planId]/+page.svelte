<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import { coerceReps, coerceWeightKg, LIVE_REPS } from '$lib/domain/inputLimits';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { completedSetCount, nextFocusAfterSetComplete, totalSetCount } from '$lib/domain/session';
	import type { ExerciseIndexItem, WorkoutPlan, WorkoutSession } from '$lib/domain/types';
	import { groupBounds } from '$lib/domain/workout';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { translate, translateError } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { localWorkoutRepository } from '$lib/storage/localWorkoutRepository';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { onDestroy, onMount } from 'svelte';
	import { Check, CircleCheck, Plus, ArrowLeft, Timer, ChevronRight } from '@lucide/svelte';

	let { params } = $props();

	let lang = $derived($resolvedLocale);
	let session = $derived($live.session);
	let restUntil = $derived($live.restUntil);
	let loading = $state(true);
	let finishing = $state(false);
	let missing = $state(false);
	let names = $state(new Map<string, ExerciseIndexItem>());
	let now = $state(Date.now());
	let selectedExerciseIndex = $state(0);
	let tick: ReturnType<typeof setInterval> | null = null;

	function roleFor(index: number): 'solo' | 'first' | 'middle' | 'last' {
		if (!session) return 'solo';
		const bounds = groupBounds(session.exercises, index);
		if (!bounds || bounds.start === bounds.end) return 'solo';
		if (index === bounds.start) return 'first';
		if (index === bounds.end) return 'last';
		return 'middle';
	}

	let selectedRole = $derived(roleFor(selectedExerciseIndex));
	let selectedInGroup = $derived(selectedRole !== 'solo');
	let selectedGroup = $derived.by(() => {
		if (!session || !selectedInGroup) return null;
		return groupBounds(session.exercises, selectedExerciseIndex);
	});
	let selectedGroupPos = $derived.by(() => {
		if (!selectedGroup) return null;
		return {
			current: selectedExerciseIndex - selectedGroup.start + 1,
			total: selectedGroup.end - selectedGroup.start + 1
		};
	});
	let nextInSupersetName = $derived.by(() => {
		if (!session || !selectedGroup) return null;
		if (selectedExerciseIndex >= selectedGroup.end) return null;
		const id = session.exercises[selectedExerciseIndex + 1]?.exerciseId;
		if (!id) return null;
		const item = names.get(id);
		return item ? exerciseName(item, lang) : null;
	});

	let elapsedLabel = $derived.by(() => {
		if (!session?.startedAt) return '0:00';
		const ms = now - new Date(session.startedAt).getTime();
		const totalSec = Math.max(0, Math.floor(ms / 1000));
		const h = Math.floor(totalSec / 3600);
		const m = Math.floor((totalSec % 3600) / 60);
		const s = totalSec % 60;
		if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	});

	function pickDefaultExerciseIndex(sess: WorkoutSession): number {
		const idx = sess.exercises.findIndex(
			(ex) => ex.sets.length > 0 && !ex.sets.every((s) => s.completed)
		);
		return idx >= 0 ? idx : 0;
	}

	function exerciseDone(ei: number): boolean {
		const ex = session?.exercises[ei];
		if (!ex || ex.sets.length === 0) return false;
		return ex.sets.every((s) => s.completed);
	}

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
				const planId = params.planId;
				const active = get(live).session;
				const plan = await resolvePlan(planId);

				// Resume first — session already snapshots exercises; plan may be deleted.
				if (
					active &&
					!active.finishedAt &&
					active.planId === planId &&
					active.exercises.length > 0
				) {
					if (plan) live.syncFromPlan(plan);
					selectedExerciseIndex = pickDefaultExerciseIndex(get(live).session ?? active);
					return;
				}

				if (active && !active.finishedAt && active.planId && active.planId !== planId) {
					if (!confirm(translate(lang, 'live.confirmDiscard'))) {
						await goto(`/live/${active.planId}`);
						return;
					}
					live.discard();
				}

				if (!plan || plan.exercises.length === 0) {
					missing = true;
					return;
				}

				await live.startFromPlan(plan);
				const started = get(live).session;
				if (started) selectedExerciseIndex = pickDefaultExerciseIndex(started);
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

	$effect(() => {
		selectedExerciseIndex;
		if (typeof document === 'undefined') return;
		queueMicrotask(() => {
			document
				.querySelector('.live-nav-item[data-active="true"]')
				?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
		});
	});

	function titleFor(id: string): string {
		const item = names.get(id);
		return item ? exerciseName(item, lang) : translate(lang, 'records.fallback', { id });
	}

	function metaFor(id: string): string | null {
		const item = names.get(id);
		if (!item) return null;
		const target = labelTarget(item.target, lang);
		const equipment = labelEquipment(item.equipment, lang);
		return `${target} · ${equipment}`;
	}

	function formatRestSec(totalSec: number): string {
		const m = Math.floor(totalSec / 60);
		const s = totalSec % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	function formatLast(exerciseId: string): string | null {
		const last = live.lastFor(exerciseId);
		if (!last) return null;
		const w = last.weightKg != null ? `${last.weightKg}` : '—';
		const r = last.reps != null ? `${last.reps}` : '—';
		return `${w} × ${r}`;
	}

	function onWeight(ei: number, si: number, value: string) {
		if (!value.trim()) {
			live.patchSet(ei, si, { weightKg: null });
			return;
		}
		const n = coerceWeightKg(value);
		if (n == null) return;
		live.patchSet(ei, si, { weightKg: n });
	}

	function onReps(ei: number, si: number, value: string) {
		if (!value.trim()) {
			live.patchSet(ei, si, { reps: null });
			return;
		}
		const n = coerceReps(value, LIVE_REPS);
		if (n == null) return;
		live.patchSet(ei, si, { reps: n });
	}

	function onComplete(ei: number, si: number) {
		const ex = session?.exercises[ei];
		const set = ex?.sets[si];
		if (!set) return;
		if (set.weightKg != null && !coerceWeightKg(String(set.weightKg))) {
			toasts.show(translate(lang, 'pr.invalidWeight'), 'error');
			return;
		}
		if (set.reps == null || !Number.isInteger(set.reps) || set.reps < LIVE_REPS.min || set.reps > LIVE_REPS.max) {
			toasts.show(translate(lang, 'live.invalidReps'), 'error');
			return;
		}
		live.patchSet(ei, si, { completed: true });
		const next = get(live).session;
		if (!next) return;
		selectedExerciseIndex = nextFocusAfterSetComplete(next, ei, si);
	}

	function onUncomplete(ei: number, si: number) {
		live.patchSet(ei, si, { completed: false });
	}

	async function onFinish() {
		if (finishing) return;
		if (!confirm(translate(lang, 'live.confirmFinish'))) return;
		finishing = true;
		try {
			const done = await live.finish();
			toasts.show(translate(lang, 'live.saved'), 'success');
			if (done?.id) {
				await goto(`/workouts/summary?id=${encodeURIComponent(done.id)}`);
			} else {
				await goto('/workouts');
			}
		} catch (err) {
			toasts.show(translateError(lang, err, 'live.saveFail'), 'error');
			finishing = false;
		}
	}

	function onDiscard() {
		if (!confirm(translate(lang, 'live.confirmDiscard'))) return;
		live.discard();
		void goto('/workouts');
	}

	function onNextExercise() {
		if (!session) return;
		if (selectedExerciseIndex >= session.exercises.length - 1) return;
		selectedExerciseIndex += 1;
	}

	let canGoNext = $derived(
		session != null && selectedExerciseIndex < session.exercises.length - 1
	);

	let activeSetProgress = $derived.by(() => {
		const ex = session?.exercises[selectedExerciseIndex];
		if (!ex || ex.sets.length === 0) return null;
		const openIdx = ex.sets.findIndex((s) => !s.completed);
		if (openIdx < 0) return { current: ex.sets.length, total: ex.sets.length, allDone: true };
		return { current: openIdx + 1, total: ex.sets.length, allDone: false };
	});
</script>

{#snippet liveHeaderActions()}
	<span class="screen-header-timer" aria-live="polite">{elapsedLabel}</span>
{/snippet}

<svelte:head>
	<title
		>{session ? session.planName : translate(lang, 'live.title')} — Repdraft</title
	>
</svelte:head>

{#if loading}
	<PageSkeleton rows={4} />
{:else if missing || !session}
	<div class="mx-auto max-w-md space-y-3">
		<EmptyState
			title={translate(lang, 'live.noPlan')}
			description={translate(lang, 'live.emptyPlan')}
			actionHref="/workouts"
			actionLabel={translate(lang, 'live.backPlans')}
		/>
		{#if $live.session && !$live.session.finishedAt}
			<button
				type="button"
				class="btn-danger btn-block"
				onclick={() => {
					live.discard();
					void goto('/workouts');
				}}
			>
				{translate(lang, 'live.discard')}
			</button>
		{/if}
	</div>
{:else}
	<section class="live-page pb-mobile-actions lg:pb-4">
		<div class="lg:hidden">
			<ScreenHeader
				class="screen-header--live"
				title={session.planName}
				backHref="/workouts"
				actions={liveHeaderActions}
			/>
		</div>

		<div class="live-mobile-meta lg:hidden">
			<p class="live-progress-pill">
				{translate(lang, 'live.progress', {
					done: selectedExerciseIndex + 1,
					total: session.exercises.length
				})}
			</p>
			<p class="live-progress-pill">
				{translate(lang, 'home.setsProgress', {
					done: completedSetCount(session),
					total: totalSetCount(session)
				})}
			</p>
		</div>

		<header class="live-header hidden lg:flex">
			<div class="live-header-main">
				<a href="/workouts" class="live-back">
					<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
					{translate(lang, 'live.backPlans')}
				</a>
				<h1 class="live-plan-title">{session.planName}</h1>
			</div>
			<div class="live-header-meta">
				<p class="live-progress-pill">
					{translate(lang, 'home.setsProgress', {
						done: completedSetCount(session),
						total: totalSetCount(session)
					})}
				</p>
				<p class="live-timer" aria-live="polite">{elapsedLabel}</p>
			</div>
		</header>

		{#if restLeft > 0}
			<div class="live-rest" role="status" aria-live="polite">
				<div>
					<p class="live-rest-label">
						<LucideIcon icon={Timer} size={ICON_SMALL} />
						{translate(lang, 'live.rest')}
					</p>
					<p class="live-rest-value">{formatRestSec(restLeft)}</p>
				</div>
				<button type="button" class="btn-secondary" onclick={() => live.skipRest()}>
					{translate(lang, 'live.skipRest')}
				</button>
			</div>
		{/if}

		<div class="live-workspace">
			<nav class="live-nav" aria-label={translate(lang, 'live.title')}>
				<ul class="live-nav-list">
					{#each session.exercises as ex, ei (ex.exerciseId + '-nav-' + ei)}
						{@const role = roleFor(ei)}
						<li
							class="live-nav-li"
							class:is-group={role !== 'solo'}
							class:is-group-first={role === 'first'}
							class:is-group-middle={role === 'middle'}
							class:is-group-last={role === 'last'}
						>
							{#if role === 'first'}
								<p class="live-nav-group-badge">{translate(lang, 'builder.supersetBadge')}</p>
							{/if}
							<button
								type="button"
								class="live-nav-item"
								data-active={ei === selectedExerciseIndex}
								data-done={exerciseDone(ei)}
								onclick={() => (selectedExerciseIndex = ei)}
							>
								<span class="live-nav-title">{titleFor(ex.exerciseId)}</span>
								<span class="live-nav-meta">
									{#if role === 'solo'}
										{ex.sets.length} × {ex.targetReps}
									{:else}
										{ex.targetReps} {translate(lang, 'builder.reps').toLowerCase()}
									{/if}
								</span>
								{#if exerciseDone(ei)}
									<span class="live-nav-check" aria-hidden="true">
										<LucideIcon icon={Check} size={ICON_SMALL} />
									</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</nav>

			<div class="live-panel-wrap">
				{#each session.exercises as ex, ei (ex.exerciseId + '-' + ei)}
					{#if ei === selectedExerciseIndex}
						<div class="live-panel" class:live-panel--superset={selectedInGroup}>
							{#if selectedInGroup && selectedGroupPos}
								<p class="live-superset-badge">
									{translate(lang, 'live.supersetOf', selectedGroupPos)}
								</p>
								{#if nextInSupersetName}
									<p class="live-superset-next">
										{translate(lang, 'live.nextInSuperset', { name: nextInSupersetName })}
									</p>
								{/if}
							{/if}
							{#if activeSetProgress}
								<p class="live-exercise-step">
									{translate(lang, 'live.setProgress', {
										current: activeSetProgress.current,
										total: activeSetProgress.total
									})}
								</p>
							{/if}
							<p class="live-exercise-step hidden lg:block">
								{translate(lang, 'live.progress', {
									done: ei + 1,
									total: session.exercises.length
								})}
							</p>
							<h2 class="live-panel-title">{titleFor(ex.exerciseId)}</h2>
							{#if metaFor(ex.exerciseId)}
								<p class="live-panel-meta">{metaFor(ex.exerciseId)}</p>
							{/if}
							{#if formatLast(ex.exerciseId)}
								<p class="live-last">
									{translate(lang, 'live.last')}:
									<span class="font-medium text-[var(--color-ink)]">{formatLast(ex.exerciseId)}</span>
								</p>
							{/if}

							<div class="live-set-head" aria-hidden="true">
								<span>#</span>
								<span>{translate(lang, 'live.weight')}</span>
								<span>{translate(lang, 'live.reps')}</span>
								<span class="live-set-head-done">✓</span>
							</div>

							<ul class="live-set-list">
								{#each ex.sets as set, si (si)}
									<li class="live-set-row" class:is-done={set.completed}>
										<span class="live-set-index">{si + 1}</span>
										<input
											class="field live-set-weight tabular-nums"
											type="text"
											inputmode="decimal"
											autocomplete="off"
											aria-label={`${translate(lang, 'live.weight')} ${si + 1}`}
											value={set.weightKg ?? ''}
											oninput={(e) => onWeight(ei, si, e.currentTarget.value)}
										/>
										<input
											class="field live-set-reps tabular-nums"
											type="text"
											inputmode="numeric"
											autocomplete="off"
											aria-label={`${translate(lang, 'live.reps')} ${si + 1}`}
											value={set.reps ?? ''}
											oninput={(e) => onReps(ei, si, e.currentTarget.value)}
										/>
										{#if set.completed}
											<button
												type="button"
												class="btn-ghost live-set-done-btn live-set-done-btn--done"
												aria-label={translate(lang, 'live.undoDone')}
												title={translate(lang, 'live.undoDone')}
												onclick={() => onUncomplete(ei, si)}
											>
												<LucideIcon icon={Check} size={ICON_BUTTON} />
												<span class="sr-only">{translate(lang, 'live.undoDone')}</span>
											</button>
										{:else}
											<button
												type="button"
												class="btn-primary live-set-done-btn"
												aria-label={translate(lang, 'live.done')}
												title={translate(lang, 'live.done')}
												onclick={() => onComplete(ei, si)}
											>
												<LucideIcon icon={Check} size={ICON_BUTTON} />
												<span class="sr-only">{translate(lang, 'live.done')}</span>
											</button>
										{/if}
									</li>
								{/each}
							</ul>

							<button
								type="button"
								class="btn-ghost mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm"
								onclick={() => live.addSet(ei)}
							>
								<LucideIcon icon={Plus} size={ICON_SMALL} />
								{translate(lang, 'live.addSet')}
							</button>
						</div>
					{/if}
				{/each}

				<footer class="live-desktop-actions">
					{#if canGoNext}
						<button
							type="button"
							class="btn-primary inline-flex min-h-11 items-center gap-2"
							disabled={finishing}
							onclick={onNextExercise}
						>
							{translate(lang, 'live.nextExercise')}
							<LucideIcon icon={ChevronRight} size={ICON_PRIMARY} />
						</button>
						<button
							type="button"
							class="btn-secondary inline-flex min-h-11 items-center gap-2"
							disabled={finishing}
							aria-busy={finishing}
							onclick={() => void onFinish()}
						>
							{#if finishing}
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							{:else}
								<LucideIcon icon={CircleCheck} size={ICON_PRIMARY} />
								{translate(lang, 'live.finish')}
							{/if}
						</button>
					{:else}
						<button
							type="button"
							class="btn-primary inline-flex min-h-11 items-center gap-2"
							disabled={finishing}
							aria-busy={finishing}
							onclick={() => void onFinish()}
						>
							{#if finishing}
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							{:else}
								<LucideIcon icon={CircleCheck} size={ICON_PRIMARY} />
								{translate(lang, 'live.finish')}
							{/if}
						</button>
					{/if}
					<button
						type="button"
						class="btn-ghost is-danger"
						disabled={finishing}
						onclick={onDiscard}
					>
						{translate(lang, 'live.discard')}
					</button>
				</footer>
			</div>
		</div>

		<div class="live-sticky-actions sticky-actions lg:hidden">
			<div class="sticky-actions__inner">
				{#if canGoNext}
					<button type="button" class="btn-primary btn-block min-h-12 gap-2" disabled={finishing} onclick={onNextExercise}>
						{translate(lang, 'live.nextExercise')}
						<LucideIcon icon={ChevronRight} size={ICON_PRIMARY} />
					</button>
					<button
						type="button"
						class="btn-secondary btn-block min-h-11 gap-2"
						disabled={finishing}
						aria-busy={finishing}
						onclick={() => void onFinish()}
					>
						{#if finishing}
							<Spinner size="sm" block={false} />
							{translate(lang, 'auth.wait')}
						{:else}
							<LucideIcon icon={CircleCheck} size={ICON_PRIMARY} />
							{translate(lang, 'live.finish')}
						{/if}
					</button>
				{:else}
					<button
						type="button"
						class="btn-primary btn-block min-h-12 gap-2"
						disabled={finishing}
						aria-busy={finishing}
						onclick={() => void onFinish()}
					>
						{#if finishing}
							<Spinner size="sm" block={false} />
							{translate(lang, 'auth.wait')}
						{:else}
							<LucideIcon icon={CircleCheck} size={ICON_PRIMARY} />
							{translate(lang, 'live.finish')}
						{/if}
					</button>
				{/if}
				<button
					type="button"
					class="btn-link mx-auto !text-[var(--color-muted)]"
					disabled={finishing}
					onclick={onDiscard}
				>
					{translate(lang, 'live.discard')}
				</button>
			</div>
		</div>
	</section>
{/if}
