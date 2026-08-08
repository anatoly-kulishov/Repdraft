<script lang="ts">
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelTarget } from '$lib/domain/labels.ru';
	import { resolvedLocale } from '$lib/stores/locale';

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
	let loaded = $state(false);
	let imgEl = $state<HTMLImageElement | null>(null);

	$effect(() => {
		const img = imgEl;
		if (img?.complete && img.naturalWidth > 0) loaded = true;
	});

	function onImgLoad() {
		loaded = true;
	}
</script>

<a
	href={`/exercise/${exercise.id}`}
	class="exercise-card relative flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] active:bg-[var(--color-surface-muted)]"
>
	{#if recordLabel}
		<span
			class="absolute right-1.5 top-1.5 z-10 max-w-[85%] truncate rounded bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white"
			title={recordLabel}
		>
			{recordLabel}
		</span>
	{/if}
	<div class="relative flex aspect-square items-center justify-center bg-[var(--color-surface-muted)] p-2">
		<img
			bind:this={imgEl}
			src={`/${exercise.image}`}
			alt={title}
			width="180"
			height="180"
			loading={priority ? 'eager' : 'lazy'}
			fetchpriority={priority ? 'high' : 'auto'}
			decoding="async"
			class={`h-full w-full max-h-[180px] object-contain ${loaded ? 'is-loaded' : ''}`}
			onload={onImgLoad}
		/>
	</div>
	<div class="flex flex-1 flex-col gap-0.5 p-2.5">
		<h2 class="line-clamp-2 min-h-[2.1em] text-[13px] font-semibold leading-snug text-[var(--color-ink)]">
			{title}
		</h2>
		<p class="truncate text-[11px] text-[var(--color-muted)]">
			{labelTarget(exercise.target, lang)}
		</p>
	</div>
</a>
