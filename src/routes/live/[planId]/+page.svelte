<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LiveAltPicker from '$lib/components/live/LiveAltPicker.svelte';
	import LiveExerciseNav from '$lib/components/live/LiveExerciseNav.svelte';
	import LiveSessionActions from '$lib/components/live/LiveSessionActions.svelte';
	import LiveSetPanel from '$lib/components/live/LiveSetPanel.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL, ICON_BUTTON } from '$lib/components/icons/sizes';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { exerciseName } from '$lib/domain/exerciseName';
	import {
		altGroupNeedsPick,
		completedSetCount,
		isSessionFullyLogged,
		nextManualExerciseFocus,
		totalSetCount,
		visibleSessionExerciseIndices
	} from '$lib/domain/session';
	import type { ExerciseIndexItem, WorkoutPlan } from '$lib/domain/types';
	import { altGroupBounds, groupBounds, groupMemberRole } from '$lib/domain/workout';
	import { acquireScreenWakeLock, releaseScreenWakeLock } from '$lib/media/wakeLock';
	import { formatElapsedClock, formatRestSec } from '$lib/i18n/format';
	import { bootLivePage } from '$lib/live/livePageBoot';
	import { startLiveRestTicker, type LiveRestTicker } from '$lib/live/liveRestTicker';
	import { createLiveSetActions } from '$lib/live/liveSetActions';
	import { pickDefaultExerciseIndex } from '$lib/live/sessionUi';
	import { translate, translateError } from '$lib/i18n/messages';
	import { navigateBack } from '$lib/navigation/back';
	import { live } from '$lib/stores/live';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { onboarding } from '$lib/stores/onboarding';
	import { shouldShowCoachmark } from '$lib/domain/onboarding';
	import Coachmark from '$lib/components/onboarding/Coachmark.svelte';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { onDestroy, onMount, tick as nextFrame } from 'svelte';
	import { ArrowLeft } from '@lucide/svelte';

	let { params } = $props();

	let lang = $derived($resolvedLocale);
	let showLiveLoggingCoachmark = $derived(shouldShowCoachmark($onboarding, 'live.logging'));
	let showLiveFinishCoachmark = $derived(shouldShowCoachmark($onboarding, 'live.finish'));
	let session = $derived($live.session);
	let restUntil = $derived($live.restUntil);
	let loading = $state(true);
	let finishing = $state(false);
	let finishOfferOpen = $state(false);
	let discardOfferOpen = $state(false);
	let skipExerciseOfferOpen = $state(false);
	let switchOfferOpen = $state(false);
	let pendingSwitchPlan = $state<WorkoutPlan | null>(null);
	let resumeActivePlanId = $state<string | null>(null);
	let missing = $state(false);
	let names = $state(new Map<string, ExerciseIndexItem>());
	let now = $state(Date.now());
	let selectedExerciseIndex = $state(0);
	let invalidSetIndex = $state<number | null>(null);
	let invalidKind = $state<'weight' | 'reps' | null>(null);
	let restChimeArmed = $state(false);
	let justDoneSetIndex = $state<number | null>(null);
	let forceAltPick = $state(false);
	let restTicker: LiveRestTicker | null = null;

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
	let hasNextExercise = $derived.by(() => {
		if (!session) return false;
		if (isSessionFullyLogged(session)) return false;
		const visible = visibleSessionExerciseIndices(session);
		const pos = visible.indexOf(selectedExerciseIndex);
		if (pos >= 0) return pos < visible.length - 1;
		return visible.some((i) => i > selectedExerciseIndex);
	});
	let currentExerciseComplete = $derived.by(() => {
		const ex = session?.exercises[selectedExerciseIndex];
		return Boolean(ex && ex.sets.length > 0 && ex.sets.every((s) => s.completed));
	});
	let sessionComplete = $derived(session != null && isSessionFullyLogged(session));
	let slotProgress = $derived.by(() => {
		if (!session) return { done: 1, total: 1 };
		const visible = visibleSessionExerciseIndices(session);
		const pos = visible.indexOf(selectedExerciseIndex);
		return {
			done: (pos >= 0 ? pos : 0) + 1,
			total: Math.max(1, visible.length)
		};
	});
	let needsAltPick = $derived(
		session != null && (forceAltPick || altGroupNeedsPick(session, selectedExerciseIndex))
	);
	let altPickMembers = $derived.by(() => {
		if (!session) return [];
		const ab = altGroupBounds(session.exercises, selectedExerciseIndex);
		if (!ab || ab.start === ab.end) return [];
		return session.exercises.slice(ab.start, ab.end + 1);
	});
	let canSwapAlternative = $derived.by(() => {
		if (!session || forceAltPick || altGroupNeedsPick(session, selectedExerciseIndex)) {
			return false;
		}
		const ab = altGroupBounds(session.exercises, selectedExerciseIndex);
		if (!ab || ab.start === ab.end) return false;
		const chosenId = (session.altChoices ?? {})[ab.altGroupId];
		if (!chosenId) return false;
		const chosen = session.exercises.find(
			(ex) => ex.altGroupId === ab.altGroupId && ex.exerciseId === chosenId
		);
		return Boolean(chosen && !chosen.sets.some((s) => s.completed));
	});
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

	$effect(() => {
		if (session && completedSetCount(session) > 0) {
			onboarding.markChecklist('setLogged');
		}
	});

	onMount(() => {
		onboarding.markChecklist('liveEntered');
		void acquireScreenWakeLock();

		restTicker = startLiveRestTicker({
			onNow: (t) => {
				now = t;
			},
			getRestChimeArmed: () => restChimeArmed,
			setRestChimeArmed: (armed) => {
				restChimeArmed = armed;
			}
		});

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
				const result = await bootLivePage(params.planId);
				switch (result.kind) {
					case 'resume':
						selectedExerciseIndex = result.selectedExerciseIndex;
						if (result.openFinishOffer) {
							live.skipRest();
							finishOfferOpen = true;
						}
						break;
					case 'switch':
						pendingSwitchPlan = result.pendingSwitchPlan;
						resumeActivePlanId = result.resumeActivePlanId;
						switchOfferOpen = true;
						break;
					case 'missing':
						missing = true;
						break;
					case 'redirect':
						break;
					case 'started':
						selectedExerciseIndex = result.selectedExerciseIndex;
						break;
					default: {
						const _exhaustive: never = result;
						void _exhaustive;
					}
				}
			} catch (err) {
				console.error('live boot failed', err);
				missing = true;
			} finally {
				loading = false;
			}
		})();
	});

	onDestroy(() => {
		restTicker?.stop();
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

	function liveSetActionDeps() {
		return {
			getSession: () => get(live).session,
			patchSet: (ei: number, si: number, patch: Parameters<typeof live.patchSet>[2]) =>
				live.patchSet(ei, si, patch),
			setSetsCompleted: (ei: number, indexes: number[], completed: boolean) =>
				live.setSetsCompleted(ei, indexes, completed),
			skipRest: () => live.skipRest(),
			getRestUntil: () => get(live).restUntil,
			showToast: (message: string, kind: 'error' | 'success') => toasts.show(message, kind),
			invalidWeightMsg: translate(lang, 'pr.invalidWeight'),
			invalidRepsMsg: translate(lang, 'live.invalidReps'),
			setInvalid: (si: number | null, kind: 'weight' | 'reps' | null) => {
				if (si == null || kind == null) {
					invalidSetIndex = null;
					invalidKind = null;
					return;
				}
				void flashSetInvalid(si, kind);
			},
			clearInvalidIf: (si: number) => {
				if (invalidSetIndex === si) {
					invalidSetIndex = null;
					invalidKind = null;
				}
			},
			setSelectedExerciseIndex: (index: number) => {
				selectedExerciseIndex = index;
			},
			setJustDoneSetIndex: (si: number | null) => {
				justDoneSetIndex = si;
			},
			setRestChimeArmed: (armed: boolean) => {
				restChimeArmed = armed;
			},
			openFinishOffer: () => {
				finishOfferOpen = true;
			}
		};
	}

	function onWeight(ei: number, si: number, value: string) {
		return createLiveSetActions(liveSetActionDeps()).onWeight(ei, si, value);
	}

	function onReps(ei: number, si: number, value: string) {
		return createLiveSetActions(liveSetActionDeps()).onReps(ei, si, value);
	}

	function onComplete(ei: number, si: number) {
		createLiveSetActions(liveSetActionDeps()).onComplete(ei, si);
	}

	function onToggleAllComplete(ei: number) {
		createLiveSetActions(liveSetActionDeps()).onToggleAllComplete(ei);
	}

	function goNextExercise() {
		forceAltPick = false;
		if (!session) return;
		selectedExerciseIndex = nextManualExerciseFocus(session, selectedExerciseIndex);
	}

	function skipExerciseTitle(index: number): string {
		if (!session) return '';
		const id = session.exercises[index]?.exerciseId;
		if (!id) return '';
		const item = names.get(id);
		return item ? exerciseName(item, lang) : translate(lang, 'records.fallback', { id });
	}

	function onSkipExercise() {
		if (finishing || !session) return;
		finishOfferOpen = false;
		discardOfferOpen = false;
		skipExerciseOfferOpen = true;
	}

	function dismissSkipExerciseOffer() {
		if (finishing) return;
		skipExerciseOfferOpen = false;
	}

	function commitSkipExercise() {
		if (finishing || !session) return;
		const ei = selectedExerciseIndex;
		live.skipExercise(ei);
		skipExerciseOfferOpen = false;
		justDoneSetIndex = null;
		invalidSetIndex = null;
		invalidKind = null;
		restChimeArmed = false;
		const next = get(live).session;
		if (!next) return;
		if (next.exercises.length === 0) {
			discardOfferOpen = true;
			return;
		}
		selectedExerciseIndex = pickDefaultExerciseIndex(next);
		if (isSessionFullyLogged(next)) {
			finishOfferOpen = true;
		}
	}

	function onChooseAlt(exerciseId: string) {
		if (!session) return;
		const ab = altGroupBounds(session.exercises, selectedExerciseIndex);
		if (!ab) return;
		live.chooseAlt(ab.altGroupId, exerciseId);
		forceAltPick = false;
		const next = get(live).session;
		if (!next) return;
		const idx = next.exercises.findIndex(
			(ex, ei) => ei >= ab.start && ei <= ab.end && ex.exerciseId === exerciseId
		);
		if (idx >= 0) selectedExerciseIndex = idx;
	}

	function selectExercise(index: number) {
		forceAltPick = false;
		selectedExerciseIndex = index;
	}

	async function onFinish() {
		if (finishing) return;
		discardOfferOpen = false;
		// In-app confirm: window.confirm often fails silently in WebViews / PWA shells.
		if (!finishOfferOpen) {
			finishOfferOpen = true;
			return;
		}
		await commitFinish();
	}

	async function commitFinish() {
		if (finishing) return;
		finishing = true;
		finishOfferOpen = false;
		discardOfferOpen = false;
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

	function dismissFinishOffer() {
		if (finishing) return;
		finishOfferOpen = false;
	}

	function onDiscard() {
		if (finishing) return;
		finishOfferOpen = false;
		if (!discardOfferOpen) {
			discardOfferOpen = true;
			return;
		}
		commitDiscard();
	}

	function commitDiscard() {
		discardOfferOpen = false;
		live.discard();
		void goto('/workouts', { replaceState: true });
	}

	function dismissDiscardOffer() {
		if (finishing) return;
		discardOfferOpen = false;
	}

	function keepCurrentLiveSession() {
		const id = resumeActivePlanId;
		switchOfferOpen = false;
		pendingSwitchPlan = null;
		resumeActivePlanId = null;
		if (id) void goto(`/live/${id}`);
		else void goto('/workouts');
	}

	async function confirmSwitchLivePlan() {
		const plan = pendingSwitchPlan;
		switchOfferOpen = false;
		pendingSwitchPlan = null;
		resumeActivePlanId = null;
		if (!plan) return;
		live.discard();
		loading = true;
		try {
			await live.startFromPlan(plan);
			const started = get(live).session;
			if (started) selectedExerciseIndex = pickDefaultExerciseIndex(started);
		} catch (err) {
			console.error('live switch start failed', err);
			missing = true;
		} finally {
			loading = false;
		}
	}
</script>

{#snippet liveHeaderActions()}
	<span class="screen-header-timer" aria-live="polite">{elapsedLabel}</span>
{/snippet}

<svelte:head>
	<title>{session ? session.planName : translate(lang, 'live.title')} · Repdraft</title>
</svelte:head>

{#if switchOfferOpen}
	<BottomSheet
		open={switchOfferOpen}
		titleId="live-switch-offer-title"
		onDismiss={keepCurrentLiveSession}
	>
		<p id="live-switch-offer-title" class="bottom-sheet__title">
			{translate(lang, 'live.confirmDiscard')}
		</p>
		<p class="bottom-sheet__hint">{translate(lang, 'live.switchOfferHint')}</p>
		{#snippet actions()}
			<AppButton variant="secondary" onclick={keepCurrentLiveSession}>
				{translate(lang, 'live.switchKeepCurrent')}
			</AppButton>
			<AppButton variant="danger" onclick={() => void confirmSwitchLivePlan()}>
				{translate(lang, 'live.switchStartNew')}
			</AppButton>
		{/snippet}
	</BottomSheet>
{:else if loading && !(session && !session.finishedAt && session.planId === params.planId)}
	<PageSkeleton variant="live" rows={4} />
{:else if missing || !session}
	<div class="mx-auto max-w-md space-y-3">
		<EmptyState
			title={translate(lang, 'live.noPlan')}
			description={translate(lang, 'live.emptyPlan')}
			actionHref="/workouts"
			actionLabel={translate(lang, 'live.backPlans')}
		/>
		{#if $live.session && !$live.session.finishedAt}
			<AppButton
				block
				variant="danger"
				onclick={() => {
					live.discard();
					void goto('/workouts');
				}}
			>
				{translate(lang, 'live.discard')}
			</AppButton>
		{/if}
	</div>
{:else}
	<section class="live-page lg:pb-4">
		<div class="lg:hidden">
			<ScreenHeader
				fixed
				class="screen-header--live"
				title={session.planName}
				backHref="/workouts"
				actions={liveHeaderActions}
			/>
		</div>

		<div class="live-mobile-meta lg:hidden">
			<p class="live-progress-pill">
				{translate(lang, 'live.progress', {
					done: slotProgress.done,
					total: slotProgress.total
				})}
				<span class="live-progress-pill__sep" aria-hidden="true">·</span>
				{translate(lang, 'home.setsProgress', {
					done: completedSetCount(session),
					total: totalSetCount(session)
				})}
			</p>
		</div>

		<header class="live-header hidden lg:flex">
			<div class="live-header-main">
				<button
					type="button"
					class="live-back"
					aria-label={translate(lang, 'live.backPlans')}
					title={translate(lang, 'live.backPlans')}
					onclick={() => navigateBack('/workouts')}
				>
					<LucideIcon icon={ArrowLeft} size={ICON_BUTTON} />
				</button>
				<h1 class="live-plan-title">{session.planName}</h1>
			</div>
			<div class="live-header-meta">
				<p class="live-progress-pill">
					{translate(lang, 'live.progress', {
						done: slotProgress.done,
						total: slotProgress.total
					})}
				</p>
				<p class="live-progress-pill">
					{translate(lang, 'home.setsProgress', {
						done: completedSetCount(session),
						total: totalSetCount(session)
					})}
				</p>
				<p class="live-timer" aria-live="polite">{elapsedLabel}</p>
			</div>
		</header>

		<div class="live-workspace">
			<LiveExerciseNav
				{session}
				{selectedExerciseIndex}
				{names}
				{lang}
				onSelect={selectExercise}
			/>

			<div class="live-panel-wrap">
				{#if needsAltPick}
					<LiveAltPicker
						members={altPickMembers}
						{names}
						{lang}
						onConfirm={onChooseAlt}
					/>
				{:else}
					{#if showLiveLoggingCoachmark}
						<Coachmark
							message={translate(lang, 'onboarding.coachLiveLogging')}
							onDismiss={() => onboarding.dismissCoachmark('live.logging')}
						/>
					{/if}
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
								{canSwapAlternative}
								onSwapAlternative={() => {
									forceAltPick = true;
								}}
								onSkip={onSkipExercise}
								onWeight={(si, v) => onWeight(ei, si, v)}
								onReps={(si, v) => onReps(ei, si, v)}
								onComplete={(si) => onComplete(ei, si)}
								onUncomplete={(si) => {
									if (justDoneSetIndex === si) justDoneSetIndex = null;
									live.patchSet(ei, si, { completed: false });
								}}
								onToggleAllComplete={() => onToggleAllComplete(ei)}
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
				{/if}

				{#if showLiveFinishCoachmark}
					<Coachmark
						message={translate(lang, 'onboarding.coachLiveFinish')}
						onDismiss={() => onboarding.dismissCoachmark('live.finish')}
					/>
				{/if}

				<LiveSessionActions
					{lang}
					{finishing}
					{hasNextExercise}
					{currentExerciseComplete}
					layout="desktop"
					onNext={goNextExercise}
					onFinish={() => void onFinish()}
					onDiscard={onDiscard}
					restLeft={sessionComplete ? 0 : restLeft}
					restPct={restPct}
					restLabel={formatRestSec(restLeft)}
					onRestMinus={() => {
						restChimeArmed = true;
						live.adjustRestSeconds(-30);
					}}
					onRestPlus={() => {
						restChimeArmed = true;
						live.adjustRestSeconds(30);
					}}
					onRestSkip={() => {
						restChimeArmed = false;
						live.skipRest();
					}}
				/>
			</div>

			<div class="live-mobile-actions lg:hidden">
				<LiveSessionActions
					{lang}
					{finishing}
					{hasNextExercise}
					{currentExerciseComplete}
					layout="mobile"
					onNext={goNextExercise}
					onFinish={() => void onFinish()}
					onDiscard={onDiscard}
					restLeft={sessionComplete ? 0 : restLeft}
					restPct={restPct}
					restLabel={formatRestSec(restLeft)}
					onRestMinus={() => {
						restChimeArmed = true;
						live.adjustRestSeconds(-30);
					}}
					onRestPlus={() => {
						restChimeArmed = true;
						live.adjustRestSeconds(30);
					}}
					onRestSkip={() => {
						restChimeArmed = false;
						live.skipRest();
					}}
				/>
			</div>
		</div>

		{#if skipExerciseOfferOpen}
			<BottomSheet
				open={skipExerciseOfferOpen}
				titleId="live-skip-exercise-title"
				dismissible={!finishing}
				onDismiss={dismissSkipExerciseOffer}
			>
				<p id="live-skip-exercise-title" class="bottom-sheet__title">
					{translate(lang, 'live.confirmSkipExercise', {
						name: skipExerciseTitle(selectedExerciseIndex)
					})}
				</p>
				<p class="bottom-sheet__hint">{translate(lang, 'live.skipExerciseHint')}</p>
				{#snippet actions()}
					<AppButton variant="secondary" disabled={finishing} onclick={dismissSkipExerciseOffer}>
						{translate(lang, 'live.finishOfferLater')}
					</AppButton>
					<AppButton variant="danger" disabled={finishing} onclick={commitSkipExercise}>
						{translate(lang, 'live.skipExerciseConfirm')}
					</AppButton>
				{/snippet}
			</BottomSheet>
		{:else if finishOfferOpen}
			<BottomSheet
				open={finishOfferOpen}
				titleId="live-finish-offer-title"
				dismissible={!finishing}
				onDismiss={dismissFinishOffer}
			>
				<p id="live-finish-offer-title" class="bottom-sheet__title">
					{translate(lang, sessionComplete ? 'live.finishOfferReady' : 'live.confirmFinish')}
				</p>
				{#if sessionComplete}
					<p class="bottom-sheet__hint">{translate(lang, 'live.finishOfferHint')}</p>
				{/if}
				{#snippet actions()}
					<AppButton variant="secondary" disabled={finishing} onclick={dismissFinishOffer}>
						{translate(lang, 'live.finishOfferLater')}
					</AppButton>
					<AppButton disabled={finishing} aria-busy={finishing} onclick={() => void commitFinish()}>
						{translate(lang, 'live.finish')}
					</AppButton>
				{/snippet}
			</BottomSheet>
		{:else if discardOfferOpen}
			<BottomSheet
				open={discardOfferOpen}
				titleId="live-discard-offer-title"
				dismissible={!finishing}
				onDismiss={dismissDiscardOffer}
			>
				<p id="live-discard-offer-title" class="bottom-sheet__title">
					{translate(lang, 'live.confirmDiscard')}
				</p>
				{#snippet actions()}
					<AppButton variant="secondary" disabled={finishing} onclick={dismissDiscardOffer}>
						{translate(lang, 'live.finishOfferLater')}
					</AppButton>
					<AppButton variant="danger" disabled={finishing} onclick={commitDiscard}>
						{translate(lang, 'live.discard')}
					</AppButton>
				{/snippet}
			</BottomSheet>
		{/if}
	</section>
{/if}
