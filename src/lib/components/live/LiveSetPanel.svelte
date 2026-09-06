<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { cn } from '$lib/utils.js';
	import ExerciseTechniqueSheet from '$lib/components/ExerciseTechniqueSheet.svelte';
	import LiveExerciseHistorySheet from '$lib/components/live/LiveExerciseHistorySheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import SwipeToDelete from '$lib/components/SwipeToDelete.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { blurActiveElement } from '$lib/dom/blurActiveElement';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import type { ExerciseIndexItem, SessionExercise, SetKind, WorkoutSession } from '$lib/domain/types';
	import { NOTE_MAX, REPS_INPUT_MAX_LEN, WEIGHT_INPUT_MAX_LEN, clampNote } from '$lib/domain/inputLimits';
	import { isBodyweightEquipment, isCardioBodyPart } from '$lib/domain/workout';
	import { loggedSetKind, setKindMessageKey } from '$lib/domain/session';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import {
		Check,
		ClipboardPaste,
		EllipsisVertical,
		History,
		Plus,
		RefreshCw,
		SkipForward,
		StickyNote,
		Trash2,
		X
	} from '@lucide/svelte';

	type LiveOverlay =
		| { kind: 'none' }
		| { kind: 'technique' }
		| { kind: 'history' }
		| { kind: 'actions' }
		| { kind: 'note' }
		| { kind: 'setMenu'; index: number };

	const SET_KINDS: SetKind[] = ['work', 'warmup', 'drop', 'failure'];

	let {
		session,
		exerciseIndex,
		exercise,
		names,
		lang,
		selectedInGroup,
		selectedGroupPos,
		nextInSupersetName,
		activeSetProgress,
		canSwapAlternative = false,
		onSwapAlternative = undefined,
		onSkip = undefined,
		onWeight,
		onReps,
		onComplete,
		onUncomplete,
		onToggleAllComplete,
		onRemove,
		invalidSetIndex = null as number | null,
		invalidKind = null as 'weight' | 'reps' | null,
		justDoneSetIndex = null as number | null
	}: {
		session: WorkoutSession;
		exerciseIndex: number;
		exercise: SessionExercise;
		names: Map<string, ExerciseIndexItem>;
		lang: AppLocale;
		selectedInGroup: boolean;
		selectedGroupPos: { current: number; total: number } | null;
		nextInSupersetName: string | null;
		activeSetProgress: { current: number; total: number; allDone: boolean } | null;
		canSwapAlternative?: boolean;
		onSwapAlternative?: () => void;
		onSkip?: () => void;
		onWeight: (setIndex: number, value: string) => string;
		onReps: (setIndex: number, value: string) => string;
		onComplete: (setIndex: number) => void;
		onUncomplete: (setIndex: number) => void;
		onToggleAllComplete: () => void;
		onRemove: (setIndex: number) => void;
		invalidSetIndex?: number | null;
		invalidKind?: 'weight' | 'reps' | null;
		justDoneSetIndex?: number | null;
	} = $props();

	let overlay = $state<LiveOverlay>({ kind: 'none' });
	let noteFocused = $state(false);
	/** Local note while focused — commit via live.patchExerciseNote. */
	let noteDraft = $state<string | null>(null);

	$effect(() => {
		exercise.exerciseId;
		exerciseIndex;
		noteDraft = null;
	});

	let noteText = $derived(noteDraft ?? exercise.note ?? '');
	let hasNote = $derived(noteText.trim().length > 0);
	let techniqueOpen = $derived(overlay.kind === 'technique');
	let historyOpen = $derived(overlay.kind === 'history');
	let actionsOpen = $derived(overlay.kind === 'actions');
	let noteOpen = $derived(overlay.kind === 'note');
	let setMenuIndex = $derived(overlay.kind === 'setMenu' ? overlay.index : null);

	function onNoteInput(event: Event) {
		const el = event.currentTarget as HTMLInputElement;
		const next = clampNote(el.value);
		noteDraft = next;
		if (el.value !== next) el.value = next;
		live.patchExerciseNote(exerciseIndex, next);
	}

	function clearNote() {
		noteDraft = '';
		live.patchExerciseNote(exerciseIndex, '');
	}

	function titleFor(id: string): string {
		const item = names.get(id);
		return item ? exerciseName(item, lang) : translate(lang, 'records.fallback', { id });
	}

	function metaFor(id: string): string | null {
		const item = names.get(id);
		if (!item) return null;
		return `${labelTarget(item.target, lang)} · ${labelEquipment(item.equipment, lang)}`;
	}

	function formatLast(exerciseId: string): string | null {
		const last = live.lastFor(exerciseId);
		return formatPerformanceHint(last?.weightKg ?? null, last?.reps ?? null);
	}

	function formatPerformanceHint(weightKg: number | null, reps: number | null): string | null {
		const r = reps != null ? `${reps}` : null;
		if (weightKg != null && r != null) return `${weightKg} × ${r}`;
		if (r != null) return translate(lang, 'live.lastReps', { n: r });
		if (weightKg != null) return `${weightKg}`;
		return null;
	}

	function lastVars(exerciseId: string): { w: string; r: string } | null {
		const last = live.lastFor(exerciseId);
		if (!last || (last.weightKg == null && last.reps == null)) return null;
		return {
			w: last.weightKg != null ? `${last.weightKg}` : '',
			r: last.reps != null ? `${last.reps}` : ''
		};
	}

	function applyLastPerformance() {
		const last = live.lastFor(exercise.exerciseId);
		if (!last) return;
		const openIdx = exercise.sets.findIndex((s) => !s.completed);
		if (openIdx < 0) return;
		live.patchSet(exerciseIndex, openIdx, {
			weightKg: last.weightKg,
			reps: last.reps
		});
	}

	function openOverlay(next: Exclude<LiveOverlay, { kind: 'none' }>) {
		if (next.kind === 'technique' && !names.get(exercise.exerciseId)) return;
		if (next.kind !== 'technique') blurActiveElement();
		overlay = next;
	}

	function closeOverlay() {
		overlay = { kind: 'none' };
		noteFocused = false;
		blurActiveElement();
	}

	function confirmRemoveSet() {
		const si = overlay.kind === 'setMenu' ? overlay.index : null;
		closeOverlay();
		if (si == null) return;
		onRemove(si);
	}

	function setMenuKind(kind: SetKind) {
		const si = overlay.kind === 'setMenu' ? overlay.index : null;
		if (si == null) return;
		live.patchSet(exerciseIndex, si, { kind });
		closeOverlay();
	}

	function runActionsItem(action: () => void) {
		closeOverlay();
		queueMicrotask(action);
	}

	let showNoteCount = $derived(noteFocused || noteText.length > 0);

	let canRemoveSet = $derived(exercise.sets.length > 1);
	let allSetsDone = $derived(
		exercise.sets.length > 0 && exercise.sets.every((s) => s.completed)
	);
	let currentSetIndex = $derived(exercise.sets.findIndex((s) => !s.completed));
	let lastCopy = $derived(lastVars(exercise.exerciseId));
	let canApplyLast = $derived.by(() => {
		const last = live.lastFor(exercise.exerciseId);
		if (!lastCopy || !last) return false;
		return exercise.sets.some(
			(s) =>
				!s.completed &&
				(s.weightKg !== last.weightKg || s.reps !== last.reps)
		);
	});
	let bodyweight = $derived(
		isBodyweightEquipment(names.get(exercise.exerciseId)?.equipment)
	);
	let cardio = $derived(isCardioBodyPart(names.get(exercise.exerciseId)?.body_part));
	let notePh = $derived(translate(lang, cardio ? 'live.notePhCardio' : 'live.notePh'));
	let weightLabel = $derived(
		translate(lang, bodyweight ? 'live.weightBw' : 'live.weight')
	);
	let weightPlaceholder = $derived(bodyweight ? translate(lang, 'live.weightBwPh') : '');
	let toggleAllLabel = $derived(
		translate(lang, allSetsDone ? 'live.undoDoneAll' : 'live.doneAll')
	);
	let fillWeightKg = $derived.by(() => {
		if (currentSetIndex >= 0) {
			const w = exercise.sets[currentSetIndex]?.weightKg;
			if (w != null) return w;
		}
		for (const s of exercise.sets) {
			if (!s.completed && s.weightKg != null) return s.weightKg;
		}
		return null;
	});
	let canFillWeightAll = $derived(
		fillWeightKg != null &&
			exercise.sets.length > 1 &&
			exercise.sets.some((s) => !s.completed && s.weightKg !== fillWeightKg)
	);
	let fillReps = $derived.by(() => {
		if (currentSetIndex >= 0) {
			const r = exercise.sets[currentSetIndex]?.reps;
			if (r != null) return r;
		}
		for (const s of exercise.sets) {
			if (!s.completed && s.reps != null) return s.reps;
		}
		return null;
	});
	let canFillRepsAll = $derived(
		fillReps != null &&
			exercise.sets.length > 1 &&
			exercise.sets.some((s) => !s.completed && s.reps !== fillReps)
	);
	let fillWeightAllLabel = $derived(
		fillWeightKg != null
			? translate(lang, 'live.weightFillAria', { weight: fillWeightKg })
			: translate(lang, 'live.weightFillAll')
	);
	let fillRepsAllLabel = $derived(
		fillReps != null
			? translate(lang, 'live.repsFillAria', { reps: fillReps })
			: translate(lang, 'live.reps')
	);
	let exerciseMeta = $derived(names.get(exercise.exerciseId) ?? null);
	let title = $derived(titleFor(exercise.exerciseId));
	let lastFormatted = $derived(formatLast(exercise.exerciseId));
	let showLastChip = $derived(
		!cardio && lastCopy != null && lastFormatted != null && canApplyLast
	);

	function scrollCurrentSetIntoView(node: HTMLElement) {
		queueMicrotask(() => {
			node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
		});
	}

	function applyWeightToAllSets() {
		if (fillWeightKg == null) return;
		live.applyWeightToOpenSets(exerciseIndex, fillWeightKg);
	}

	function applyRepsToAllSets() {
		if (fillReps == null) return;
		live.applyRepsToOpenSets(exerciseIndex, fillReps);
	}

	function onWeightKeydown(e: KeyboardEvent, si: number) {
		if (e.key !== 'Enter') return;
		if (exercise.sets[si]?.completed) return;
		e.preventDefault();
		const row = (e.currentTarget as HTMLElement).closest('.live-set-row');
		const reps = row?.querySelector<HTMLInputElement>('.live-set-reps');
		reps?.focus();
	}

	function onRepsKeydown(e: KeyboardEvent, si: number) {
		if (e.key !== 'Enter') return;
		if (exercise.sets[si]?.completed) return;
		e.preventDefault();
		onComplete(si);
	}
</script>

<div class="live-panel" class:live-panel--superset={selectedInGroup}>
	<header class="live-panel__hero">
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

		<!-- Hybrid Live: technique hero first, then set status (table stays below). -->
		<div class="live-panel-head">
			{#if exerciseMeta}
				<AppButton
					variant="ghost"
					class="live-panel-thumb media-well !min-w-0 w-auto !p-0"
					aria-label={translate(lang, 'exercise.openTechnique', { name: title })}
					onclick={() => openOverlay({ kind: 'technique' })}
				>
					<img src={`/${exerciseMeta.image}`} alt="" width="96" height="96" decoding="async" />
				</AppButton>
			{:else}
				<div class="live-panel-thumb live-panel-thumb--placeholder media-well" aria-hidden="true"></div>
			{/if}
			<div class="live-panel-head__copy">
				{#if exerciseMeta}
					<button
						type="button"
						class="live-panel-title live-panel-title--tap"
						aria-label={translate(lang, 'exercise.openTechnique', { name: title })}
						onclick={() => openOverlay({ kind: 'technique' })}
					>
						{title}
					</button>
				{:else}
					<h2 class="live-panel-title">{title}</h2>
				{/if}
				{#if metaFor(exercise.exerciseId)}
					<p class="live-panel-meta">{metaFor(exercise.exerciseId)}</p>
				{/if}
				{#if activeSetProgress || hasNote}
					<div class="live-panel-status">
						{#if activeSetProgress}
							<p class="live-set-badge">
								{translate(lang, 'live.setProgress', {
									current: activeSetProgress.current,
									total: activeSetProgress.total
								})}
							</p>
						{/if}
						{#if hasNote}
							<button
								type="button"
								class="live-panel-note-preview"
								aria-label={translate(lang, 'live.noteOpenAria')}
								title={noteText.trim()}
								aria-haspopup="dialog"
								aria-expanded={noteOpen}
								onclick={() => openOverlay({ kind: 'note' })}
							>
								<span class="live-panel-note-preview__text">{noteText.trim()}</span>
								<LucideIcon icon={StickyNote} size={12} />
							</button>
						{/if}
					</div>
				{/if}
			</div>
			<div class="live-panel-head__actions">
				<AppButton
					variant="ghost"
					class="live-panel-head-btn"
					aria-label={translate(lang, 'live.actionsMenuAria')}
					title={translate(lang, 'live.actionsMenuTitle')}
					aria-haspopup="dialog"
					aria-expanded={actionsOpen}
					onclick={() => openOverlay({ kind: 'actions' })}
				>
					<LucideIcon icon={EllipsisVertical} size={ICON_SMALL} />
				</AppButton>
			</div>
		</div>
	</header>

	<section class="live-panel__log" aria-label={translate(lang, 'live.setLogAria')}>
		{#if showLastChip && lastFormatted}
			<div class="live-quick-actions">
				<AppButton
					variant="ghost"
					class="live-last-chip live-last-chip--tap"
					aria-label={translate(lang, 'live.lastApplyAria', { value: lastFormatted })}
					onclick={applyLastPerformance}
				>
					<span class="live-last-chip__main">
						<span class="live-last-chip__label">{translate(lang, 'live.last')}</span>
						<span class="live-last-chip__value tabular-nums">{lastFormatted}</span>
					</span>
					<span class="live-last-chip__action">
						{translate(lang, 'live.applyLast')}
						<LucideIcon icon={ClipboardPaste} size={ICON_SMALL} />
					</span>
				</AppButton>
			</div>
		{/if}

		<div class="live-set-head" class:live-set-head--cardio={cardio}>
			<span class="live-set-head__idx">#</span>
			{#if !cardio}
				{#if canFillWeightAll && fillWeightKg != null}
					<button
						type="button"
						class="live-set-head__fill live-set-head__weight"
						aria-label={fillWeightAllLabel}
						title={bodyweight
							? `${fillWeightAllLabel}. ${translate(lang, 'live.weightBwHintShort')}`
							: fillWeightAllLabel}
						onclick={applyWeightToAllSets}
					>
						<span class="live-set-head__fill-main">{weightLabel}</span>
						<span class="live-set-head__fill-hint" aria-hidden="true">
							{translate(lang, 'live.fillColumnHint')}
						</span>
					</button>
				{:else}
					<span
						class="live-set-head__weight"
						title={bodyweight ? translate(lang, 'live.weightBwHintShort') : undefined}
					>
						{weightLabel}
					</span>
				{/if}
				{#if canFillRepsAll && fillReps != null}
					<button
						type="button"
						class="live-set-head__fill live-set-head__reps"
						aria-label={fillRepsAllLabel}
						title={fillRepsAllLabel}
						onclick={applyRepsToAllSets}
					>
						<span class="live-set-head__fill-main">{translate(lang, 'live.reps')}</span>
						<span class="live-set-head__fill-hint" aria-hidden="true">
							{translate(lang, 'live.fillColumnHint')}
						</span>
					</button>
				{:else}
					<span class="live-set-head__reps">{translate(lang, 'live.reps')}</span>
				{/if}
			{:else}
				<span class="live-set-head__mark">{translate(lang, 'live.cardioCol')}</span>
			{/if}
			<AppButton
				variant="ghost"
				class={cn('live-set-head-done', allSetsDone && 'live-set-head-done--all')}
				aria-label={toggleAllLabel}
				title={toggleAllLabel}
				onclick={onToggleAllComplete}
			>
				<LucideIcon icon={Check} size={ICON_BUTTON} />
			</AppButton>
		</div>

		<ul class="live-set-list">
					{#each exercise.sets as set, si (si)}
				<li class="live-set-li">
					<SwipeToDelete
						disabled={!canRemoveSet}
						label={translate(lang, 'live.removeSet')}
						onDelete={() => onRemove(si)}
					>
						<div
							class="live-set-row"
							class:live-set-row--cardio={cardio}
							class:is-done={set.completed}
							class:is-current={currentSetIndex === si}
							class:is-just-done={justDoneSetIndex === si}
						>
						<div class="live-set-index-wrap">
							<button
								type="button"
								class="live-set-index live-set-index--action"
								aria-label={translate(lang, 'live.setActionsAria', { n: si + 1 })}
								title={translate(lang, 'live.setActionsTitle', { n: si + 1 })}
								aria-haspopup="dialog"
								aria-expanded={setMenuIndex === si}
								data-swipe-pass=""
								onclick={() => openOverlay({ kind: 'setMenu', index: si })}
							>
								{si + 1}
							</button>
							{#if loggedSetKind(set) !== 'work'}
								<span class="live-set-kind-badge">
									{translate(lang, setKindMessageKey(loggedSetKind(set)))}
								</span>
							{/if}
						</div>
					{#if !cardio}
						<AppInput
							class={`live-set-weight tabular-nums${invalidSetIndex === si && invalidKind === 'weight' ? ' is-invalid' : ''}`}
							aria-invalid={invalidSetIndex === si && invalidKind === 'weight'}
							type="text"
							inputmode="decimal"
							autocomplete="off"
							maxlength={WEIGHT_INPUT_MAX_LEN}
							enterkeyhint="next"
							placeholder={weightPlaceholder}
							aria-label={`${weightLabel} ${si + 1}`}
							value={set.weightKg ?? ''}
							readonly={set.completed}
							tabindex={set.completed ? -1 : undefined}
							data-swipe-pass=""
							onfocus={(e) => {
								if (set.completed) {
									e.currentTarget.blur();
									return;
								}
								scrollCurrentSetIntoView(e.currentTarget);
							}}
							oninput={(e) => {
								if (set.completed) return;
								const el = e.currentTarget;
								const next = onWeight(si, el.value);
								if (el.value !== next) el.value = next;
							}}
							onkeydown={(e) => onWeightKeydown(e, si)}
						/>
						<AppInput
							class={`live-set-reps tabular-nums${invalidSetIndex === si && invalidKind === 'reps' ? ' is-invalid' : ''}`}
							aria-invalid={invalidSetIndex === si && invalidKind === 'reps'}
							type="text"
							inputmode="numeric"
							autocomplete="off"
							maxlength={REPS_INPUT_MAX_LEN}
							enterkeyhint="done"
							aria-label={`${translate(lang, 'live.reps')} ${si + 1}`}
							value={set.reps ?? ''}
							readonly={set.completed}
							tabindex={set.completed ? -1 : undefined}
							data-swipe-pass=""
							onfocus={(e) => {
								if (set.completed) {
									e.currentTarget.blur();
									return;
								}
								scrollCurrentSetIntoView(e.currentTarget);
							}}
							oninput={(e) => {
								if (set.completed) return;
								const el = e.currentTarget;
								const next = onReps(si, el.value);
								if (el.value !== next) el.value = next;
							}}
							onkeydown={(e) => onRepsKeydown(e, si)}
						/>
					{:else}
						<span class="live-set-cardio-mark" data-swipe-pass="">
							{set.completed
								? translate(lang, 'live.setMarked')
								: translate(lang, 'live.cardioMarkIdle')}
						</span>
					{/if}
					{#if set.completed}
						<AppButton
							variant="ghost"
							class="live-set-done-btn live-set-done-btn--done"
							aria-label={translate(lang, 'live.undoDone')}
							title={translate(lang, 'live.undoDone')}
							onclick={() => onUncomplete(si)}
						>
							<LucideIcon icon={Check} size={ICON_BUTTON} />
							<span class="sr-only">{translate(lang, 'live.undoDone')}</span>
						</AppButton>
					{:else}
						<AppButton
							variant={currentSetIndex === si ? 'primary' : 'ghost'}
							class={cn(
								'live-set-done-btn',
								currentSetIndex !== si && 'live-set-done-btn--idle'
							)}
							aria-label={translate(lang, 'live.done')}
							title={translate(lang, 'live.done')}
							onclick={() => onComplete(si)}
						>
							<LucideIcon icon={Check} size={ICON_BUTTON} />
							<span class="sr-only">{translate(lang, 'live.done')}</span>
						</AppButton>
					{/if}
						</div>
					</SwipeToDelete>
				</li>
			{/each}
		</ul>

		<div class="live-panel__tools">
			<button
				type="button"
				class="live-panel-add-set"
				onclick={() => live.addSet(exerciseIndex)}
			>
				<LucideIcon icon={Plus} size={ICON_SMALL} />
				{translate(lang, 'live.addSet')}
			</button>
		</div>
	</section>
</div>

{#if techniqueOpen && exerciseMeta}
	<ExerciseTechniqueSheet
		open={techniqueOpen}
		titleId={`live-technique-${exercise.exerciseId}`}
		{title}
		hint={labelTarget(exerciseMeta.target, lang)}
		imagePath={exerciseMeta.image}
		onDismiss={closeOverlay}
	/>
{/if}

{#if actionsOpen}
	<BottomSheet
		open={actionsOpen}
		raised
		titleId={`live-actions-${exercise.exerciseId}`}
		onDismiss={closeOverlay}
	>
		<p id={`live-actions-${exercise.exerciseId}`} class="bottom-sheet__title live-actions-sheet__heading">
			{translate(lang, 'live.actionsMenuTitle')}
		</p>
		<div
			class="live-actions-sheet live-actions-sheet--icons"
			class:live-actions-sheet--icons-4={Boolean(canSwapAlternative && onSwapAlternative && onSkip)}
			role="group"
			aria-labelledby={`live-actions-${exercise.exerciseId}`}
		>
			<button
				type="button"
				class="live-actions-tile"
				onclick={() => runActionsItem(() => openOverlay({ kind: 'history' }))}
			>
				<span class="live-actions-tile__well" aria-hidden="true">
					<LucideIcon icon={History} size={ICON_BUTTON} />
				</span>
				<span class="live-actions-tile__label">{translate(lang, 'live.historyTitle')}</span>
			</button>
			<button
				type="button"
				class="live-actions-tile"
				onclick={() => runActionsItem(() => openOverlay({ kind: 'note' }))}
			>
				<span class="live-actions-tile__well" aria-hidden="true">
					<LucideIcon icon={StickyNote} size={ICON_BUTTON} />
				</span>
				<span class="live-actions-tile__label">{translate(lang, 'live.note')}</span>
			</button>
			{#if canSwapAlternative && onSwapAlternative}
				<button
					type="button"
					class="live-actions-tile"
					onclick={() => {
						const swap = onSwapAlternative;
						if (swap) runActionsItem(swap);
					}}
				>
					<span class="live-actions-tile__well" aria-hidden="true">
						<LucideIcon icon={RefreshCw} size={ICON_BUTTON} />
					</span>
					<span class="live-actions-tile__label"
						>{translate(lang, 'live.swapAlternativeShort')}</span
					>
				</button>
			{/if}
			{#if onSkip}
				<button
					type="button"
					class="live-actions-tile"
					onclick={() => {
						const skip = onSkip;
						if (skip) runActionsItem(skip);
					}}
				>
					<span class="live-actions-tile__well" aria-hidden="true">
						<LucideIcon icon={SkipForward} size={ICON_BUTTON} />
					</span>
					<span class="live-actions-tile__label">{translate(lang, 'live.skipExerciseShort')}</span>
				</button>
			{/if}
		</div>
	</BottomSheet>
{/if}

{#if setMenuIndex != null}
	{@const menuSet = exercise.sets[setMenuIndex]}
	{@const menuKind = menuSet ? loggedSetKind(menuSet) : 'work'}
	<BottomSheet
		open={true}
		raised
		titleId={`live-set-actions-${exercise.exerciseId}-${setMenuIndex}`}
		onDismiss={closeOverlay}
	>
		<p
			id={`live-set-actions-${exercise.exerciseId}-${setMenuIndex}`}
			class="bottom-sheet__title"
		>
			{translate(lang, 'live.setActionsTitle', { n: setMenuIndex + 1 })}
		</p>
		<div
			class="live-actions-sheet"
			role="group"
			aria-labelledby={`live-set-actions-${exercise.exerciseId}-${setMenuIndex}`}
		>
			<p class="live-actions-sheet__label">{translate(lang, 'live.setKindLabel')}</p>
			{#each SET_KINDS as kind (kind)}
				<AppButton
					variant={menuKind === kind ? 'primary' : 'secondary'}
					class="live-actions-sheet__item"
					aria-pressed={menuKind === kind}
					onclick={() => setMenuKind(kind)}
				>
					{translate(lang, setKindMessageKey(kind))}
				</AppButton>
			{/each}
			{#if canRemoveSet}
				<AppButton
					variant="secondary"
					class="live-actions-sheet__item live-actions-sheet__item--danger"
					onclick={confirmRemoveSet}
				>
					{translate(lang, 'live.removeSet')}
					<LucideIcon icon={Trash2} size={ICON_SMALL} />
				</AppButton>
			{/if}
		</div>
	</BottomSheet>
{/if}

{#if noteOpen}
	<BottomSheet
		open={noteOpen}
		raised
		titleId={`live-note-${exercise.exerciseId}`}
		onDismiss={closeOverlay}
	>
		<p id={`live-note-${exercise.exerciseId}`} class="bottom-sheet__title">
			{translate(lang, 'live.note')}
		</p>
		<p class="bottom-sheet__hint">{translate(lang, 'live.noteSavedHint')}</p>
		<label class="live-ex-note live-ex-note--sheet">
			<span class="sr-only">{translate(lang, 'live.note')}</span>
			<span class="live-ex-note__shell field-shell">
				<AppInput
					type="text"
					class={cn('live-ex-note__field', noteText.length > 0 && 'live-ex-note__field--has-clear')}
					maxlength={NOTE_MAX}
					placeholder={notePh}
					aria-label={translate(lang, 'live.note')}
					aria-describedby={showNoteCount ? `live-note-count-${exercise.exerciseId}` : undefined}
					value={noteText}
					autocomplete="off"
					enterkeyhint="done"
					onfocus={() => {
						noteFocused = true;
					}}
					onblur={() => {
						noteFocused = false;
					}}
					oninput={onNoteInput}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							closeOverlay();
						}
					}}
				/>
				{#if noteText.length > 0}
					<button
						type="button"
						class="live-ex-note__clear"
						aria-label={translate(lang, 'a11y.clearField')}
						title={translate(lang, 'a11y.clearField')}
						onclick={clearNote}
					>
						<LucideIcon icon={X} size={ICON_SMALL} />
					</button>
				{/if}
			</span>
			{#if showNoteCount}
				<span
					id={`live-note-count-${exercise.exerciseId}`}
					class="live-ex-note__count"
					class:live-ex-note__count--limit={noteText.length >= NOTE_MAX}
					aria-live="polite"
				>
					{noteText.length}/{NOTE_MAX}
				</span>
			{/if}
		</label>
		{#snippet actions()}
			<AppButton variant="primary" onclick={closeOverlay}>
				{translate(lang, 'live.noteDone')}
			</AppButton>
		{/snippet}
	</BottomSheet>
{/if}

<LiveExerciseHistorySheet
	open={historyOpen}
	exerciseId={exercise.exerciseId}
	onDismiss={closeOverlay}
/>
