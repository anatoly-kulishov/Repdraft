<script lang="ts">
	import { recentExerciseLogs } from '$lib/domain/session';
	import { formatRelativeDay } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onMount } from 'svelte';

	let { exerciseId }: { exerciseId: string } = $props();

	let lang = $derived($resolvedLocale);
	let historyReady = $state(false);
	let logs = $derived(
		historyReady ? recentExerciseLogs($live.history, exerciseId, 5) : []
	);

	onMount(() => {
		void live.refreshHistory().finally(() => {
			historyReady = true;
		});
	});

	function formatSet(weightKg: number | null, reps: number | null): string {
		const w = weightKg != null ? String(weightKg) : '—';
		const r = reps != null ? String(reps) : '—';
		return `${w}×${r}`;
	}
</script>

<section class="exercise-history panel">
	<h2 class="section-title mb-2">{translate(lang, 'exercise.historyTitle')}</h2>
	{#if !historyReady}
		<p class="exercise-history__hint text-sm text-[var(--color-muted)]">
			{translate(lang, 'common.loading')}
		</p>
	{:else if logs.length === 0}
		<p class="exercise-history__hint text-sm text-[var(--color-muted)]">
			{translate(lang, 'exercise.historyEmpty')}
		</p>
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
