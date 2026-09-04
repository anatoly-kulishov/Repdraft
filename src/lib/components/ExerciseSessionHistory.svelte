<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
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

	/** First paint: few sessions. Sets per card capped so stress/giant-sets stay scannable. */
	const SESSION_PAGE = 5;
	const SETS_PREVIEW = 4;

	let {
		exerciseId,
		limit = 3,
		linkRows = true,
		showEmptyCoachmark = true,
		panel = true,
		emptyMessageKey = 'exercise.historyEmpty' as const,
		ready = undefined as boolean | undefined
	}: {
		exerciseId: string;
		/** Initial session rows before «Show more». */
		limit?: number;
		linkRows?: boolean;
		showEmptyCoachmark?: boolean;
		/** When false, omit `.panel` chrome (sheet body). */
		panel?: boolean;
		emptyMessageKey?: 'exercise.historyEmpty' | 'live.historyEmpty';
		/** If parent already refreshed history, pass true/false to skip local refresh. */
		ready?: boolean | undefined;
	} = $props();

	let lang = $derived($resolvedLocale);
	let localReady = $state(false);
	let historyReady = $derived(ready !== undefined ? ready : localReady);
	let visibleLimit = $state(3);

	$effect(() => {
		exerciseId;
		visibleLimit = limit;
	});

	let fetched = $derived(
		historyReady ? recentExerciseLogs($live.history, exerciseId, visibleLimit + 1) : []
	);
	let logs = $derived(fetched.slice(0, visibleLimit));
	let hasMoreSessions = $derived(fetched.length > visibleLimit);
	let showHistoryEmptyCoachmark = $derived(
		showEmptyCoachmark &&
			historyReady &&
			logs.length === 0 &&
			shouldShowCoachmark($onboarding, 'exercise.historyEmpty')
	);

	onMount(() => {
		if (ready !== undefined) return;
		void live.refreshHistory().finally(() => {
			localReady = true;
		});
	});

	function formatSet(weightKg: number | null, reps: number | null): string {
		const w = weightKg != null ? String(weightKg) : '-';
		const r = reps != null ? String(reps) : '-';
		return `${w}×${r}`;
	}

	function showMoreSessions() {
		visibleLimit += SESSION_PAGE;
	}

	function dismissHistoryEmptyCoachmark() {
		onboarding.dismissCoachmark('exercise.historyEmpty');
		blurActiveElement();
	}
</script>

<section class={panel ? 'exercise-history panel' : 'exercise-history exercise-history--plain'}>
	{#if !historyReady}
		<div class="exercise-history__hint">
			<Spinner label={translate(lang, 'common.loading')} size="sm" />
		</div>
	{:else if logs.length === 0}
		<p class="exercise-history__hint text-sm text-[var(--color-muted)]">
			{translate(lang, emptyMessageKey)}
		</p>
		{#if showHistoryEmptyCoachmark}
			<Coachmark
				class="mt-3"
				message={translate(lang, 'onboarding.coachExerciseHistoryEmpty')}
				onDismiss={dismissHistoryEmptyCoachmark}
			/>
		{/if}
	{:else}
		{#snippet setList(sets: { weightKg: number | null; reps: number | null }[])}
			{@const preview = sets.slice(0, SETS_PREVIEW)}
			{@const more = sets.length - preview.length}
			<ul class="exercise-history__set-list">
				{#each preview as set, si (si)}
					<li class="exercise-history__set-line tabular-nums">
						<span class="exercise-history__set-idx">#{si + 1}</span>
						<span class="exercise-history__set-val">{formatSet(set.weightKg, set.reps)}</span>
					</li>
				{/each}
			</ul>
			{#if more > 0}
				<span class="exercise-history__more-sets">
					{translate(lang, 'exercise.historyMoreSets', { n: more })}
				</span>
			{/if}
		{/snippet}
		<ul class="exercise-history__list">
			{#each logs as log (log.sessionId)}
				<li class="exercise-history__row">
					{#if linkRows}
						<a class="exercise-history__link" href={`/workouts/history/${log.sessionId}`}>
							<span class="exercise-history__when">{formatRelativeDay(log.finishedAt, lang)}</span>
							<span class="exercise-history__plan">{log.planName}</span>
							{@render setList(log.sets)}
						</a>
					{:else}
						<div class="exercise-history__card">
							<span class="exercise-history__when">{formatRelativeDay(log.finishedAt, lang)}</span>
							<span class="exercise-history__plan">{log.planName}</span>
							{@render setList(log.sets)}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
		{#if hasMoreSessions}
			<AppButton
				variant="secondary"
				class="exercise-history__more mt-2 w-full"
				onclick={showMoreSessions}
			>
				{translate(lang, 'exercise.historyShowMore')}
			</AppButton>
		{/if}
	{/if}
</section>
