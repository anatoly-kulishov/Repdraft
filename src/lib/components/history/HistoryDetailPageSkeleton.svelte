<script lang="ts">
	import { peekLocalSession } from '$lib/storage/localSessionRepository';
	import { completedSetCount, sessionDurationMs } from '$lib/domain/session';
	import { formatDurationMs, formatLongDate } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { browser } from '$app/environment';

	const DEFAULT_EXERCISES = 3;

	let { sessionId = '' }: { sessionId?: string } = $props();

	let lang = $derived($resolvedLocale);

	type PreviewExercise = { setCount: number };

	let peek = $derived.by(() => (sessionId && browser ? peekLocalSession(sessionId) : null));

	let metaLead = $derived.by(() => {
		if (!peek) return null;
		const when = peek.finishedAt ?? peek.startedAt;
		if (!when) return null;
		return `${formatLongDate(when, lang)} · ${formatDurationMs(sessionDurationMs(peek))} · ${translate(lang, 'workouts.historySets', { n: completedSetCount(peek) })}`;
	});

	let previewExercises = $derived.by((): PreviewExercise[] => {
		if (!sessionId || !browser) {
			return Array.from({ length: DEFAULT_EXERCISES }, () => ({ setCount: 0 }));
		}
		const peeked = peekLocalSession(sessionId);
		if (!peeked?.exercises.length) {
			return Array.from({ length: DEFAULT_EXERCISES }, () => ({ setCount: 0 }));
		}
		return peeked.exercises.map((ex) => ({
			setCount: Math.min(ex.sets.filter((set) => set.completed).length, 6)
		}));
	});
</script>

<section class="content-page content-page--narrow history-detail history-detail--skeleton" aria-busy="true">
	<p class="page-lead mt-1 lg:mt-0 history-detail-skeleton-meta">
		{#if metaLead}
			{metaLead}
		{:else}
			<span class="history-detail-skeleton-meta__line" aria-hidden="true"></span>
		{/if}
	</p>

	<ul class="history-exercise-list history-exercise-list--skeleton">
		{#each previewExercises as ex, i (i)}
			<li class="history-exercise history-exercise--skeleton">
				<div class="history-exercise__head" aria-hidden="true">
					<span class="history-exercise__thumb media-well history-skeleton-thumb"></span>
					<span class="workout-preview-row-main">
						<div class="workout-preview-row-body">
							<span class="history-skeleton-title"></span>
							<span class="history-skeleton-sub"></span>
						</div>
						<span class="workout-preview-chevron history-skeleton-chevron" aria-hidden="true"></span>
					</span>
				</div>
				{#if ex.setCount === 0}
					<p class="history-exercise__empty">{translate(lang, 'workouts.noLoggedSets')}</p>
				{:else}
					<ul
						class="history-exercise__sets"
						class:history-exercise__sets--grid={ex.setCount >= 4}
						aria-hidden="true"
					>
						{#each Array.from({ length: ex.setCount }, (_, si) => si) as si (si)}
							<li class="history-exercise__set history-skeleton-set">
								<span class="history-skeleton-set__i"></span>
								<span class="history-skeleton-set__val"></span>
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
</section>
