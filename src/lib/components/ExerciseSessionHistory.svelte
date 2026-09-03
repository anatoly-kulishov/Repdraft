<script lang="ts">
	import Coachmark from '$lib/components/onboarding/Coachmark.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { shouldShowCoachmark } from '$lib/domain/onboarding';
	import { blurActiveElement } from '$lib/dom/blurActiveElement';
	import { recentExerciseLogs } from '$lib/domain/session';
	import { formatRelativeDay } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { onboarding } from '$lib/stores/onboarding';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onMount } from 'svelte';

	let { exerciseId }: { exerciseId: string } = $props();

	let lang = $derived($resolvedLocale);
	let historyReady = $state(false);
	let logs = $derived(historyReady ? recentExerciseLogs($live.history, exerciseId, 5) : []);
	let showHistoryEmptyCoachmark = $derived(
		historyReady &&
			logs.length === 0 &&
			shouldShowCoachmark($onboarding, 'exercise.historyEmpty')
	);

	onMount(() => {
		void live.refreshHistory().finally(() => {
			historyReady = true;
		});
	});

	function formatSet(weightKg: number | null, reps: number | null): string {
		const w = weightKg != null ? String(weightKg) : '-';
		const r = reps != null ? String(reps) : '-';
		return `${w}×${r}`;
	}

	function dismissHistoryEmptyCoachmark() {
		onboarding.dismissCoachmark('exercise.historyEmpty');
		blurActiveElement();
	}
</script>

<section class="exercise-history panel">
	{#if !historyReady}
		<div class="exercise-history__hint">
			<Spinner label={translate(lang, 'common.loading')} size="sm" />
		</div>
	{:else if logs.length === 0}
		<p class="exercise-history__hint text-sm text-[var(--color-muted)]">
			{translate(lang, 'exercise.historyEmpty')}
		</p>
		{#if showHistoryEmptyCoachmark}
			<Coachmark
				class="mt-3"
				message={translate(lang, 'onboarding.coachExerciseHistoryEmpty')}
				onDismiss={dismissHistoryEmptyCoachmark}
			/>
		{/if}
	{:else}
		<ul class="exercise-history__list">
			{#each logs as log (log.sessionId)}
				<li class="exercise-history__row">
					<a class="exercise-history__link" href={`/workouts/history/${log.sessionId}`}>
						<span class="exercise-history__when">{formatRelativeDay(log.finishedAt, lang)}</span>
						<span class="exercise-history__plan">{log.planName}</span>
						<span class="exercise-history__sets">
							{log.sets.map((s) => formatSet(s.weightKg, s.reps)).join(' · ')}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
