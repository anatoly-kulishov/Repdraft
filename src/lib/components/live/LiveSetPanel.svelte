<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import { loggedSetKind, nextSetKind } from '$lib/domain/session';
	import type { ExerciseIndexItem, SessionExercise, SetKind, WorkoutSession } from '$lib/domain/types';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { Check, Plus, Trash2 } from '@lucide/svelte';

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
		onWeight,
		onReps,
		onComplete,
		onUncomplete,
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
		onWeight: (setIndex: number, value: string) => void;
		onReps: (setIndex: number, value: string) => void;
		onComplete: (setIndex: number) => void;
		onUncomplete: (setIndex: number) => void;
		onRemove: (setIndex: number) => void;
		invalidSetIndex?: number | null;
		invalidKind?: 'weight' | 'reps' | null;
		justDoneSetIndex?: number | null;
	} = $props();

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
		const w = last.weightKg != null ? `${last.weightKg}` : '—';
		const r = last.reps != null ? `${last.reps}` : '—';
		return `${w} × ${r}`;
	}

	function lastVars(exerciseId: string): { w: string; r: string } | null {
		const last = live.lastFor(exerciseId);
		if (!last) return null;
		return {
			w: last.weightKg != null ? `${last.weightKg}` : '—',
			r: last.reps != null ? `${last.reps}` : '—'
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

	function kindLabel(kind: SetKind): string {
		switch (kind) {
			case 'work':
				return translate(lang, 'live.setKindWork');
			case 'warmup':
				return translate(lang, 'live.setKindWarmup');
			case 'drop':
				return translate(lang, 'live.setKindDrop');
			default: {
				const _exhaustive: never = kind;
				return _exhaustive;
			}
		}
	}

	function cycleKind(setIndex: number) {
		const set = exercise.sets[setIndex];
		if (!set || set.completed) return;
		live.patchSet(exerciseIndex, setIndex, { kind: nextSetKind(loggedSetKind(set)) });
	}

	let canRemoveSet = $derived(exercise.sets.length > 1);
	let lastCopy = $derived(lastVars(exercise.exerciseId));
	let canApplyLast = $derived(
		lastCopy != null && exercise.sets.some((s) => !s.completed)
	);
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
	<h2 class="live-panel-title">{titleFor(exercise.exerciseId)}</h2>
	{#if metaFor(exercise.exerciseId)}
		<p class="live-panel-meta">{metaFor(exercise.exerciseId)}</p>
	{/if}
	{#if lastCopy}
		{#if canApplyLast}
			<button
				type="button"
				class="live-last live-last--action"
				onclick={applyLastPerformance}
			>
				{translate(lang, 'live.lastApply', lastCopy)}
			</button>
		{:else}
			<p class="live-last">
				{translate(lang, 'live.last')}:
				<span class="font-medium text-[var(--color-ink)]">{formatLast(exercise.exerciseId)}</span>
			</p>
		{/if}
	{/if}

	<div class="live-set-head" class:live-set-head--with-remove={canRemoveSet} aria-hidden="true">
		<span>#</span>
		<span>{translate(lang, 'live.cycleSetKind')}</span>
		<span>{translate(lang, 'live.weight')}</span>
		<span>{translate(lang, 'live.reps')}</span>
		<span class="live-set-head-done">✓</span>
		{#if canRemoveSet}
			<span class="live-set-head-remove"></span>
		{/if}
	</div>

	<ul class="live-set-list">
		{#each exercise.sets as set, si (si)}
			<li
				class="live-set-row"
				class:is-done={set.completed}
				class:is-just-done={justDoneSetIndex === si}
				class:live-set-row--with-remove={canRemoveSet}
			>
				<span class="live-set-index">{si + 1}</span>
				{#if !set.completed}
					<button
						type="button"
						class="live-set-kind"
						class:live-set-kind--warmup={loggedSetKind(set) === 'warmup'}
						class:live-set-kind--drop={loggedSetKind(set) === 'drop'}
						aria-label={translate(lang, 'live.cycleSetKind')}
						title={translate(lang, 'live.cycleSetKind')}
						onclick={() => cycleKind(si)}
					>
						{kindLabel(loggedSetKind(set))}
					</button>
				{:else}
					<span
						class="live-set-kind live-set-kind--static"
						class:live-set-kind--warmup={loggedSetKind(set) === 'warmup'}
						class:live-set-kind--drop={loggedSetKind(set) === 'drop'}
					>
						{kindLabel(loggedSetKind(set))}
					</span>
				{/if}
				<input
					class="field live-set-weight tabular-nums"
					class:is-invalid={invalidSetIndex === si && invalidKind === 'weight'}
					aria-invalid={invalidSetIndex === si && invalidKind === 'weight'}
					type="text"
					inputmode="decimal"
					autocomplete="off"
					aria-label={`${translate(lang, 'live.weight')} ${si + 1}`}
					value={set.weightKg ?? ''}
					oninput={(e) => onWeight(si, e.currentTarget.value)}
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
					oninput={(e) => onReps(si, e.currentTarget.value)}
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
						class="btn-secondary live-set-done-btn"
						aria-label={translate(lang, 'live.done')}
						title={translate(lang, 'live.done')}
						onclick={() => onComplete(si)}
					>
						<LucideIcon icon={Check} size={ICON_BUTTON} />
						<span class="sr-only">{translate(lang, 'live.done')}</span>
					</button>
				{/if}
				{#if canRemoveSet}
					<button
						type="button"
						class="btn-ghost is-danger live-set-remove-btn"
						aria-label={translate(lang, 'live.removeSet')}
						title={translate(lang, 'live.removeSet')}
						onclick={() => onRemove(si)}
					>
						<LucideIcon icon={Trash2} size={ICON_SMALL} />
					</button>
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
