<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { exerciseName } from '$lib/domain/exerciseName';
	import type { ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import { groupMemberRole } from '$lib/domain/workout';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { Check } from '@lucide/svelte';

	let {
		session,
		selectedExerciseIndex,
		names,
		lang,
		onSelect
	}: {
		session: WorkoutSession;
		selectedExerciseIndex: number;
		names: Map<string, ExerciseIndexItem>;
		lang: AppLocale;
		onSelect: (index: number) => void;
	} = $props();

	function titleFor(id: string): string {
		const item = names.get(id);
		return item ? exerciseName(item, lang) : translate(lang, 'records.fallback', { id });
	}

	function exerciseDone(index: number): boolean {
		const ex = session.exercises[index];
		if (!ex || ex.sets.length === 0) return false;
		return ex.sets.every((s) => s.completed);
	}
</script>

<nav class="live-nav" aria-label={translate(lang, 'live.title')}>
	<ul class="live-nav-list">
		{#each session.exercises as ex, ei (ex.exerciseId + '-nav-' + ei)}
			{@const role = groupMemberRole(session.exercises, ei)}
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
					onclick={() => onSelect(ei)}
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
