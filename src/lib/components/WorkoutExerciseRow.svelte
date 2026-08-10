<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import type { WorkoutExercise } from '$lib/domain/types';
	import { coerceReps, coerceRestSec, coerceSets, REPS } from '$lib/domain/inputLimits';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ChevronDown, ChevronUp, Trash2 } from '@lucide/svelte';

	let {
		item,
		meta,
		index,
		total,
		selected = false,
		groupRole = 'solo',
		onupdate,
		onmove,
		onremove,
		ontoggleSelect,
		ondissolve,
		ongroupSets,
		ongroupRest
	}: {
		item: WorkoutExercise;
		meta: ExerciseIndexItem | null;
		index: number;
		total: number;
		selected?: boolean;
		groupRole?: 'solo' | 'first' | 'middle' | 'last';
		onupdate: (patch: Partial<Omit<WorkoutExercise, 'exerciseId' | 'groupId'>>) => void;
		onmove: (from: number, to: number) => void;
		onremove: () => void;
		ontoggleSelect?: () => void;
		ondissolve?: () => void;
		ongroupSets?: (sets: number) => void;
		ongroupRest?: (restSec: number) => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let inGroup = $derived(Boolean(item.groupId));
	let showSets = $derived(!inGroup || groupRole === 'first');
	let showRest = $derived(!inGroup || groupRole === 'last');
</script>

<article
	class="panel !p-3"
	class:ring-2={inGroup}
	class:ring-[color-mix(in_srgb,var(--color-accent)_35%,transparent)]={inGroup}
	class:!rounded-b-none={groupRole === 'first' || groupRole === 'middle'}
	class:!rounded-t-none={groupRole === 'middle' || groupRole === 'last'}
	class:!border-b-0={groupRole === 'first' || groupRole === 'middle'}
>
	{#if groupRole === 'first'}
		<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
			<span
				class="rounded-md bg-[color-mix(in_srgb,var(--color-accent)_12%,white)] px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]"
			>
				{translate(lang, 'builder.supersetBadge')}
			</span>
			{#if ondissolve}
				<button type="button" class="btn-link text-xs" onclick={ondissolve}>
					{translate(lang, 'builder.dissolve')}
				</button>
			{/if}
		</div>
	{/if}

	<div class="mb-3 flex items-start gap-3">
		{#if ontoggleSelect}
			<label class="mt-1 flex shrink-0 items-center">
				<input
					type="checkbox"
					class="h-5 w-5 accent-[var(--color-accent)]"
					checked={selected}
					onchange={() => ontoggleSelect?.()}
					aria-label={translate(lang, 'builder.superset')}
				/>
			</label>
		{/if}
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
			<div
				class="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-[var(--color-surface-muted)]"
				aria-hidden="true"
			></div>
			<div class="min-w-0 flex-1 space-y-2" aria-busy="true">
				<div class="h-4 w-3/4 max-w-[14rem] animate-pulse rounded bg-[var(--color-surface-muted)]"></div>
				<div class="h-3 w-1/2 max-w-[8rem] animate-pulse rounded bg-[var(--color-surface-muted)]"></div>
				<span class="sr-only">{translate(lang, 'common.loading')}</span>
			</div>
		{/if}

		<div class="flex shrink-0 gap-1">
			<button
				type="button"
				class="btn-ghost"
				disabled={index === 0}
				onclick={() => onmove(index, index - 1)}
				aria-label={translate(lang, 'builder.up')}
				title={translate(lang, 'builder.up')}
			>
				<LucideIcon icon={ChevronUp} size={ICON_SMALL} />
			</button>
			<button
				type="button"
				class="btn-ghost"
				disabled={index >= total - 1}
				onclick={() => onmove(index, index + 1)}
				aria-label={translate(lang, 'builder.down')}
				title={translate(lang, 'builder.down')}
			>
				<LucideIcon icon={ChevronDown} size={ICON_SMALL} />
			</button>
			<button
				type="button"
				class="btn-ghost is-danger"
				onclick={onremove}
				aria-label={translate(lang, 'builder.remove')}
				title={translate(lang, 'builder.remove')}
			>
				<LucideIcon icon={Trash2} size={ICON_SMALL} />
			</button>
		</div>
	</div>

	<div class="workout-ex-fields">
		{#if showSets}
			<label class="field-label">
				{inGroup ? translate(lang, 'builder.rounds') : translate(lang, 'builder.sets')}
				<input
					class="field mt-1"
					type="text"
					inputmode="numeric"
					autocomplete="off"
					value={item.sets}
					onchange={(e) => {
						const sets = coerceSets((e.currentTarget as HTMLInputElement).value);
						if (inGroup && ongroupSets) ongroupSets(sets);
						else onupdate({ sets });
					}}
				/>
			</label>
		{/if}
		<label class="field-label">
			{translate(lang, 'builder.reps')}
			<input
				class="field mt-1"
				type="text"
				inputmode="numeric"
				autocomplete="off"
				value={item.reps}
				onchange={(e) =>
					onupdate({
						reps: coerceReps((e.currentTarget as HTMLInputElement).value, REPS) ?? REPS.min
					})}
			/>
		</label>
		{#if showRest}
			<label class="field-label">
				{inGroup ? translate(lang, 'builder.roundRest') : translate(lang, 'builder.rest')}
				<input
					class="field mt-1"
					type="text"
					inputmode="numeric"
					autocomplete="off"
					value={item.restSec}
					onchange={(e) => {
						const restSec = coerceRestSec((e.currentTarget as HTMLInputElement).value);
						if (inGroup && ongroupRest) ongroupRest(restSec);
						else onupdate({ restSec });
					}}
				/>
			</label>
		{/if}
	</div>
</article>
