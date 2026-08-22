<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import type { WorkoutExercise } from '$lib/domain/types';
	import { coerceReps, coerceRestSec, coerceSets, REPS } from '$lib/domain/inputLimits';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ChevronDown, ChevronUp, Trash2, Unlink } from '@lucide/svelte';

	let {
		item,
		meta,
		index,
		total,
		selected = false,
		groupRole = 'solo',
		altRole = 'solo',
		onupdate,
		onmove,
		onremove,
		ontoggleSelect,
		ondissolve,
		ondissolveOr,
		ongroupSets,
		ongroupRest
	}: {
		item: WorkoutExercise;
		meta: ExerciseIndexItem | null;
		index: number;
		total: number;
		selected?: boolean;
		groupRole?: 'solo' | 'first' | 'middle' | 'last';
		altRole?: 'solo' | 'first' | 'middle' | 'last';
		onupdate: (patch: Partial<Omit<WorkoutExercise, 'exerciseId' | 'groupId' | 'altGroupId'>>) => void;
		onmove: (from: number, to: number) => void;
		onremove: () => void;
		ontoggleSelect?: () => void;
		ondissolve?: () => void;
		ondissolveOr?: () => void;
		ongroupSets?: (sets: number) => void;
		ongroupRest?: (restSec: number) => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let inGroup = $derived(Boolean(item.groupId));
	let inOrGroup = $derived(Boolean(item.altGroupId));
</script>

<article
	class="workout-ex-row"
	class:workout-ex-row--grouped={inGroup}
	class:workout-ex-row--or={inOrGroup}
	class:workout-ex-row--first={groupRole === 'first' || altRole === 'first'}
	class:workout-ex-row--middle={groupRole === 'middle' || altRole === 'middle'}
	class:workout-ex-row--last={groupRole === 'last' || altRole === 'last'}
>
	{#if groupRole === 'first'}
		<div class="superset-bar">
			<div class="superset-bar__head">
				<span class="superset-bar__badge">{translate(lang, 'builder.supersetBadge')}</span>
				{#if ondissolve}
					<button
						type="button"
						class="btn-ghost superset-bar__dissolve"
						onclick={ondissolve}
						aria-label={translate(lang, 'builder.dissolve')}
						title={translate(lang, 'builder.dissolve')}
					>
						<LucideIcon icon={Unlink} size={ICON_SMALL} />
					</button>
				{/if}
			</div>
			<div class="superset-bar__fields">
				<label class="superset-chip">
					<span>{translate(lang, 'builder.rounds')}</span>
					<input
						class="field"
						type="text"
						inputmode="numeric"
						autocomplete="off"
						value={item.sets}
						onchange={(e) => {
							const sets = coerceSets((e.currentTarget as HTMLInputElement).value);
							if (ongroupSets) ongroupSets(sets);
							else onupdate({ sets });
						}}
					/>
				</label>
				<label class="superset-chip">
					<span>{translate(lang, 'builder.rest')}</span>
					<input
						class="field"
						type="text"
						inputmode="numeric"
						autocomplete="off"
						value={item.restSec}
						onchange={(e) => {
							const restSec = coerceRestSec((e.currentTarget as HTMLInputElement).value);
							if (ongroupRest) ongroupRest(restSec);
							else onupdate({ restSec });
						}}
					/>
				</label>
			</div>
		</div>
	{/if}

	{#if altRole === 'first'}
		<div class="or-bar">
			<div class="or-bar__head">
				<span class="or-bar__badge">{translate(lang, 'builder.orBadge')}</span>
				{#if ondissolveOr}
					<button
						type="button"
						class="btn-ghost or-bar__dissolve"
						onclick={ondissolveOr}
						aria-label={translate(lang, 'builder.dissolve')}
						title={translate(lang, 'builder.dissolve')}
					>
						<LucideIcon icon={Unlink} size={ICON_SMALL} />
					</button>
				{/if}
			</div>
		</div>
	{/if}

	{#if altRole === 'middle' || altRole === 'last'}
		<p class="or-divider" aria-hidden="true">{translate(lang, 'builder.orDivider')}</p>
	{/if}

	<div class="workout-ex-head" class:workout-ex-head--group={inGroup}>
		{#if ontoggleSelect}
			<label class="workout-ex-head__check">
				<input
					type="checkbox"
					class="h-5 w-5 accent-[var(--color-accent)]"
					checked={selected}
					onchange={() => ontoggleSelect?.()}
					aria-label={translate(lang, 'builder.selectExercise')}
				/>
			</label>
		{/if}
		{#if meta}
			<span class="media-well workout-ex-head__media">
				<img src={`/${meta.image}`} alt="" width="120" height="120" />
			</span>
			<div class="workout-ex-head__copy">
				<a class="workout-ex-head__title" href={`/exercise/${item.exerciseId}`}>
					{exerciseName(meta, lang)}
				</a>
				{#if inGroup}
					<label class="workout-ex-chip">
						<span>{translate(lang, 'builder.reps')}</span>
						<input
							class="field"
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
				{:else}
					<div class="workout-ex-fields">
						<label class="workout-ex-chip">
							<span>{translate(lang, 'builder.sets')}</span>
							<input
								class="field"
								type="text"
								inputmode="numeric"
								autocomplete="off"
								value={item.sets}
								onchange={(e) => onupdate({ sets: coerceSets((e.currentTarget as HTMLInputElement).value) })}
							/>
						</label>
						<span class="workout-ex-fields__times" aria-hidden="true">×</span>
						<label class="workout-ex-chip">
							<span>{translate(lang, 'builder.reps')}</span>
							<input
								class="field"
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
						<label class="workout-ex-chip workout-ex-chip--rest">
							<span>{translate(lang, 'builder.rest')}</span>
							<input
								class="field"
								type="text"
								inputmode="numeric"
								autocomplete="off"
								value={item.restSec}
								onchange={(e) =>
									onupdate({ restSec: coerceRestSec((e.currentTarget as HTMLInputElement).value) })}
							/>
						</label>
					</div>
				{/if}
			</div>
		{:else}
			<span class="media-well workout-ex-head__media is-placeholder animate-pulse" aria-hidden="true"></span>
			<div class="workout-ex-head__copy" aria-busy="true">
				<div class="h-4 w-3/4 max-w-[14rem] animate-pulse rounded bg-[var(--color-surface-muted)]"></div>
				<span class="sr-only">{translate(lang, 'common.loading')}</span>
			</div>
		{/if}

		<div class="workout-ex-head__actions">
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
</article>
