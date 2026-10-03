<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { BODY_PART_LABELS } from '$lib/domain/labels.ru';
	import {
		CUSTOM_EXERCISE_EQUIPMENT,
		CUSTOM_EXERCISE_NAME_MAX,
		findDuplicateCustom,
		labelEquipmentSafe,
		type CustomExercise
	} from '$lib/domain/customExercises';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		open = $bindable(false),
		initialName = '',
		existing,
		onCreate,
		onDismiss
	}: {
		open?: boolean;
		initialName?: string;
		existing: CustomExercise[];
		onCreate: (name: string, bodyPart: string, equipment: string) => CustomExercise | null;
		onDismiss: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let name = $state('');
	let bodyPart = $state('chest');
	let equipment = $state('barbell');

	$effect(() => {
		if (open) name = initialName.slice(0, CUSTOM_EXERCISE_NAME_MAX);
	});

	const bodyPartOptions = $derived(Object.keys(BODY_PART_LABELS));
	const duplicate = $derived(findDuplicateCustom(existing, name));
	const canSave = $derived(name.trim().length >= 2 && !duplicate);

	function save() {
		if (!canSave) return;
		const made = onCreate(name, bodyPart, equipment);
		if (!made) return;
		open = false;
		onDismiss();
	}
</script>

{#if open}
	<BottomSheet {open} raised titleId="custom-exercise-sheet" {onDismiss}>
		<div class="bottom-sheet__head">
			<p id="custom-exercise-sheet" class="bottom-sheet__title">{translate(lang, 'custom.new')}</p>
			<p class="bottom-sheet__hint">{translate(lang, 'custom.hint')}</p>
		</div>
		<form
			class="custom-exercise-form"
			onsubmit={(e) => {
				e.preventDefault();
				save();
			}}
		>
			<label class="custom-exercise-form__field">
				<span class="custom-exercise-form__label">{translate(lang, 'custom.nameLabel')}</span>
				<AppInput
					bind:value={name}
					maxlength={CUSTOM_EXERCISE_NAME_MAX}
					autocomplete="off"
					placeholder={translate(lang, 'custom.namePh')}
				/>
				{#if duplicate}
					<span class="custom-exercise-form__error">{translate(lang, 'custom.duplicate')}</span>
				{/if}
			</label>
			<label class="custom-exercise-form__field">
				<span class="custom-exercise-form__label">{translate(lang, 'catalog.bodyPart')}</span>
				<AppSelect
					value={bodyPart}
					onchange={(e) => {
						bodyPart = e.currentTarget.value;
					}}
				>
					{#each bodyPartOptions as value (value)}
						<option value={value}>{BODY_PART_LABELS[value]}</option>
					{/each}
				</AppSelect>
			</label>
			<label class="custom-exercise-form__field">
				<span class="custom-exercise-form__label">{translate(lang, 'catalog.equipment')}</span>
				<AppSelect
					value={equipment}
					onchange={(e) => {
						equipment = e.currentTarget.value;
					}}
				>
					{#each CUSTOM_EXERCISE_EQUIPMENT as value (value)}
						<option value={value}>{labelEquipmentSafe(value)}</option>
					{/each}
				</AppSelect>
			</label>
			<AppButton type="submit" disabled={!canSave}>
				{translate(lang, 'custom.create')}
			</AppButton>
		</form>
	</BottomSheet>
{/if}

<style>
	.custom-exercise-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 4px 16px 20px;
	}
	.custom-exercise-form__field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.custom-exercise-form__label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-muted);
	}
	.custom-exercise-form__error {
		font-size: 12px;
		color: var(--color-danger, #ef4444);
	}
</style>
