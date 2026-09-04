<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppCheckbox from '$lib/components/AppCheckbox.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import ExerciseReorderHandle from '$lib/components/ExerciseReorderHandle.svelte';
	import ExerciseTechniqueSheet from '$lib/components/ExerciseTechniqueSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import type { WorkoutExercise } from '$lib/domain/types';
	import {
		coerceReps,
		coerceRestSec,
		coerceSets,
		filterRestSecInput,
		filterRepsInput,
		filterSetsInput,
		REPS,
		REPS_INPUT_MAX_LEN,
		REST_INPUT_MAX_LEN,
		SETS_INPUT_MAX_LEN
	} from '$lib/domain/inputLimits';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
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
		onConvertToSuperset,
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
		onConvertToSuperset?: () => void;
		ongroupSets?: (sets: number) => void;
		ongroupRest?: (restSec: number) => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let techniqueOpen = $state(false);
	/** Local chip text while focused — empty allowed until blur (coerce runs on commit). */
	let setsDraft = $state<string | null>(null);
	let repsDraft = $state<string | null>(null);
	let restDraft = $state<string | null>(null);
	let inGroup = $derived(Boolean(item.groupId));
	let inOrGroup = $derived(Boolean(item.altGroupId));
	const chipInputClass =
		'workout-ex-chip__input !w-auto !min-w-0 shrink-0 text-center text-base tabular-nums';
	const chipInputRestClass =
		'workout-ex-chip__input workout-ex-chip__input--rest !w-auto !min-w-0 shrink-0 text-center text-base tabular-nums';

	type ChipDraft = { draft: string | null; stored: () => number };

	function chipValue({ draft, stored }: ChipDraft): string {
		return draft ?? String(stored());
	}

	function onChipFocus(
		el: HTMLInputElement,
		setDraft: (v: string) => void,
		stored: () => number
	) {
		setDraft(String(stored()));
		queueMicrotask(() => {
			el.select();
		});
	}

	function onChipKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const el = e.currentTarget as HTMLInputElement;
		const root = el.closest('.workout-ex-fields, .superset-bar__fields, .workout-ex-head__copy');
		if (!root) {
			el.blur();
			return;
		}
		const inputs = [...root.querySelectorAll<HTMLInputElement>('input[data-slot="input"]')];
		const idx = inputs.indexOf(el);
		const next = idx >= 0 ? inputs[idx + 1] : undefined;
		if (next) next.focus();
		else el.blur();
	}

	function onChipInput(
		el: HTMLInputElement,
		{ draft, stored }: ChipDraft,
		setDraft: (v: string) => void,
		filter: (raw: string, prev: string) => string
	) {
		const prev = draft ?? String(stored());
		const shaped = filter(el.value, prev);
		setDraft(shaped);
		if (el.value !== shaped) el.value = shaped;
	}

	function onChipBlur(
		el: HTMLInputElement,
		{ draft, stored }: ChipDraft,
		setDraft: (v: string | null) => void,
		filter: (raw: string, prev: string) => string,
		coerce: (raw: string) => number,
		apply: (value: number) => void
	) {
		const prev = draft ?? String(stored());
		const shaped = filter(el.value, prev);
		const next = coerce(shaped);
		setDraft(null);
		apply(next);
		el.value = String(next);
	}

	const setsChip = (): ChipDraft => ({ draft: setsDraft, stored: () => item.sets });
	const repsChip = (): ChipDraft => ({ draft: repsDraft, stored: () => item.reps });
	const restChip = (): ChipDraft => ({ draft: restDraft, stored: () => item.restSec });
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
				<label class="workout-ex-chip">
					<span>{translate(lang, 'builder.rounds')}</span>
					<AppInput
						class={chipInputClass}
						type="text"
						inputmode="numeric"
						autocomplete="off"
						enterkeyhint="next"
						maxlength={SETS_INPUT_MAX_LEN}
						value={chipValue(setsChip())}
						onfocus={(e) => onChipFocus(e.currentTarget, (v) => (setsDraft = v), () => item.sets)}
						oninput={(e) => {
							const el = e.currentTarget as HTMLInputElement;
							onChipInput(el, setsChip(), (v) => (setsDraft = v), filterSetsInput);
						}}
						onkeydown={onChipKeydown}
						onblur={(e) => {
							const el = e.currentTarget as HTMLInputElement;
							if (ongroupSets) {
								onChipBlur(el, setsChip(), (v) => (setsDraft = v), filterSetsInput, coerceSets, ongroupSets);
							} else {
								onChipBlur(el, setsChip(), (v) => (setsDraft = v), filterSetsInput, coerceSets, (sets) =>
									onupdate({ sets }));
							}
						}}
					/>
				</label>
				<label class="workout-ex-chip workout-ex-chip--rest">
					<span>{translate(lang, 'builder.rest')}</span>
					<AppInput
						class={chipInputRestClass}
						type="text"
						inputmode="numeric"
						autocomplete="off"
						enterkeyhint="done"
						maxlength={REST_INPUT_MAX_LEN}
						value={chipValue(restChip())}
						onfocus={(e) => onChipFocus(e.currentTarget, (v) => (restDraft = v), () => item.restSec)}
						oninput={(e) => {
							const el = e.currentTarget as HTMLInputElement;
							onChipInput(el, restChip(), (v) => (restDraft = v), filterRestSecInput);
						}}
						onkeydown={onChipKeydown}
						onblur={(e) => {
							const el = e.currentTarget as HTMLInputElement;
							if (ongroupRest) {
								onChipBlur(el, restChip(), (v) => (restDraft = v), filterRestSecInput, coerceRestSec, ongroupRest);
							} else {
								onChipBlur(el, restChip(), (v) => (restDraft = v), filterRestSecInput, coerceRestSec, (restSec) =>
									onupdate({ restSec }));
							}
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
				<div class="or-bar__actions">
					{#if onConvertToSuperset}
						<AppButton
							variant="ghost"
							class="or-bar__convert"
							onclick={onConvertToSuperset}
							aria-label={translate(
								lang,
								inGroup ? 'builder.altDoAll' : 'builder.convertToSuperset'
							)}
							title={translate(lang, inGroup ? 'builder.altDoAll' : 'builder.convertToSuperset')}
						>
							{translate(lang, inGroup ? 'builder.altDoAll' : 'builder.convertToSuperset')}
						</AppButton>
					{/if}
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
		</div>
	{/if}

	{#if altRole === 'middle' || altRole === 'last'}
		<p class="or-divider" aria-hidden="true">{translate(lang, 'builder.orDivider')}</p>
	{/if}

	<div class="workout-ex-head" class:workout-ex-head--group={inGroup}>
		{#if ontoggleSelect}
			<label class="workout-ex-head__check">
				<AppCheckbox
					class="workout-ex-head__checkbox size-6"
					checked={selected}
					onCheckedChange={() => ontoggleSelect?.()}
					aria-label={translate(lang, 'builder.selectExercise')}
				/>
			</label>
		{/if}
		{#if meta}
			{@const title = exerciseName(meta, lang)}
			{@const detailHref = linkWithFrom(
				`/exercise/${item.exerciseId}`,
				currentReturnPath($page.url.pathname, $page.url.searchParams)
			)}
			<AppButton
				variant="ghost"
				class="workout-ex-head__media-btn media-well workout-ex-head__media !h-auto !min-h-[48px] !min-w-[48px] !p-0"
				aria-label={translate(lang, 'exercise.openTechnique', { name: title })}
				onclick={() => {
					techniqueOpen = true;
				}}
			>
				<img src={`/${meta.image}`} alt="" width="120" height="120" />
			</AppButton>
			<div class="workout-ex-head__copy">
				<a class="workout-ex-head__title" href={detailHref}>
					{title}
				</a>
				{#if inGroup}
					<label class="workout-ex-chip workout-ex-chip--reps">
						<span>{translate(lang, 'builder.reps')}</span>
						<AppInput
							class={chipInputClass}
							type="text"
							inputmode="numeric"
							autocomplete="off"
							enterkeyhint="done"
							maxlength={REPS_INPUT_MAX_LEN}
							value={chipValue(repsChip())}
							onfocus={(e) => onChipFocus(e.currentTarget, (v) => (repsDraft = v), () => item.reps)}
							oninput={(e) =>
								onChipInput(e.currentTarget as HTMLInputElement, repsChip(), (v) => (repsDraft = v), (raw, prev) =>
									filterRepsInput(raw, REPS, prev))}
							onkeydown={onChipKeydown}
							onblur={(e) =>
								onChipBlur(
									e.currentTarget as HTMLInputElement,
									repsChip(),
									(v) => (repsDraft = v),
									(raw, prev) => filterRepsInput(raw, REPS, prev),
									(raw) => coerceReps(raw, REPS) ?? REPS.min,
									(reps) => onupdate({ reps })
								)}
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
								enterkeyhint="next"
								maxlength={SETS_INPUT_MAX_LEN}
								value={chipValue(setsChip())}
								onfocus={(e) => onChipFocus(e.currentTarget, (v) => (setsDraft = v), () => item.sets)}
								oninput={(e) =>
									onChipInput(e.currentTarget as HTMLInputElement, setsChip(), (v) => (setsDraft = v), filterSetsInput)}
								onkeydown={onChipKeydown}
								onblur={(e) =>
									onChipBlur(
										e.currentTarget as HTMLInputElement,
										setsChip(),
										(v) => (setsDraft = v),
										filterSetsInput,
										coerceSets,
										(sets) => onupdate({ sets })
									)}
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
								enterkeyhint="next"
								maxlength={REPS_INPUT_MAX_LEN}
								value={chipValue(repsChip())}
								onfocus={(e) => onChipFocus(e.currentTarget, (v) => (repsDraft = v), () => item.reps)}
								oninput={(e) =>
									onChipInput(e.currentTarget as HTMLInputElement, repsChip(), (v) => (repsDraft = v), (raw, prev) =>
										filterRepsInput(raw, REPS, prev))}
								onkeydown={onChipKeydown}
								onblur={(e) =>
									onChipBlur(
										e.currentTarget as HTMLInputElement,
										repsChip(),
										(v) => (repsDraft = v),
										(raw, prev) => filterRepsInput(raw, REPS, prev),
										(raw) => coerceReps(raw, REPS) ?? REPS.min,
										(reps) => onupdate({ reps })
									)}
							/>
						</label>
						<label class="workout-ex-chip workout-ex-chip--rest">
							<span>{translate(lang, 'builder.rest')}</span>
							<AppInput
								class={chipInputRestClass}
								type="text"
								inputmode="numeric"
								autocomplete="off"
								enterkeyhint="done"
								maxlength={REST_INPUT_MAX_LEN}
								value={chipValue(restChip())}
								onfocus={(e) => onChipFocus(e.currentTarget, (v) => (restDraft = v), () => item.restSec)}
								oninput={(e) =>
									onChipInput(e.currentTarget as HTMLInputElement, restChip(), (v) => (restDraft = v), filterRestSecInput)}
								onkeydown={onChipKeydown}
								onblur={(e) =>
									onChipBlur(
										e.currentTarget as HTMLInputElement,
										restChip(),
										(v) => (restDraft = v),
										filterRestSecInput,
										coerceRestSec,
										(restSec) => onupdate({ restSec })
									)}
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
			<AppButton
				variant="ghost"
				class="is-danger workout-ex-head__delete"
				onclick={onremove}
				aria-label={translate(lang, 'builder.remove')}
				title={translate(lang, 'builder.remove')}
			>
				<LucideIcon icon={Trash2} size={ICON_SMALL} />
			</AppButton>
			<ExerciseReorderHandle
				{index}
				holdMs={0}
				label={translate(lang, 'builder.reorder')}
				onreorder={onreorder}
			/>
		</div>
	</div>
</article>

{#if meta && techniqueOpen}
	<ExerciseTechniqueSheet
		open={techniqueOpen}
		titleId={`builder-technique-${item.exerciseId}`}
		title={exerciseName(meta, lang)}
		hint={`${labelTarget(meta.target, lang)} · ${labelEquipment(meta.equipment, lang)}`}
		imagePath={meta.image}
		detailHref={linkWithFrom(
			`/exercise/${item.exerciseId}`,
			currentReturnPath($page.url.pathname, $page.url.searchParams)
		)}
		onDismiss={() => {
			techniqueOpen = false;
		}}
	/>
{/if}
