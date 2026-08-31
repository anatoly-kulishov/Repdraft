<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import { cn } from '$lib/utils.js';
	import ExerciseTechniqueSheet from '$lib/components/ExerciseTechniqueSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import type { ExerciseIndexItem, SessionExercise, WorkoutSession } from '$lib/domain/types';
	import { REPS_INPUT_MAX_LEN, WEIGHT_INPUT_MAX_LEN } from '$lib/domain/inputLimits';
	import { isBodyweightEquipment } from '$lib/domain/workout';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { Check, Plus, RefreshCw, SkipForward, Trash2 } from '@lucide/svelte';

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

	let techniqueOpen = $state(false);

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

	function previousForSet(setIndex: number) {
		return live.previousSetFor(exercise.exerciseId, setIndex);
	}

	function previousLabel(setIndex: number): string {
		const prev = previousForSet(setIndex);
		if (!prev) return translate(lang, 'live.noPrevious');
		return formatPerformanceHint(prev.weightKg, prev.reps) ?? translate(lang, 'live.noPrevious');
	}

	function canApplyPrevious(setIndex: number): boolean {
		if (exercise.sets[setIndex]?.completed) return false;
		const prev = previousForSet(setIndex);
		if (!prev) return false;
		const set = exercise.sets[setIndex];
		return set.weightKg !== prev.weightKg || set.reps !== prev.reps;
	}

	function applyPreviousSet(setIndex: number) {
		const prev = previousForSet(setIndex);
		if (!prev || exercise.sets[setIndex]?.completed) return;
		live.patchSet(exerciseIndex, setIndex, {
			weightKg: prev.weightKg,
			reps: prev.reps
		});
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

	function openTechnique() {
		if (!names.get(exercise.exerciseId)) return;
		techniqueOpen = true;
	}

	function dismissTechnique() {
		techniqueOpen = false;
	}

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
	let fillWeightAllLabel = $derived(
		fillWeightKg != null
			? translate(lang, 'live.weightFillAria', { weight: fillWeightKg })
			: translate(lang, 'live.weightFillAll')
	);
	let exerciseMeta = $derived(names.get(exercise.exerciseId) ?? null);
	let title = $derived(titleFor(exercise.exerciseId));
	let lastFormatted = $derived(formatLast(exercise.exerciseId));
	let hasPreviousColumn = $derived.by(() => {
		if (!exercise.sets.some((_, si) => previousForSet(si) != null)) return false;
		const noPrev = translate(lang, 'live.noPrevious');
		const labels = exercise.sets
			.map((_, si) => previousLabel(si))
			.filter((label) => label !== noPrev);
		if (labels.length === 0) return false;
		return new Set(labels).size > 1;
	});
	let showQuickActions = $derived(
		(lastCopy != null && lastFormatted != null && canApplyLast) ||
			(canFillWeightAll && fillWeightKg != null)
	);

	function showRemove(setIndex: number): boolean {
		return canRemoveSet && setIndex === exercise.sets.length - 1;
	}

	function scrollCurrentSetIntoView(node: HTMLElement) {
		queueMicrotask(() => {
			node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
		});
	}

	function applyWeightToAllSets() {
		if (fillWeightKg == null) return;
		live.applyWeightToOpenSets(exerciseIndex, fillWeightKg);
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
					onclick={openTechnique}
				>
					<img src={`/${exerciseMeta.image}`} alt="" width="96" height="96" decoding="async" />
				</AppButton>
			{/if}
			<div class="live-panel-head__copy">
				{#if exerciseMeta}
					<button
						type="button"
						class="live-panel-title live-panel-title--tap"
						aria-label={translate(lang, 'exercise.openTechnique', { name: title })}
						onclick={openTechnique}
					>
						{title}
					</button>
				{:else}
					<h2 class="live-panel-title">{title}</h2>
				{/if}
				{#if metaFor(exercise.exerciseId)}
					<p class="live-panel-meta">{metaFor(exercise.exerciseId)}</p>
				{/if}
				{#if activeSetProgress}
					<p class="live-set-badge">
						{translate(lang, 'live.setProgress', {
							current: activeSetProgress.current,
							total: activeSetProgress.total
						})}
					</p>
				{/if}
			</div>
			<div class="live-panel-head__actions">
				{#if canSwapAlternative && onSwapAlternative}
					<AppButton
						variant="ghost"
						class="live-panel-head-btn"
						aria-label={translate(lang, 'live.swapAlternative')}
						title={translate(lang, 'live.swapAlternative')}
						onclick={onSwapAlternative}
					>
						<LucideIcon icon={RefreshCw} size={ICON_SMALL} />
					</AppButton>
				{/if}
				{#if onSkip}
					<AppButton
						variant="ghost"
						class="live-panel-head-btn live-panel-head-btn--skip"
						aria-label={translate(lang, 'live.skipExercise')}
						title={translate(lang, 'live.skipExercise')}
						onclick={onSkip}
					>
						<LucideIcon icon={SkipForward} size={ICON_SMALL} />
					</AppButton>
				{/if}
			</div>
		</div>
	</header>

	<section class="live-panel__log" aria-label={translate(lang, 'live.setLogAria')}>
		{#if showQuickActions}
			<div class="live-quick-actions">
				{#if lastCopy && lastFormatted && canApplyLast}
					<AppButton
						variant="ghost"
						class="live-last-chip live-last-chip--tap"
						aria-label={translate(lang, 'live.lastApplyAria', { value: lastFormatted })}
						onclick={applyLastPerformance}
					>
						<span class="live-last-chip__label">{translate(lang, 'live.last')}</span>
						<span class="live-last-chip__value tabular-nums">{lastFormatted}</span>
						<span class="live-last-chip__action">{translate(lang, 'live.applyLast')}</span>
					</AppButton>
				{/if}

				{#if canFillWeightAll && fillWeightKg != null}
					<AppButton
						variant="ghost"
						class="live-last-chip live-last-chip--tap"
						aria-label={fillWeightAllLabel}
						onclick={applyWeightToAllSets}
					>
						<span class="live-last-chip__label">{translate(lang, 'live.weightFillChip')}</span>
						<span class="live-last-chip__value tabular-nums">
							{fillWeightKg} {translate(lang, 'pr.kg')}
						</span>
						<span class="live-last-chip__action">{translate(lang, 'live.weightFillAll')}</span>
					</AppButton>
				{/if}
			</div>
		{/if}

		{#if bodyweight}
			<p class="live-bw-note">{translate(lang, 'live.weightBwHintShort')}</p>
		{/if}

		<div class="live-set-head" class:live-set-head--prev={hasPreviousColumn}>
			<span class="live-set-head__idx">#</span>
			{#if hasPreviousColumn}
				<span class="live-set-head__prev">{translate(lang, 'live.prev')}</span>
			{/if}
			<span class="live-set-head__weight" title={bodyweight ? translate(lang, 'live.weightBwHintShort') : undefined}>
				{weightLabel}
			</span>
			<span class="live-set-head__reps">{translate(lang, 'live.reps')}</span>
			<AppButton
				variant="ghost"
				class={cn('live-set-head-done', allSetsDone && 'live-set-head-done--all')}
				aria-label={toggleAllLabel}
				title={toggleAllLabel}
				onclick={onToggleAllComplete}
			>
				<LucideIcon icon={Check} size={ICON_SMALL} />
			</AppButton>
		</div>

		<ul class="live-set-list">
			{#each exercise.sets as set, si (si)}
				<li
					class="live-set-row"
					class:live-set-row--prev={hasPreviousColumn}
					class:is-done={set.completed}
					class:is-current={currentSetIndex === si}
					class:is-just-done={justDoneSetIndex === si}
					class:live-set-row--has-remove={showRemove(si)}
				>
					<span class="live-set-index">{si + 1}</span>
					{#if hasPreviousColumn}
						{#if canApplyPrevious(si)}
							<AppButton
								variant="ghost"
								class="live-set-prev live-set-prev--tap tabular-nums"
								aria-label={translate(lang, 'live.prevApplyAria', {
									value: previousLabel(si)
								})}
								title={translate(lang, 'live.prevApplyAria', { value: previousLabel(si) })}
								onclick={() => applyPreviousSet(si)}
							>
								{previousLabel(si)}
							</AppButton>
						{:else}
							<span class="live-set-prev tabular-nums">{previousLabel(si)}</span>
						{/if}
					{/if}
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
							variant={currentSetIndex === si ? 'primary' : 'secondary'}
							class="live-set-done-btn"
							aria-label={translate(lang, 'live.done')}
							title={translate(lang, 'live.done')}
							onclick={() => onComplete(si)}
						>
							<LucideIcon icon={Check} size={ICON_BUTTON} />
							<span class="sr-only">{translate(lang, 'live.done')}</span>
						</AppButton>
					{/if}
					{#if showRemove(si)}
						<AppButton
							variant="ghost"
							class="live-set-remove-btn"
							aria-label={translate(lang, 'live.removeSet')}
							title={translate(lang, 'live.removeSet')}
							onclick={() => onRemove(si)}
						>
							<LucideIcon icon={Trash2} size={ICON_SMALL} />
						</AppButton>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<div class="live-panel__tools">
		<AppButton
			variant="ghost"
			class="live-panel-add-set"
			onclick={() => live.addSet(exerciseIndex)}
			aria-label={translate(lang, 'live.addSet')}
			title={translate(lang, 'live.addSet')}
		>
			<LucideIcon icon={Plus} size={ICON_BUTTON} />
		</AppButton>
	</div>
</div>

{#if techniqueOpen && exerciseMeta}
	<ExerciseTechniqueSheet
		open={techniqueOpen}
		titleId={`live-technique-${exercise.exerciseId}`}
		{title}
		hint={labelTarget(exerciseMeta.target, lang)}
		imagePath={exerciseMeta.image}
		onDismiss={dismissTechnique}
	/>
{/if}
