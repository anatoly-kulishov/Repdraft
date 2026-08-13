<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import type { ExerciseIndexItem, SessionExercise, WorkoutSession } from '$lib/domain/types';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { Check, Plus } from '@lucide/svelte';

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
		onUncomplete
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
	{#if formatLast(exercise.exerciseId)}
		<p class="live-last">
			{translate(lang, 'live.last')}:
			<span class="font-medium text-[var(--color-ink)]">{formatLast(exercise.exerciseId)}</span>
		</p>
	{/if}

	<div class="live-set-head" aria-hidden="true">
		<span>#</span>
		<span>{translate(lang, 'live.weight')}</span>
		<span>{translate(lang, 'live.reps')}</span>
		<span class="live-set-head-done">✓</span>
	</div>

	<ul class="live-set-list">
		{#each exercise.sets as set, si (si)}
			<li class="live-set-row" class:is-done={set.completed}>
				<span class="live-set-index">{si + 1}</span>
				<input
					class="field live-set-weight tabular-nums"
					type="text"
					inputmode="decimal"
					autocomplete="off"
					aria-label={`${translate(lang, 'live.weight')} ${si + 1}`}
					value={set.weightKg ?? ''}
					oninput={(e) => onWeight(si, e.currentTarget.value)}
				/>
				<input
					class="field live-set-reps tabular-nums"
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
