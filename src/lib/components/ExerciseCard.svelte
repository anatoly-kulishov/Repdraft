<script lang="ts">
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelTarget } from '$lib/domain/labels.ru';
	import { translate } from '$lib/i18n/messages';
	import { draft } from '$lib/stores/draft';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';

	let {
		exercise,
		recordLabel = null,
		priority = false
	}: {
		exercise: ExerciseIndexItem;
		recordLabel?: string | null;
		/** First-screen images: eager + high fetch priority. */
		priority?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let title = $derived(exerciseName(exercise, lang));
	let inDraft = $derived($draft.exercises.some((ex) => ex.exerciseId === exercise.id));
	let loaded = $state(false);
	let imgEl = $state<HTMLImageElement | null>(null);

	$effect(() => {
		const img = imgEl;
		if (img?.complete && img.naturalWidth > 0) loaded = true;
	});

	function onImgLoad() {
		loaded = true;
	}

	function toggleDraft(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (inDraft) {
			draft.removeFromDraft(exercise.id);
			toasts.show(translate(lang, 'exercise.removed'), 'info');
			return;
		}
		const result = draft.addToDraft(exercise.id);
		if (result.added) {
			toasts.show(translate(lang, 'exercise.added'), 'success');
		} else {
			toasts.show(translate(lang, 'exercise.already'), 'info');
		}
	}
</script>

<article
	class="exercise-card relative flex min-w-0 max-w-full flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]"
>
	{#if recordLabel}
		<span
			class="absolute right-1.5 top-1.5 z-10 max-w-[70%] truncate rounded bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white"
			title={recordLabel}
		>
			{recordLabel}
		</span>
	{/if}

	<div class="relative aspect-square min-w-0 overflow-hidden bg-[var(--color-surface-muted)]">
		<a
			href={`/exercise/${exercise.id}`}
			class="absolute inset-0 block active:bg-[var(--color-surface-muted)]"
			aria-label={title}
		>
			<img
				bind:this={imgEl}
				src={`/${exercise.image}`}
				alt=""
				width="180"
				height="180"
				loading={priority ? 'eager' : 'lazy'}
				fetchpriority={priority ? 'high' : 'auto'}
				decoding="async"
				class={`exercise-card-img block h-full w-full object-cover ${loaded ? 'is-loaded' : ''}`}
				onload={onImgLoad}
			/>
		</a>
		<button
			type="button"
			class="exercise-card-add"
			class:is-in-draft={inDraft}
			onclick={toggleDraft}
			aria-label={translate(lang, inDraft ? 'exercise.removeDraft' : 'exercise.addDraft')}
			aria-pressed={inDraft}
		>
			{#if inDraft}
				<svg class="exercise-card-add-icon" viewBox="0 0 16 16" aria-hidden="true">
					<path
						d="M3.6 8.2 6.5 11l6-6.1"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{:else}
				<svg class="exercise-card-add-icon" viewBox="0 0 16 16" aria-hidden="true">
					<path
						d="M8 3.5v9M3.5 8h9"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
					/>
				</svg>
			{/if}
		</button>
	</div>

	<a
		href={`/exercise/${exercise.id}`}
		class="flex min-w-0 flex-1 flex-col gap-0.5 p-2.5 active:bg-[var(--color-surface-muted)]"
	>
		<h2 class="line-clamp-2 min-h-[2.1em] text-[13px] font-semibold leading-snug text-[var(--color-ink)]">
			{title}
		</h2>
		<p class="truncate text-[11px] text-[var(--color-muted)]">
			{labelTarget(exercise.target, lang)}
		</p>
	</a>
</article>
