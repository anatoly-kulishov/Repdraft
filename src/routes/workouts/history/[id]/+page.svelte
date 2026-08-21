<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { WORKOUTS_HISTORY_HREF } from '$lib/domain/catalogLinks';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import {
		addCompletedLoggedSet,
		completedSetCount,
		removeLoggedExercise,
		removeLoggedSet,
		sessionDurationMs,
		sessionVolumeKg,
		updateLoggedSet
	} from '$lib/domain/session';
	import type { ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import { formatDurationMs, formatLongDate } from '$lib/i18n/format';
	import { translate, translateError } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { draft } from '$lib/stores/draft';
	import { live } from '$lib/stores/live';
	import { toasts } from '$lib/stores/toasts';
	import { get } from 'svelte/store';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { ChevronRight, Plus, Trash2 } from '@lucide/svelte';
	import HistoryDetailToolbar from './HistoryDetailToolbar.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import {
		coerceReps,
		coerceWeightKg,
		filterRepsInput,
		filterWeightInput,
		LIVE_REPS,
		SETS
	} from '$lib/domain/inputLimits';

	let lang = $derived($resolvedLocale);
	let session = $state<WorkoutSession | null>(null);
	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());
	let missing = $state(false);
	let loading = $state(true);
	let deleting = $state(false);
	let editing = $state(false);
	let savingEdit = $state(false);
	let sendingToBuilder = $state(false);
	let editSession = $state<WorkoutSession | null>(null);
	let editDraft = $state<Record<string, { w: string; r: string }>>({});
	let fromPath = $derived($page.url.pathname);
	let viewSession = $derived(editing && editSession ? editSession : session);
	let historyVolumeKg = $derived(viewSession ? sessionVolumeKg(viewSession) : 0);

	onMount(() => {
		void (async () => {
			const id = $page.params.id;
			if (!id) {
				missing = true;
				loading = false;
				return;
			}
			const found = await live.getFinishedSession(id);
			if (!found) missing = true;
			else session = found;
			const index = await loadExerciseIndex();
			indexById = new Map(index.map((ex) => [ex.id, ex]));
			loading = false;
		})();
	});

	async function onDeleteSession() {
		const id = $page.params.id;
		if (!id) return;
		const current = session ?? (await live.getFinishedSession(id));
		if (!current) return;
		if (!confirm(translate(lang, 'workouts.confirmDeleteSession', { name: current.planName }))) {
			return;
		}
		deleting = true;
		try {
			await live.removeFromHistory(id);
			toasts.show(translate(lang, 'workouts.sessionDeleted'), 'info');
			void goto(WORKOUTS_HISTORY_HREF, { replaceState: true });
		} catch (err) {
			toasts.show(translateError(lang, err, 'workouts.sessionDeleteFail'), 'error');
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
					w: set.weightKg != null ? `${set.weightKg}` : '',
					r: set.reps != null ? `${set.reps}` : ''
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
		const cloned = structuredClone(s);
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
		if (!confirm(translate(lang, 'workouts.confirmRemoveExercise', { name: label }))) return;
		const next = removeLoggedExercise(applyDraft(editSession), exIndex);
		editSession = next;
		editDraft = draftFromSession(next);
	}

	async function onSaveEdit() {
		if (!editSession) return;
		const id = $page.params.id;
		if (!id) return;
		savingEdit = true;
		try {
			const patched = applyDraft(editSession);
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
		canEdit={!!session}
		onSave={onSaveEdit}
		onCancel={cancelEdit}
		onEdit={startEdit}
		onDelete={onDeleteSession}
		onToBuilder={onToBuilder}
	/>
{/snippet}

<svelte:head>
	<title
		>{session ? session.planName : translate(lang, 'workouts.historyDetail')} · Repdraft</title
	>
</svelte:head>

{#if loading}
	<PageSkeleton variant="history" rows={4} />
{:else if missing || !session}
	<EmptyState
		title={translate(lang, 'live.noPlan')}
		description={translate(lang, 'workouts.emptyDesc')}
		actionHref={WORKOUTS_HISTORY_HREF}
		actionLabel={translate(lang, 'nav.workouts')}
	/>
{:else}
	<section class="content-page content-page--narrow soft-enter history-detail">
		<div class="lg:hidden">
			<ScreenHeader
				title={session.planName}
				backHref={WORKOUTS_HISTORY_HREF}
				actions={historyDetailActions}
			/>
		</div>
		<div class="subroute-desktop-head hidden md:block">
			<SubrouteBack href={WORKOUTS_HISTORY_HREF} label={translate(lang, 'builder.backWorkouts')} />
			<div class="history-detail__title-row">
				<h1 class="page-title">{session.planName}</h1>
				<div class="history-detail__actions">
					{@render historyDetailActions()}
				</div>
			</div>
		</div>
		<p class="page-lead mt-1 lg:mt-0">
			{formatLongDate(session.finishedAt ?? session.startedAt, lang)} · {formatDurationMs(
				sessionDurationMs(session)
			)} · {translate(lang, 'workouts.historySets', {
				n: completedSetCount(viewSession ?? session)
			})}{#if historyVolumeKg > 0}
				{' '}· {Math.round(historyVolumeKg)} kg{/if}
		</p>

		<ul class="history-exercise-list">
			{#each (viewSession ?? session).exercises as ex, exIndex (ex.exerciseId)}
				{@const meta = indexById.get(ex.exerciseId) ?? null}
				{@const label = exerciseLabel(ex, meta)}
				{@const rows = editing
					? ex.sets.map((set, setIndex) => ({ set, setIndex }))
					: ex.sets.map((set, setIndex) => ({ set, setIndex })).filter(({ set }) => set.completed)}
				<li class="history-exercise">
					{#if editing}
						<div class="history-exercise__head is-static is-editing">
							<span
								class="media-well history-exercise__thumb"
								class:is-placeholder={!meta}
								aria-hidden="true"
							>
								{#if meta}
									<img
										src={`/${meta.image}`}
										alt=""
										width="180"
										height="180"
										loading="lazy"
										decoding="async"
									/>
								{/if}
							</span>
							<div class="workout-preview-row-body">
								<p class="workout-preview-row-title">{label}</p>
								{#if meta}
									<p class="workout-preview-row-sub">
										{labelTarget(meta.target, lang)} · {labelEquipment(meta.equipment, lang)}
									</p>
								{/if}
							</div>
							<button
								type="button"
								class="btn-ghost live-set-remove-btn history-exercise__remove"
								disabled={savingEdit || (editSession?.exercises.length ?? 0) <= 1}
								aria-label={translate(lang, 'workouts.removeExercise')}
								title={translate(lang, 'workouts.removeExercise')}
								onclick={() => removeHistoryExercise(exIndex, label)}
							>
								<LucideIcon icon={Trash2} size={ICON_SMALL} />
							</button>
						</div>
					{:else if meta}
						<a
							class="history-exercise__head"
							href={`/exercise/${meta.id}?from=${encodeURIComponent(fromPath)}`}
						>
							<span class="media-well history-exercise__thumb">
								<img
									src={`/${meta.image}`}
									alt=""
									width="180"
									height="180"
									loading="lazy"
									decoding="async"
								/>
							</span>
							<div class="workout-preview-row-body">
								<p class="workout-preview-row-title">{label}</p>
								<p class="workout-preview-row-sub">
									{labelTarget(meta.target, lang)} · {labelEquipment(meta.equipment, lang)}
								</p>
							</div>
							<span class="workout-preview-chevron" aria-hidden="true">
								<LucideIcon icon={ChevronRight} size={ICON_BUTTON} />
							</span>
						</a>
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
					{/if}

					{#if rows.length > 0}
						<ul
							class="history-exercise__sets"
							class:history-exercise__sets--grid={rows.length >= 4 && !editing}
							class:history-exercise__sets--editing={editing}
						>
							{#each rows as item, i (item.setIndex)}
								<li class="history-exercise__set tabular-nums">
									<span class="history-exercise__set-i">{i + 1}</span>
									{#if editing}
										{@const key = setKey(exIndex, item.setIndex)}
										<input
											class="field history-set-field history-set-weight tabular-nums"
											type="text"
											inputmode="decimal"
											autocomplete="off"
											value={editDraft[key]?.w ?? ''}
											aria-label={translate(lang, 'live.weight')}
											oninput={(e) => {
												const nextRaw = (e.currentTarget as HTMLInputElement).value;
												const prev = editDraft[key]?.w ?? '';
												const next = filterWeightInput(nextRaw, prev);
												editDraft[key] = { ...(editDraft[key] ?? { w: '', r: '' }), w: next };
											}}
										/>
										<span class="history-exercise__set-unit">kg</span>
										<input
											class="field history-set-field history-set-reps tabular-nums"
											type="text"
											inputmode="numeric"
											autocomplete="off"
											value={editDraft[key]?.r ?? ''}
											aria-label={translate(lang, 'live.reps')}
											oninput={(e) => {
												const nextRaw = (e.currentTarget as HTMLInputElement).value;
												const prev = editDraft[key]?.r ?? '';
												const next = filterRepsInput(nextRaw, LIVE_REPS, prev);
												editDraft[key] = { ...(editDraft[key] ?? { w: '', r: '' }), r: next };
											}}
										/>
										<button
											type="button"
											class="btn-ghost live-set-remove-btn"
											aria-label={translate(lang, 'live.removeSet')}
											title={translate(lang, 'live.removeSet')}
											onclick={() => removeHistorySet(exIndex, item.setIndex)}
										>
											<LucideIcon icon={Trash2} size={ICON_SMALL} />
										</button>
									{:else}
										<span class="history-exercise__set-weight">{item.set.weightKg ?? '—'} kg</span>
										<span class="history-exercise__set-reps">× {item.set.reps ?? '—'}</span>
									{/if}
								</li>
							{/each}
						</ul>
					{:else}
						<p class="history-exercise__empty">{translate(lang, 'workouts.noLoggedSets')}</p>
					{/if}
					{#if editing}
						<button
							type="button"
							class="btn-ghost history-exercise__add-set"
							disabled={savingEdit || ex.sets.length >= SETS.max}
							onclick={() => addHistorySet(exIndex)}
						>
							<LucideIcon icon={Plus} size={ICON_SMALL} />
							{translate(lang, 'live.addSet')}
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
