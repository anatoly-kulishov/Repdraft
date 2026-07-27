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
	class="exercise-card group relative flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--color-accent)]"
>
	{#if recordLabel}
		<span
			class="absolute right-2 top-2 z-10 max-w-[85%] truncate rounded-md bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white"
			title={recordLabel}
		>
			PR {recordLabel}
		</span>
	{/if}
	<div class="flex aspect-square items-center justify-center bg-[var(--color-surface-muted)] p-3">
		<img
			src={`/${exercise.image}`}
			alt={exercise.name}
			width="180"
			height="180"
			loading="lazy"
			class="h-[180px] w-[180px] max-h-full max-w-full object-contain"
		/>
	</div>
	<div class="flex flex-1 flex-col gap-1 p-3">
		<h2 class="font-[family-name:var(--font-body)] text-sm font-semibold leading-snug text-[var(--color-ink)]">
			{exercise.name}
		</h2>
		<p class="text-xs text-[var(--color-muted)]">{labelTarget(exercise.target)}</p>
	</div>
</a>
