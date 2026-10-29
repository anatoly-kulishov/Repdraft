<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { coachSessionTotals, type CoachSessionDetail } from '$lib/domain/coach';
	import { formatKgInt } from '$lib/domain/format';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { loggedSetKind, setKindMessageKey } from '$lib/domain/session';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { formatRelativeDayShort } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		open,
		detail,
		busy = false,
		indexById,
		onDismiss
	}: {
		open: boolean;
		detail: CoachSessionDetail | null;
		busy?: boolean;
		indexById: Map<string, ExerciseIndexItem>;
		onDismiss: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let totals = $derived(detail ? coachSessionTotals(detail) : null);

	function labelFor(exerciseId: string): string {
		const meta = indexById.get(exerciseId);
		return meta ? exerciseName(meta, lang) : exerciseId;
	}

	function setLine(weightKg: number | null, reps: number | null): string {
		if (weightKg == null && reps == null) return translate(lang, 'coach.sessionSetEmpty');
		return translate(lang, 'coach.sessionSetLine', {
			weight: weightKg ?? translate(lang, 'coach.sessionSetEmpty'),
			reps: reps ?? translate(lang, 'coach.sessionSetEmpty')
		});
	}
</script>

<BottomSheet {open} titleId="coach-session-detail-title" {onDismiss} raised>
	<p id="coach-session-detail-title" class="bottom-sheet__title">
		{detail?.planName?.trim() || translate(lang, 'coach.sessionDetailTitle')}
	</p>
	{#if detail?.finishedAt && totals}
		<p class="bottom-sheet__hint">
			{totals.minutes != null
				? translate(lang, 'coach.sessionSummary', {
						when: formatRelativeDayShort(detail.finishedAt, lang),
						min: totals.minutes,
						sets: totals.sets,
						kg: formatKgInt(totals.volumeKg)
					})
				: translate(lang, 'coach.sessionMeta', {
						when: formatRelativeDayShort(detail.finishedAt, lang),
						sets: totals.sets,
						volume: formatKgInt(totals.volumeKg)
					})}
		</p>
	{/if}

	{#if busy && !detail}
		<div class="coach-session-sheet__loading" aria-busy="true">
			<Spinner size="sm" block={false} />
			<span>{translate(lang, 'coach.sessionDetailLoading')}</span>
		</div>
	{:else if detail}
		{@const exercises = detail.exercises.filter((ex) => !ex.skipped)}
		{#if exercises.length === 0}
			<p class="bottom-sheet__hint">{translate(lang, 'coach.sessionDetailEmpty')}</p>
		{:else}
			<ul class="coach-session-sheet__list">
				{#each exercises as ex (ex.exerciseId + String(ex.sets.length))}
					<li class="coach-session-sheet__ex">
						<p class="coach-session-sheet__ex-title">{labelFor(ex.exerciseId)}</p>
						{#if ex.targetSets > 0 || ex.targetReps > 0}
							<p class="coach-session-sheet__ex-target">
								{ex.targetSets}×{ex.targetReps}
							</p>
						{/if}
						<ul class="coach-session-sheet__sets">
							{#each ex.sets as set, i (i)}
								{@const kind = loggedSetKind(set)}
								<li
									class="coach-session-sheet__set"
									class:coach-session-sheet__set--open={!set.completed}
								>
									<span class="tabular-nums">{setLine(set.weightKg, set.reps)}</span>
									{#if kind !== 'work'}
										<span class="coach-session-sheet__kind">
											{translate(lang, setKindMessageKey(kind))}
										</span>
									{/if}
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	{#snippet actions()}
		<AppButton variant="secondary" onclick={onDismiss}>
			{translate(lang, 'common.close')}
		</AppButton>
	{/snippet}
</BottomSheet>

<style>
	.coach-session-sheet__loading {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.75rem;
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.coach-session-sheet__list {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: min(50vh, 22rem);
		overflow: auto;
	}

	.coach-session-sheet__ex-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.coach-session-sheet__ex-target {
		margin: 0.15rem 0 0;
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	.coach-session-sheet__sets {
		list-style: none;
		margin: 0.35rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.coach-session-sheet__set {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.875rem;
		min-height: 48px;
		padding: 0.25rem 0;
		border-top: 1px solid var(--color-border);
	}

	.coach-session-sheet__set--open {
		opacity: 0.55;
	}

	.coach-session-sheet__kind {
		font-size: 0.75rem;
		color: var(--color-muted);
		flex-shrink: 0;
	}
</style>
