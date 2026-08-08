<script lang="ts">
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { labelTarget } from '$lib/domain/labels.ru';

	let {
		exercise,
		recordLabel = null
	}: {
		exercise: ExerciseIndexItem;
		recordLabel?: string | null;
	} = $props();
</script>

<a
	href={`/exercise/${exercise.id}`}
	class="exercise-card group relative flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition duration-200 active:scale-[0.98] md:hover:-translate-y-0.5 md:hover:border-[var(--color-accent)]"
>
	{#if recordLabel}
		<span
			class="absolute right-1.5 top-1.5 z-10 max-w-[90%] truncate rounded-md bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white"
			title={recordLabel}
		>
			PR {recordLabel}
		</span>
	{/if}
	<div class="flex aspect-square items-center justify-center bg-[var(--color-surface-muted)] p-2 sm:p-3">
		<img
			src={`/${exercise.image}`}
			alt={exercise.name}
			width="180"
			height="180"
			loading="lazy"
			decoding="async"
			class="h-full w-full max-h-[180px] object-contain"
		/>
	</div>
	<div class="flex flex-1 flex-col gap-0.5 p-2.5 sm:p-3">
		<h2 class="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--color-ink)] sm:text-sm">
			{exercise.name}
		</h2>
		<p class="truncate text-[11px] text-[var(--color-muted)] sm:text-xs">{labelTarget(exercise.target)}</p>
	</div>
</a>
