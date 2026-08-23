<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppCheckbox from '$lib/components/AppCheckbox.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import ExerciseReorderHandle from '$lib/components/ExerciseReorderHandle.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import type { WorkoutExercise } from '$lib/domain/types';
	import { coerceReps, coerceRestSec, coerceSets, REPS } from '$lib/domain/inputLimits';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { linkWithFrom, currentReturnPath } from '$lib/domain/navigation';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { page } from '$app/stores';
	import { Trash2, Unlink } from '@lucide/svelte';

	let {
		item,
		meta,
		index,
		selected = false,
		groupRole = 'solo',
		altRole = 'solo',
		onupdate,
		onreorder,
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
		selected?: boolean;
		groupRole?: 'solo' | 'first' | 'middle' | 'last';
		altRole?: 'solo' | 'first' | 'middle' | 'last';
		onupdate: (patch: Partial<Omit<WorkoutExercise, 'exerciseId' | 'groupId' | 'altGroupId'>>) => void;
		onreorder: (from: number, to: number) => void;
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
	const chipInputClass =
		'workout-ex-chip__input !h-[2.15rem] !min-h-0 w-[2.85rem] min-w-[2.85rem] max-w-[2.85rem] sm:w-[3.5rem] sm:min-w-[3.5rem] sm:max-w-[3.5rem] shrink-0 px-1.5 text-center text-base tabular-nums';
	const chipInputRestClass =
		'workout-ex-chip__input workout-ex-chip__input--rest !h-[2.15rem] !min-h-0 w-[3.5rem] min-w-[3.5rem] max-w-[3.5rem] sm:w-[4rem] sm:min-w-[4rem] sm:max-w-[4rem] shrink-0 px-1.5 text-center text-base tabular-nums';
	const supersetInputClass =
		'workout-ex-chip__input !h-[1.9rem] !min-h-0 w-[2.85rem] min-w-[2.85rem] max-w-[2.85rem] shrink-0 px-1.5 text-center text-base tabular-nums';
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
					<AppButton
						variant="ghost"
						class="superset-bar__dissolve"
						onclick={ondissolve}
						aria-label={translate(lang, 'builder.dissolve')}
						title={translate(lang, 'builder.dissolve')}
					>
						<LucideIcon icon={Unlink} size={ICON_SMALL} />
					</AppButton>
				{/if}
			</div>
			<div class="superset-bar__fields">
				<label class="superset-chip">
					<span>{translate(lang, 'builder.rounds')}</span>
					<AppInput
						class={supersetInputClass}
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
					<AppInput
						class={supersetInputClass}
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
					<AppButton
						variant="ghost"
						class="or-bar__dissolve"
						onclick={ondissolveOr}
						aria-label={translate(lang, 'builder.dissolve')}
						title={translate(lang, 'builder.dissolve')}
					>
						<LucideIcon icon={Unlink} size={ICON_SMALL} />
					</AppButton>
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
				<AppCheckbox
					class="h-5 w-5"
					checked={selected}
					onCheckedChange={() => ontoggleSelect?.()}
					aria-label={translate(lang, 'builder.selectExercise')}
				/>
			</label>
		{/if}
		{#if meta}
			<span class="media-well workout-ex-head__media">
				<img src={`/${meta.image}`} alt="" width="120" height="120" />
			</span>
			<div class="workout-ex-head__copy">
				<a
					class="workout-ex-head__title"
					href={linkWithFrom(
						`/exercise/${item.exerciseId}`,
						currentReturnPath($page.url.pathname, $page.url.searchParams)
					)}
				>
					{exerciseName(meta, lang)}
				</a>
				{#if inGroup}
					<label class="workout-ex-chip">
						<span>{translate(lang, 'builder.reps')}</span>
						<AppInput
							class={chipInputClass}
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
							<AppInput
								class={chipInputClass}
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
							<AppInput
								class={chipInputClass}
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
							<AppInput
								class={chipInputRestClass}
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
			<ExerciseReorderHandle
				{index}
				label={translate(lang, 'builder.reorder')}
				onreorder={onreorder}
			/>
			<AppButton
				variant="ghost"
				class="is-danger workout-ex-head__delete"
				onclick={onremove}
				aria-label={translate(lang, 'builder.remove')}
				title={translate(lang, 'builder.remove')}
			>
				<LucideIcon icon={Trash2} size={ICON_SMALL} />
			</AppButton>
		</div>
	</div>
</article>
