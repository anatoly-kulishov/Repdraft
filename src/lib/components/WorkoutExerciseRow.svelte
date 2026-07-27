<script lang="ts">
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import type { WorkoutExercise } from '$lib/domain/types';

	let {
		item,
		meta,
		index,
		total,
		onupdate,
		onmove,
		onremove
	}: {
		item: WorkoutExercise;
		meta: ExerciseIndexItem | null;
		index: number;
		total: number;
		onupdate: (patch: Partial<Omit<WorkoutExercise, 'exerciseId'>>) => void;
		onmove: (from: number, to: number) => void;
		onremove: () => void;
	} = $props();
</script>

<article
	class="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center"
>
	<div class="flex min-w-0 flex-1 items-center gap-3">
		{#if meta}
			<img
				src={`/${meta.image}`}
				alt=""
				width="64"
				height="64"
				class="h-16 w-16 shrink-0 rounded-lg bg-[var(--color-surface-muted)] object-contain"
			/>
			<div class="min-w-0">
				<a class="font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent)]" href={`/exercise/${item.exerciseId}`}>
					{meta.name}
				</a>
			</div>
		{:else}
			<p class="text-sm text-[var(--color-muted)]">Упражнение {item.exerciseId}</p>
		{/if}
	</div>

	<div class="grid grid-cols-3 gap-2 sm:w-[280px]">
		<label class="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
			Подходы
			<input
				class="field mt-1 w-full"
				type="number"
				min="1"
				max="20"
				value={item.sets}
				onchange={(e) =>
					onupdate({
						sets: Math.min(20, Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1))
					})}
			/>
		</label>
		<label class="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
			Повторы
			<input
				class="field mt-1 w-full"
				type="number"
				min="1"
				max="100"
				value={item.reps}
				onchange={(e) =>
					onupdate({
						reps: Math.min(100, Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1))
					})}
			/>
		</label>
		<label class="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
			Отдых, с
			<input
				class="field mt-1 w-full"
				type="number"
				min="0"
				max="600"
				step="15"
				value={item.restSec}
				onchange={(e) =>
					onupdate({
						restSec: Math.min(600, Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0))
					})}
			/>
		</label>
	</div>

	<div class="flex gap-1 sm:flex-col">
		<button
			type="button"
			class="btn-ghost"
			disabled={index === 0}
			onclick={() => onmove(index, index - 1)}
			aria-label="Выше"
		>
			↑
		</button>
		<button
			type="button"
			class="btn-ghost"
			disabled={index >= total - 1}
			onclick={() => onmove(index, index + 1)}
			aria-label="Ниже"
		>
			↓
		</button>
		<button type="button" class="btn-ghost text-red-700" onclick={onremove} aria-label="Удалить">
			✕
		</button>
	</div>
</article>
