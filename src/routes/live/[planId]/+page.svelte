<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LiveExerciseNav from '$lib/components/live/LiveExerciseNav.svelte';
	import LiveSessionActions from '$lib/components/live/LiveSessionActions.svelte';
	import LiveSetPanel from '$lib/components/live/LiveSetPanel.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { coerceReps, coerceWeightKg, LIVE_REPS } from '$lib/domain/inputLimits';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { completedSetCount, nextFocusAfterSetComplete, totalSetCount } from '$lib/domain/session';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { groupBounds, groupMemberRole } from '$lib/domain/workout';
	import { playRestDoneChime, unlockAudioFromGesture, vibrateRestDone } from '$lib/domain/prefs';
	import { acquireScreenWakeLock, releaseScreenWakeLock } from '$lib/media/wakeLock';
	import { formatElapsedClock, formatRestSec } from '$lib/i18n/format';
	import { pickDefaultExerciseIndex } from '$lib/live/sessionUi';
	import { translate, translateError } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { plans } from '$lib/stores/plans';
	import { restSoundEnabled } from '$lib/stores/prefs';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { onDestroy, onMount, tick as nextFrame } from 'svelte';
	import { ArrowLeft, Timer } from '@lucide/svelte';

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
	let invalidSetIndex = $state<number | null>(null);
	let invalidKind = $state<'weight' | 'reps' | null>(null);
	let restChimeArmed = $state(false);
	let justDoneSetIndex = $state<number | null>(null);
	let tick: ReturnType<typeof setInterval> | null = null;

	let selectedRole = $derived(
		session ? groupMemberRole(session.exercises, selectedExerciseIndex) : 'solo'
	);
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

	let elapsedLabel = $derived(
		session?.startedAt ? formatElapsedClock(now - new Date(session.startedAt).getTime()) : '0:00'
	);
	let restLeft = $derived(
		restUntil != null ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0
	);
	let restTotalSec = $state(0);
	$effect(() => {
		if (restUntil == null) {
			restTotalSec = 0;
			return;
		}
		const left = Math.max(0, Math.ceil((restUntil - now) / 1000));
		if (left > restTotalSec) restTotalSec = left;
	});
	let restPct = $derived(restTotalSec > 0 ? (restLeft / restTotalSec) * 100 : 0);
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

	$effect(() => {
		if (restUntil != null && restUntil > Date.now()) {
			restChimeArmed = true;
		}
	});

	onMount(() => {
		const unlockOnce = () => unlockAudioFromGesture();
		window.addEventListener('pointerdown', unlockOnce, { once: true, capture: true });
		void acquireScreenWakeLock();

		tick = setInterval(() => {
			now = Date.now();
			const until = get(live).restUntil;
			if (until != null && until <= Date.now()) {
				if (restChimeArmed) {
					vibrateRestDone();
					if (get(restSoundEnabled)) playRestDoneChime();
				}
				restChimeArmed = false;
				live.skipRest();
			}
		}, 250);

		void (async () => {
			live.hydrate();
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
				const plan = await plans.getPlan(planId);

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
		void releaseScreenWakeLock();
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

	async function flashSetInvalid(si: number, kind: 'weight' | 'reps') {
		invalidSetIndex = null;
		invalidKind = null;
		await nextFrame();
		invalidSetIndex = si;
		invalidKind = kind;
	}

	function onWeight(ei: number, si: number, value: string) {
		if (invalidSetIndex === si) {
			invalidSetIndex = null;
			invalidKind = null;
		}
		if (!value.trim()) {
			live.patchSet(ei, si, { weightKg: null });
			return;
		}
		const n = coerceWeightKg(value);
		if (n == null) return;
		live.patchSet(ei, si, { weightKg: n });
	}

	function onReps(ei: number, si: number, value: string) {
		if (invalidSetIndex === si) {
			invalidSetIndex = null;
			invalidKind = null;
		}
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
			void flashSetInvalid(si, 'weight');
			return;
		}
		if (set.reps == null || !Number.isInteger(set.reps) || set.reps < LIVE_REPS.min || set.reps > LIVE_REPS.max) {
			toasts.show(translate(lang, 'live.invalidReps'), 'error');
			void flashSetInvalid(si, 'reps');
			return;
		}
		invalidSetIndex = null;
		invalidKind = null;
		unlockAudioFromGesture();
		live.patchSet(ei, si, { completed: true });
		restChimeArmed = get(live).restUntil != null;
		if (restChimeArmed) unlockAudioFromGesture();
		justDoneSetIndex = si;
		const next = get(live).session;
		if (!next) return;
		selectedExerciseIndex = nextFocusAfterSetComplete(next, ei, si);
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
				await goto('/workouts?tab=history');
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
</script>

{#snippet liveHeaderActions()}
	<span class="screen-header-timer" aria-live="polite">{elapsedLabel}</span>
{/snippet}

<svelte:head>
	<title>{session ? session.planName : translate(lang, 'live.title')} · Repdraft</title>
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
			<p class="live-local-hint">{translate(lang, 'live.localSaveHint')}</p>
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
				<p class="live-local-hint">{translate(lang, 'live.localSaveHint')}</p>
			</div>
		</header>

		{#if restLeft > 0}
			<div class="live-rest" role="status" aria-live="polite">
				<div class="live-rest__main">
					<div
						class="live-rest-ring"
						style={`--rest-pct: ${restPct}`}
						aria-hidden="true"
					>
						<div class="live-rest-ring__inner">
							{#key restLeft}
								<span class="live-rest-value">{formatRestSec(restLeft)}</span>
							{/key}
						</div>
					</div>
					<div class="live-rest__copy">
						<p class="live-rest-label">
							<LucideIcon icon={Timer} size={ICON_SMALL} />
							{translate(lang, 'live.rest')}
						</p>
						<div class="live-rest__presets">
							<button
								type="button"
								class="btn-ghost live-rest__chip"
								onclick={() => {
									restChimeArmed = true;
									live.setRestSeconds(60);
								}}
							>
								{translate(lang, 'live.restPreset60')}
							</button>
							<button
								type="button"
								class="btn-ghost live-rest__chip"
								onclick={() => {
									restChimeArmed = true;
									live.setRestSeconds(90);
								}}
							>
								{translate(lang, 'live.restPreset90')}
							</button>
							<button
								type="button"
								class="btn-ghost live-rest__chip"
								onclick={() => {
									restChimeArmed = true;
									live.setRestSeconds(120);
								}}
							>
								{translate(lang, 'live.restPreset120')}
							</button>
						</div>
					</div>
				</div>
				<div class="live-rest__actions">
					<button
						type="button"
						class="btn-ghost live-rest__chip"
						onclick={() => {
							restChimeArmed = true;
							live.adjustRestSeconds(-15);
						}}
					>
						{translate(lang, 'live.restMinus15')}
					</button>
					<button
						type="button"
						class="btn-ghost live-rest__chip"
						onclick={() => {
							restChimeArmed = true;
							live.adjustRestSeconds(15);
						}}
					>
						{translate(lang, 'live.restPlus15')}
					</button>
					<button
						type="button"
						class="btn-secondary"
						onclick={() => {
							restChimeArmed = false;
							live.skipRest();
						}}
					>
						{translate(lang, 'live.skipRest')}
					</button>
				</div>
			</div>
		{/if}

		<div class="live-workspace">
			<LiveExerciseNav
				{session}
				{selectedExerciseIndex}
				{names}
				{lang}
				onSelect={(i) => (selectedExerciseIndex = i)}
			/>

			<div class="live-panel-wrap">
				{#each session.exercises as ex, ei (ex.exerciseId + '-' + ei)}
					{#if ei === selectedExerciseIndex}
						<LiveSetPanel
							{session}
							exerciseIndex={ei}
							exercise={ex}
							{names}
							{lang}
							{selectedInGroup}
							{selectedGroupPos}
							{nextInSupersetName}
							{activeSetProgress}
							onWeight={(si, v) => onWeight(ei, si, v)}
							onReps={(si, v) => onReps(ei, si, v)}
							onComplete={(si) => onComplete(ei, si)}
							onUncomplete={(si) => {
								if (justDoneSetIndex === si) justDoneSetIndex = null;
								live.patchSet(ei, si, { completed: false });
							}}
							onRemove={(si) => {
								if (invalidSetIndex === si) {
									invalidSetIndex = null;
									invalidKind = null;
								} else if (invalidSetIndex != null && invalidSetIndex > si) {
									invalidSetIndex -= 1;
								}
								if (justDoneSetIndex === si) justDoneSetIndex = null;
								else if (justDoneSetIndex != null && justDoneSetIndex > si) {
									justDoneSetIndex -= 1;
								}
								live.removeSet(ei, si);
							}}
							{invalidSetIndex}
							{invalidKind}
							{justDoneSetIndex}
						/>
					{/if}
				{/each}

				<LiveSessionActions
					{lang}
					{finishing}
					{canGoNext}
					layout="desktop"
					onNext={() => (selectedExerciseIndex += 1)}
					onFinish={() => void onFinish()}
					onDiscard={onDiscard}
				/>
			</div>
		</div>

		<LiveSessionActions
			{lang}
			{finishing}
			{canGoNext}
			layout="mobile"
			onNext={() => (selectedExerciseIndex += 1)}
			onFinish={() => void onFinish()}
			onDiscard={onDiscard}
		/>
	</section>
{/if}
