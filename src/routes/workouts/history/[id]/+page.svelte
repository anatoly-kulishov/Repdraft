<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import HistoryDetailPageSkeleton from '$lib/components/history/HistoryDetailPageSkeleton.svelte';
	import ExerciseTechniqueSheet from '$lib/components/ExerciseTechniqueSheet.svelte';
	import Coachmark from '$lib/components/onboarding/Coachmark.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { WORKOUTS_HISTORY_HREF } from '$lib/domain/catalogLinks';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import {
		addCompletedLoggedSet,
		completedSetCount,
		finishedSessionLogEqual,
		removeLoggedExercise,
		removeLoggedSet,
		sessionDurationMs,
		sessionVolumeKg,
		updateLoggedSet
	} from '$lib/domain/session';
	import type { ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import { formatDurationMs, formatLongDate } from '$lib/i18n/format';
	import { translate, translateError } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { peekLocalSession } from '$lib/storage/localSessionRepository';
	import { resolvedLocale } from '$lib/stores/locale';
	import { draft } from '$lib/stores/draft';
	import { live } from '$lib/stores/live';
	import { onboarding } from '$lib/stores/onboarding';
	import { shouldShowCoachmark } from '$lib/domain/onboarding';
	import { toasts } from '$lib/stores/toasts';
	import { get } from 'svelte/store';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import SwipeToDelete from '$lib/components/SwipeToDelete.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { ChevronRight, Plus, Trash2 } from '@lucide/svelte';
	import HistoryDetailToolbar from './HistoryDetailToolbar.svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import {
		clampStoredWeightKg,
		coerceReps,
		coerceWeightKg,
		filterRepsInput,
		filterWeightInput,
		LIVE_REPS,
		REPS_INPUT_MAX_LEN,
		SETS,
		WEIGHT_INPUT_MAX_LEN
	} from '$lib/domain/inputLimits';

	let lang = $derived($resolvedLocale);
	let showHistoryDetailCoachmark = $derived(shouldShowCoachmark($onboarding, 'history.detail'));
	let session = $state<WorkoutSession | null>(null);
	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let missing = $state(false);
	let loading = $state(true);
	let deleting = $state(false);
	let editing = $state(false);
	let savingEdit = $state(false);
	let sendingToBuilder = $state(false);
	let deleteConfirmOpen = $state(false);
	let editSession = $state<WorkoutSession | null>(null);
	let editBaseline = $state<WorkoutSession | null>(null);
	let editDraft = $state<Record<string, { w: string; r: string }>>({});
	let fromPath = $derived($page.url.pathname);
	let viewSession = $derived(editing && editSession ? editSession : session);
	let editUnchanged = $derived.by(() => {
		if (!editing || !editSession || !editBaseline) return true;
		return finishedSessionLogEqual(applyDraft(editSession), editBaseline);
	});
	let historyVolumeKg = $derived(viewSession ? sessionVolumeKg(viewSession) : 0);
	let peekedSession = $derived.by(() => {
		if (!browser) return null;
		const id = $page.params.id;
		return id ? peekLocalSession(id) : null;
	});
	let technique = $state<{
		id: string;
		title: string;
		hint: string;
		image: string;
	} | null>(null);

	onMount(() => {
		void (async () => {
			const id = $page.params.id;
			if (!id) {
				missing = true;
				loading = false;
				return;
			}
			const peeked = peekLocalSession(id);
			if (peeked?.finishedAt) session = peeked;
			const found = session ?? (await live.getFinishedSession(id));
			if (!found) missing = true;
			else session = found;
			const index = await loadExerciseIndex();
			indexById = new Map(index.map((ex) => [ex.id, ex]));
			loading = false;
		})();
	});

	function offerDeleteSession() {
		if (deleting || loading || !session) return;
		deleteConfirmOpen = true;
	}

	function dismissDeleteOffer() {
		if (deleting) return;
		deleteConfirmOpen = false;
	}

	async function commitDeleteSession() {
		deleteConfirmOpen = false;
		await onDeleteSession();
	}

	async function onDeleteSession() {
		const id = $page.params.id;
		if (!id) return;
		const current = session ?? (await live.getFinishedSession(id));
		if (!current) return;
		deleting = true;
		try {
			const snapshot = $state.snapshot(current) as WorkoutSession;
			await live.removeFromHistory(id);
			toasts.showUndo(
				translate(lang, 'workouts.sessionDeleted'),
				async () => {
					await live.restoreSession(snapshot);
					void goto(`/workouts/history/${encodeURIComponent(id)}`, { replaceState: true });
				},
				'info'
			);
			session = null;
			await goto(WORKOUTS_HISTORY_HREF, { replaceState: true });
		} catch (err) {
			toasts.show(translateError(lang, err, 'workouts.sessionDeleteFail'), 'error');
		} finally {
			deleting = false;
		}
	}

	function setKey(exIndex: number, setIndex: number) {
		return `${exIndex}:${setIndex}`;
	}

	function draftFromSession(s: WorkoutSession) {
		const next: Record<string, { w: string; r: string }> = {};
		for (const [exIndex, ex] of s.exercises.entries()) {
			for (const [setIndex, set] of ex.sets.entries()) {
				next[setKey(exIndex, setIndex)] = {
					w: set.weightKg != null ? `${clampStoredWeightKg(set.weightKg)}` : '',
					r:
						set.reps != null
							? `${coerceReps(String(set.reps), LIVE_REPS) ?? LIVE_REPS.min}`
							: ''
				};
			}
		}
		return next;
	}

	function applyDraft(s: WorkoutSession) {
		let next = s;
		for (const [key, v] of Object.entries(editDraft)) {
			const [exIndexStr, setIndexStr] = key.split(':');
			const exIndex = Number(exIndexStr);
			const setIndex = Number(setIndexStr);
			const weightKg = v.w.trim() ? coerceWeightKg(v.w) : null;
			const reps = v.r.trim() ? coerceReps(v.r, LIVE_REPS) : null;
			next = updateLoggedSet(next, exIndex, setIndex, {
				weightKg,
				reps,
				completed: true
			});
		}
		return next;
	}

	function cloneForEdit(s: WorkoutSession): WorkoutSession {
		const cloned = $state.snapshot(s) as WorkoutSession;
		cloned.exercises = cloned.exercises.map((ex) => ({
			...ex,
			sets: ex.sets.filter((set) => set.completed)
		}));
		return cloned;
	}

	function startEdit() {
		const id = $page.params.id;
		if (!id) return;
		void (async () => {
			try {
				const current = await live.getFinishedSession(id);
				if (!current) {
					toasts.show(translate(lang, 'workouts.editSessionFail'), 'error');
					return;
				}
				const next = cloneForEdit(current);
				editBaseline = $state.snapshot(next) as WorkoutSession;
				editSession = next;
				editDraft = draftFromSession(next);
				editing = true;
			} catch (err) {
				toasts.show(translateError(lang, err, 'workouts.editSessionFail'), 'error');
			}
		})();
	}

	function cancelEdit() {
		editing = false;
		editSession = null;
		editBaseline = null;
		editDraft = {};
	}

	function addHistorySet(exIndex: number) {
		if (!editSession) return;
		if ((editSession.exercises[exIndex]?.sets.length ?? 0) >= SETS.max) return;
		const next = addCompletedLoggedSet(applyDraft(editSession), exIndex);
		editSession = next;
		editDraft = draftFromSession(next);
	}

	function removeHistorySet(exIndex: number, setIndex: number) {
		if (!editSession) return;
		const next = removeLoggedSet(applyDraft(editSession), exIndex, setIndex, {
			keepAtLeastOne: false
		});
		editSession = next;
		editDraft = draftFromSession(next);
	}

	function exerciseLabel(ex: { exerciseId: string }, meta: ExerciseIndexItem | null) {
		return meta ? exerciseName(meta, lang) : ex.exerciseId;
	}

	function removeHistoryExercise(exIndex: number, label: string) {
		if (!editSession) return;
		if (editSession.exercises.length <= 1) return;
		const snapshot = $state.snapshot(editSession) as WorkoutSession;
		const next = removeLoggedExercise(applyDraft(editSession), exIndex);
		editSession = next;
		editDraft = draftFromSession(next);
		toasts.showUndo(
			translate(lang, 'workouts.exerciseRemoved', { name: label }),
			() => {
				editSession = snapshot;
				editDraft = draftFromSession(snapshot);
			},
			'info'
		);
	}

	async function onSaveEdit() {
		if (!editSession) return;
		const id = $page.params.id;
		if (!id) return;
		const patched = applyDraft(editSession);
		if (editBaseline && finishedSessionLogEqual(patched, editBaseline)) {
			cancelEdit();
			return;
		}
		savingEdit = true;
		try {
			const ok = await live.patchFinishedSession(id, () => patched);

			if (!ok) {
				toasts.show(translate(lang, 'workouts.editSessionFail'), 'error');
				return;
			}

			session = await live.getFinishedSession(id);
			cancelEdit();
			toasts.show(translate(lang, 'workouts.sessionEdited'), 'success');
		} catch (err) {
			toasts.show(translateError(lang, err, 'workouts.editSessionFail'), 'error');
		} finally {
			savingEdit = false;
		}
	}

	function onToBuilder() {
		if (!session || sendingToBuilder || editing) return;
		const currentDraft = get(draft);
		if (
			currentDraft.exercises.length > 0 &&
			!confirm(translate(lang, 'workouts.confirmReplaceDraft'))
		) {
			return;
		}
		sendingToBuilder = true;
		try {
			draft.loadSessionIntoDraft(session);
			toasts.show(translate(lang, 'workouts.toBuilderToast'), 'success');
			void goto('/builder');
		} finally {
			sendingToBuilder = false;
		}
	}
</script>

{#snippet historyDetailActions()}
	<HistoryDetailToolbar
		{editing}
		{savingEdit}
		{deleting}
		{loading}
		{sendingToBuilder}
		saveDisabled={editUnchanged}
		canEdit={!!session}
		onSave={onSaveEdit}
		onCancel={cancelEdit}
		onEdit={startEdit}
		onDelete={offerDeleteSession}
		onToBuilder={onToBuilder}
	/>
{/snippet}

<SeoHead
	title={session ? session.planName : translate(lang, 'workouts.historyDetail')}
	noindex
/>

{#if loading}
	<header
		class="screen-header history-detail__screen-header history-detail-skeleton-head"
		aria-hidden="true"
	>
		<div class="screen-header__bar">
			<div class="history-detail-skeleton-head__back"></div>
			<div class="screen-header-actions">
				<div class="history-detail-skeleton-head__bar history-detail-skeleton-head__bar--action"></div>
				<div class="history-detail-skeleton-head__bar history-detail-skeleton-head__bar--action"></div>
				<div class="history-detail-skeleton-head__bar history-detail-skeleton-head__bar--action"></div>
			</div>
		</div>
		<div class="history-detail-skeleton-head__title screen-header-title">
			{#if peekedSession?.planName}
				{peekedSession.planName}
			{:else}
				<span class="history-detail-skeleton-head__title-bone" aria-hidden="true"></span>
			{/if}
		</div>
	</header>
	<HistoryDetailPageSkeleton sessionId={$page.params.id} />
{:else if missing || !session}
	<EmptyState
		title={translate(lang, 'live.noPlan')}
		description={translate(lang, 'workouts.emptyDesc')}
		actionHref={WORKOUTS_HISTORY_HREF}
		actionLabel={translate(lang, 'nav.workouts')}
	/>
{:else}
	<!-- Outside .history-detail: overflow-x:clip there would clip sticky full-bleed margins. -->
	<ScreenHeader
		class="history-detail__screen-header"
		title={session.planName}
		backHref={WORKOUTS_HISTORY_HREF}
		backLabelVisible
		backLabel={translate(lang, 'builder.backWorkouts')}
		actions={historyDetailActions}
	/>
	<section class="content-page content-page--narrow soft-enter history-detail">
		<p class="page-lead mt-1 lg:mt-0">
			{formatLongDate(session.finishedAt ?? session.startedAt, lang)} · {formatDurationMs(
				sessionDurationMs(session)
			)} · {translate(lang, 'workouts.historySets', {
				n: completedSetCount(viewSession ?? session)
			})}{#if historyVolumeKg > 0}
				{' '}· {Math.round(historyVolumeKg)} kg{/if}
		</p>

		{#if showHistoryDetailCoachmark}
			<Coachmark
				class="mt-3"
				message={translate(lang, 'onboarding.coachHistoryDetail')}
				onDismiss={() => onboarding.dismissCoachmark('history.detail')}
			/>
		{/if}

		<ul class="history-exercise-list">
			{#each (viewSession ?? session).exercises as ex, exIndex (ex.exerciseId)}
				{@const meta = indexById.get(ex.exerciseId) ?? null}
				{@const label = exerciseLabel(ex, meta)}
				{@const rows = editing
					? ex.sets.map((set, setIndex) => ({ set, setIndex }))
					: ex.sets.map((set, setIndex) => ({ set, setIndex })).filter(({ set }) => set.completed)}
				{@const canRemoveExercise =
					!savingEdit && (editSession?.exercises.length ?? 0) > 1}
				<li class="history-exercise" class:history-exercise--editing={editing}>
					{#if editing}
						<SwipeToDelete
							label={translate(lang, 'workouts.removeExercise')}
							disabled={!canRemoveExercise}
							onDelete={() => removeHistoryExercise(exIndex, label)}
						>
							<div class="history-exercise__head is-static is-editing">
								{#if meta}
									{@const title = label}
									<AppButton
										variant="ghost"
										class="history-exercise__thumb-btn media-well history-exercise__thumb !h-auto !min-h-[48px] !min-w-[48px] !p-0"
										aria-label={translate(lang, 'exercise.openTechnique', { name: title })}
										onclick={() => {
											technique = {
												id: meta.id,
												title,
												hint: `${labelTarget(meta.target, lang)} · ${labelEquipment(meta.equipment, lang)}`,
												image: meta.image
											};
										}}
									>
										<img
											src={`/${meta.image}`}
											alt=""
											width="180"
											height="180"
											loading="lazy"
											decoding="async"
										/>
									</AppButton>
								{:else}
									<span
										class="media-well history-exercise__thumb is-placeholder"
										aria-hidden="true"
									></span>
								{/if}
								<div class="workout-preview-row-body">
									<p class="workout-preview-row-title">{label}</p>
									{#if meta}
										<p class="workout-preview-row-sub">
											{labelTarget(meta.target, lang)} · {labelEquipment(meta.equipment, lang)}
										</p>
									{/if}
								</div>
								<AppButton
									variant="ghost"
									class="live-set-remove-btn history-exercise__remove"
									disabled={!canRemoveExercise}
									aria-label={translate(lang, 'workouts.removeExercise')}
									title={translate(lang, 'workouts.removeExercise')}
									onclick={() => removeHistoryExercise(exIndex, label)}
								>
									<LucideIcon icon={Trash2} size={ICON_SMALL} />
								</AppButton>
							</div>

							<!-- Sets / add: don't steal the exercise swipe gesture. -->
							<div data-swipe-pass class="history-exercise__edit-body">
								{#if rows.length > 0}
									<ul class="history-exercise__sets history-exercise__sets--editing">
										{#each rows as item, i (item.setIndex)}
											{@const key = setKey(exIndex, item.setIndex)}
											<li class="history-exercise__set tabular-nums">
												<span class="history-exercise__set-i">{i + 1}</span>
												<AppInput
													class="history-set-field history-set-weight tabular-nums"
													type="text"
													inputmode="decimal"
													autocomplete="off"
													maxlength={WEIGHT_INPUT_MAX_LEN}
													value={editDraft[key]?.w ?? ''}
													aria-label={translate(lang, 'live.weight')}
													oninput={(e) => {
														const el = e.currentTarget;
														const prev = editDraft[key]?.w ?? '';
														const next = filterWeightInput(el.value, prev);
														if (el.value !== next) el.value = next;
														editDraft[key] = {
															...(editDraft[key] ?? { w: '', r: '' }),
															w: next
														};
													}}
												/>
												<span class="history-exercise__set-unit">kg</span>
												<AppInput
													class="history-set-field history-set-reps tabular-nums"
													type="text"
													inputmode="numeric"
													autocomplete="off"
													maxlength={REPS_INPUT_MAX_LEN}
													value={editDraft[key]?.r ?? ''}
													aria-label={translate(lang, 'live.reps')}
													oninput={(e) => {
														const el = e.currentTarget;
														const prev = editDraft[key]?.r ?? '';
														const next = filterRepsInput(el.value, LIVE_REPS, prev);
														if (el.value !== next) el.value = next;
														editDraft[key] = {
															...(editDraft[key] ?? { w: '', r: '' }),
															r: next
														};
													}}
												/>
												<AppButton
													variant="ghost"
													class="live-set-remove-btn"
													aria-label={translate(lang, 'live.removeSet')}
													title={translate(lang, 'live.removeSet')}
													onclick={() => removeHistorySet(exIndex, item.setIndex)}
												>
													<LucideIcon icon={Trash2} size={ICON_SMALL} />
												</AppButton>
											</li>
										{/each}
									</ul>
								{:else}
									<p class="history-exercise__empty">{translate(lang, 'workouts.noLoggedSets')}</p>
								{/if}
								<AppButton
									variant="ghost"
									block
									class="history-exercise__add-set"
									disabled={savingEdit || ex.sets.length >= SETS.max}
									aria-label={translate(lang, 'live.addSet')}
									onclick={() => addHistorySet(exIndex)}
								>
									<LucideIcon icon={Plus} size={ICON_BUTTON} />
									{translate(lang, 'live.addSet')}
								</AppButton>
							</div>
						</SwipeToDelete>
					{:else if meta}
						{@const title = label}
						{@const detailHref = `/exercise/${meta.id}?from=${encodeURIComponent(fromPath)}`}
						<div class="history-exercise__head">
							<AppButton
								variant="ghost"
								class="history-exercise__thumb-btn media-well history-exercise__thumb !h-auto !min-h-[48px] !min-w-[48px] !p-0"
								aria-label={translate(lang, 'exercise.openTechnique', { name: title })}
								onclick={() => {
									technique = {
										id: meta.id,
										title,
										hint: `${labelTarget(meta.target, lang)} · ${labelEquipment(meta.equipment, lang)}`,
										image: meta.image
									};
								}}
							>
								<img
									src={`/${meta.image}`}
									alt=""
									width="180"
									height="180"
									loading="lazy"
									decoding="async"
								/>
							</AppButton>
							<a class="workout-preview-row-main" href={detailHref}>
								<div class="workout-preview-row-body">
									<p class="workout-preview-row-title">{title}</p>
									<p class="workout-preview-row-sub">
										{labelTarget(meta.target, lang)} · {labelEquipment(meta.equipment, lang)}
									</p>
								</div>
								<span class="workout-preview-chevron" aria-hidden="true">
									<LucideIcon icon={ChevronRight} size={ICON_BUTTON} />
								</span>
							</a>
						</div>

						{#if rows.length > 0}
							<ul
								class="history-exercise__sets"
								class:history-exercise__sets--grid={rows.length >= 4}
							>
								{#each rows as item, i (item.setIndex)}
									<li class="history-exercise__set tabular-nums">
										<span class="history-exercise__set-i">{i + 1}</span>
										{#if item.set.weightKg != null}
											<span class="history-exercise__set-weight"
												>{item.set.weightKg} {translate(lang, 'pr.kg')}</span
											>
											<span class="history-exercise__set-reps">× {item.set.reps ?? '-'}</span>
										{:else}
											<span class="history-exercise__set-reps">
												{item.set.reps != null
													? `${item.set.reps} ${translate(lang, 'pr.repsShort')}`
													: '-'}
											</span>
										{/if}
									</li>
								{/each}
							</ul>
						{:else}
							<p class="history-exercise__empty">{translate(lang, 'workouts.noLoggedSets')}</p>
						{/if}
					{:else}
						<div class="history-exercise__head is-static">
							<span
								class="media-well history-exercise__thumb is-placeholder"
								aria-hidden="true"
							></span>
							<div class="workout-preview-row-body">
								<p class="workout-preview-row-title">{ex.exerciseId}</p>
							</div>
						</div>
						{#if rows.length > 0}
							<ul
								class="history-exercise__sets"
								class:history-exercise__sets--grid={rows.length >= 4}
							>
								{#each rows as item, i (item.setIndex)}
									<li class="history-exercise__set tabular-nums">
										<span class="history-exercise__set-i">{i + 1}</span>
										{#if item.set.weightKg != null}
											<span class="history-exercise__set-weight"
												>{item.set.weightKg} {translate(lang, 'pr.kg')}</span
											>
											<span class="history-exercise__set-reps">× {item.set.reps ?? '-'}</span>
										{:else}
											<span class="history-exercise__set-reps">
												{item.set.reps != null
													? `${item.set.reps} ${translate(lang, 'pr.repsShort')}`
													: '-'}
											</span>
										{/if}
									</li>
								{/each}
							</ul>
						{:else}
							<p class="history-exercise__empty">{translate(lang, 'workouts.noLoggedSets')}</p>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if technique}
	<ExerciseTechniqueSheet
		open
		titleId={`history-technique-${technique.id}`}
		title={technique.title}
		hint={technique.hint}
		imagePath={technique.image}
		detailHref={`/exercise/${technique.id}?from=${encodeURIComponent(fromPath)}`}
		onDismiss={() => {
			technique = null;
		}}
	/>
{/if}

<BottomSheet
	open={deleteConfirmOpen}
	titleId="history-delete-session-title"
	dismissible={!deleting}
	onDismiss={dismissDeleteOffer}
>
	<p id="history-delete-session-title" class="bottom-sheet__title">
		{translate(lang, 'workouts.confirmDeleteSession', {
			name: session?.planName ?? translate(lang, 'workouts.historyDetail')
		})}
	</p>
	{#snippet actions()}
		<AppButton variant="secondary" disabled={deleting} onclick={dismissDeleteOffer}>
			{translate(lang, 'common.cancel')}
		</AppButton>
		<AppButton
			variant="danger"
			disabled={deleting}
			aria-busy={deleting}
			onclick={() => void commitDeleteSession()}
		>
			{translate(lang, 'common.delete')}
		</AppButton>
	{/snippet}
</BottomSheet>
