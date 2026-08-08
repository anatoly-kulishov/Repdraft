<script lang="ts">
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import type { WorkoutExercise } from '$lib/domain/types';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

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

	let lang = $derived($resolvedLocale);
</script>

<article class="panel !p-3">
	<div class="mb-3 flex items-start gap-3">
		{#if meta}
			<img
				src={`/${meta.image}`}
				alt=""
				width="56"
				height="56"
				class="h-14 w-14 shrink-0 rounded-lg bg-[var(--color-surface-muted)] object-contain"
			/>
			<div class="min-w-0 flex-1">
				<a
					class="line-clamp-2 font-semibold leading-snug text-[var(--color-ink)] hover:text-[var(--color-accent)]"
					href={`/exercise/${item.exerciseId}`}
				>
					{exerciseName(meta, lang)}
				</a>
			</div>
		{:else}
			<p class="text-sm text-[var(--color-muted)]">
				{translate(lang, 'records.fallback', { id: item.exerciseId })}
			</p>
		{/if}

		<div class="flex shrink-0 gap-1">
			<button
				type="button"
				class="btn-ghost"
				disabled={index === 0}
				onclick={() => onmove(index, index - 1)}
				aria-label={translate(lang, 'builder.up')}
			>
				↑
			</button>
			<button
				type="button"
				class="btn-ghost"
				disabled={index >= total - 1}
				onclick={() => onmove(index, index + 1)}
				aria-label={translate(lang, 'builder.down')}
			>
				↓
			</button>
			<button
				type="button"
				class="btn-ghost is-danger"
				onclick={onremove}
				aria-label={translate(lang, 'builder.remove')}
			>
				✕
			</button>
		</div>
	</div>

	<div class="grid grid-cols-3 gap-2">
		<label class="field-label">
			{translate(lang, 'builder.sets')}
			<input
				class="field mt-1"
				type="number"
				inputmode="numeric"
				min="1"
				max="20"
				value={item.sets}
				onchange={(e) =>
					onupdate({
						sets: Math.min(20, Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1))
					})}
			/>
		</label>
		<label class="field-label">
			{translate(lang, 'builder.reps')}
			<input
				class="field mt-1"
				type="number"
				inputmode="numeric"
				min="1"
				max="100"
				value={item.reps}
				onchange={(e) =>
					onupdate({
						reps: Math.min(100, Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1))
					})}
			/>
		</label>
		<label class="field-label">
			{translate(lang, 'builder.rest')}
			<input
				class="field mt-1"
				type="number"
				inputmode="numeric"
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
</article>
