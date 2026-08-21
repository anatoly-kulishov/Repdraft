<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import type { ExerciseIndexItem, SessionExercise, WorkoutSession } from '$lib/domain/types';
	import { isBodyweightEquipment } from '$lib/domain/workout';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { Check, Plus, RefreshCw, Trash2 } from '@lucide/svelte';

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
	let techniqueSrc = $state('');

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
		if (!last) return null;
		const r = last.reps != null ? `${last.reps}` : null;
		if (last.weightKg != null && r != null) return `${last.weightKg} × ${r}`;
		if (r != null) return `${r} ${translate(lang, 'live.reps').toLowerCase()}`;
		if (last.weightKg != null) return `${last.weightKg}`;
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

	function techniqueMediaSrc(imagePath: string): string {
		return `/${imagePath.replace(/^images\//, 'videos/').replace(/\.jpe?g$/i, '.gif')}`;
	}

	function openTechnique() {
		const meta = names.get(exercise.exerciseId);
		if (!meta) return;
		techniqueSrc = techniqueMediaSrc(meta.image);
		techniqueOpen = true;
	}

	function dismissTechnique() {
		techniqueOpen = false;
	}

	function onTechniqueImgError(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		const meta = names.get(exercise.exerciseId);
		if (meta && img.src.includes('/videos/')) {
			img.src = `/${meta.image}`;
		}
	}

	let canRemoveSet = $derived(exercise.sets.length > 1);
	let allSetsDone = $derived(
		exercise.sets.length > 0 && exercise.sets.every((s) => s.completed)
	);
	let currentSetIndex = $derived(exercise.sets.findIndex((s) => !s.completed));
	let lastCopy = $derived(lastVars(exercise.exerciseId));
	let canApplyLast = $derived(
		lastCopy != null && exercise.sets.some((s) => !s.completed)
	);
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
	let exerciseMeta = $derived(names.get(exercise.exerciseId) ?? null);
	let title = $derived(titleFor(exercise.exerciseId));

	function showRemove(setIndex: number): boolean {
		return canRemoveSet && setIndex === exercise.sets.length - 1;
	}

	function scrollCurrentSetIntoView(node: HTMLElement) {
		queueMicrotask(() => {
			node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
		});
	}
</script>

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
			done: exerciseIndex + 1,
			total: session.exercises.length
		})}
	</p>

	<div class="live-panel-head">
		{#if exerciseMeta}
			<button
				type="button"
				class="live-panel-thumb"
				aria-label={translate(lang, 'exercise.openTechnique', { name: title })}
				onclick={openTechnique}
			>
				<img src={`/${exerciseMeta.image}`} alt="" width="48" height="48" decoding="async" />
			</button>
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
		</div>
		{#if canSwapAlternative && onSwapAlternative}
			<button
				type="button"
				class="btn-ghost live-panel-swap"
				aria-label={translate(lang, 'live.swapAlternative')}
				title={translate(lang, 'live.swapAlternative')}
				onclick={onSwapAlternative}
			>
				<LucideIcon icon={RefreshCw} size={ICON_SMALL} />
			</button>
		{/if}
	</div>

	{#if bodyweight}
		<p class="live-panel-hint">{translate(lang, 'live.weightBwHint')}</p>
	{/if}
	{#if lastCopy}
		{#if canApplyLast}
			<button
				type="button"
				class="live-last live-last--tap"
				aria-label={translate(lang, 'live.lastApplyAria', { value: formatLast(exercise.exerciseId) ?? '' })}
				onclick={applyLastPerformance}
			>
				{translate(lang, 'live.last')}:
				<span class="live-last__value">{formatLast(exercise.exerciseId)}</span>
			</button>
		{:else}
			<p class="live-last">
				{translate(lang, 'live.last')}:
				<span class="live-last__value">{formatLast(exercise.exerciseId)}</span>
			</p>
		{/if}
	{/if}

	<div class="live-set-head" class:live-set-head--with-remove={canRemoveSet}>
		<span>#</span>
		<span>{weightLabel}</span>
		<span>{translate(lang, 'live.reps')}</span>
		<button
			type="button"
			class="live-set-head-done"
			class:live-set-head-done--all={allSetsDone}
			aria-label={toggleAllLabel}
			title={toggleAllLabel}
			onclick={onToggleAllComplete}
		>
			✓
		</button>
		{#if canRemoveSet}
			<span class="live-set-head-remove"></span>
		{/if}
	</div>

	<ul class="live-set-list">
		{#each exercise.sets as set, si (si)}
			<li
				class="live-set-row"
				class:is-done={set.completed}
				class:is-current={currentSetIndex === si}
				class:is-just-done={justDoneSetIndex === si}
				class:live-set-row--with-remove={canRemoveSet}
			>
				<span class="live-set-index">{si + 1}</span>
				<input
					class="field live-set-weight tabular-nums"
					class:is-invalid={invalidSetIndex === si && invalidKind === 'weight'}
					aria-invalid={invalidSetIndex === si && invalidKind === 'weight'}
					type="text"
					inputmode="decimal"
					autocomplete="off"
					placeholder={weightPlaceholder}
					aria-label={`${weightLabel} ${si + 1}`}
					value={set.weightKg ?? ''}
					onfocus={(e) => scrollCurrentSetIntoView(e.currentTarget)}
					oninput={(e) => {
						const el = e.currentTarget;
						const next = onWeight(si, el.value);
						if (el.value !== next) el.value = next;
					}}
				/>
				<input
					class="field live-set-reps tabular-nums"
					class:is-invalid={invalidSetIndex === si && invalidKind === 'reps'}
					aria-invalid={invalidSetIndex === si && invalidKind === 'reps'}
					type="text"
					inputmode="numeric"
					autocomplete="off"
					aria-label={`${translate(lang, 'live.reps')} ${si + 1}`}
					value={set.reps ?? ''}
					onfocus={(e) => scrollCurrentSetIntoView(e.currentTarget)}
					oninput={(e) => {
						const el = e.currentTarget;
						const next = onReps(si, el.value);
						if (el.value !== next) el.value = next;
					}}
				/>
				{#if set.completed}
					<button
						type="button"
						class="btn-ghost live-set-done-btn live-set-done-btn--done"
						aria-label={translate(lang, 'live.undoDone')}
						title={translate(lang, 'live.undoDone')}
						onclick={() => onUncomplete(si)}
					>
						<LucideIcon icon={Check} size={ICON_BUTTON} />
						<span class="sr-only">{translate(lang, 'live.undoDone')}</span>
					</button>
				{:else}
					<button
						type="button"
						class="{currentSetIndex === si
							? 'btn-primary'
							: 'btn-secondary'} live-set-done-btn"
						aria-label={translate(lang, 'live.done')}
						title={translate(lang, 'live.done')}
						onclick={() => onComplete(si)}
					>
						<LucideIcon icon={Check} size={ICON_BUTTON} />
						<span class="sr-only">{translate(lang, 'live.done')}</span>
					</button>
				{/if}
				{#if showRemove(si)}
					<button
						type="button"
						class="btn-ghost live-set-remove-btn"
						aria-label={translate(lang, 'live.removeSet')}
						title={translate(lang, 'live.removeSet')}
						onclick={() => onRemove(si)}
					>
						<LucideIcon icon={Trash2} size={ICON_SMALL} />
					</button>
				{:else if canRemoveSet}
					<span class="live-set-remove-spacer" aria-hidden="true"></span>
				{/if}
			</li>
		{/each}
	</ul>

	<button
		type="button"
		class="btn-ghost mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm"
		onclick={() => live.addSet(exerciseIndex)}
	>
		<LucideIcon icon={Plus} size={ICON_SMALL} />
		{translate(lang, 'live.addSet')}
	</button>
</div>

{#if techniqueOpen && exerciseMeta}
	<BottomSheet
		open={techniqueOpen}
		raised
		titleId={`live-technique-${exercise.exerciseId}`}
		onDismiss={dismissTechnique}
	>
		<p id={`live-technique-${exercise.exerciseId}`} class="bottom-sheet__title">{title}</p>
		<p class="bottom-sheet__hint">{labelTarget(exerciseMeta.target, lang)}</p>
		<div class="exercise-technique-sheet__media media-well">
			<img
				src={techniqueSrc}
				alt=""
				width="180"
				height="180"
				decoding="async"
				class="exercise-technique-sheet__img"
				onerror={onTechniqueImgError}
			/>
		</div>
		{#snippet actions()}
			<button type="button" class="btn-primary min-h-12" onclick={dismissTechnique}>
				{translate(lang, 'exercise.closeMedia')}
			</button>
		{/snippet}
	</BottomSheet>
{/if}
