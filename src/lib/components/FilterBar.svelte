<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import type { ExerciseFilters } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { X } from '@lucide/svelte';

	let {
		filters = $bindable(),
		equipment,
		targets,
		lockBodyPart = false
	}: {
		filters: ExerciseFilters;
		/** Cascaded: options compatible with current body/target/query. */
		equipment: string[];
		/** Cascaded: options compatible with current body/equipment/query. */
		targets: string[];
		/** Zone route: body part comes from URL, not a list facet control. */
		lockBodyPart?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let equipmentSheetOpen = $state(false);

	let showTargetFilters = $derived(lockBodyPart && targets.length > 1);

	let activeFilterCount = $derived(
		(lockBodyPart || filters.bodyPart === 'all' ? 0 : 1) +
			(filters.equipment !== 'all' ? 1 : 0) +
			(showTargetFilters && filters.target !== 'all' ? 1 : 0)
	);

	let showReset = $derived(activeFilterCount > 0 || filters.query.trim().length > 0);

	let equipmentTriggerLabel = $derived(
		filters.equipment === 'all'
			? translate(lang, 'catalog.equipment')
			: labelEquipment(filters.equipment, lang)
	);

	function resetFilters() {
		filters = {
			query: '',
			bodyPart: lockBodyPart ? filters.bodyPart : 'all',
			equipment: 'all',
			target: 'all'
		};
	}

	function toggleTarget(value: string) {
		filters = {
			...filters,
			target: filters.target === value ? 'all' : value
		};
	}

	function selectEquipment(value: string) {
		filters = {
			...filters,
			equipment: value
		};
		equipmentSheetOpen = false;
	}
</script>

<div class="catalog-filters-shell">
	<div class="catalog-filters panel" class:catalog-filters--zone={lockBodyPart}>
		<div class="catalog-filters-search-row">
			<SearchInput
				bind:value={filters.query}
				debounceMs={150}
				placeholder={translate(lang, 'catalog.search')}
			/>
			{#if showReset}
				<button
					type="button"
					class="catalog-filters-reset"
					onclick={resetFilters}
					aria-label={translate(lang, 'catalog.reset')}
					title={translate(lang, 'catalog.reset')}
				>
					<LucideIcon icon={X} size={ICON_BUTTON} />
				</button>
			{/if}
		</div>

		{#if showTargetFilters}
			<div
				class="catalog-filter-chips"
				role="group"
				aria-label={translate(lang, 'catalog.filterChipsAria')}
			>
				{#each targets as item (item)}
					<button
						type="button"
						class="catalog-filter-chip"
						class:is-active={filters.target === item}
						aria-pressed={filters.target === item}
						onclick={() => toggleTarget(item)}
					>
						{labelTarget(item, lang)}
					</button>
				{/each}
			</div>
		{/if}

		{#if equipment.length > 0}
			<button
				type="button"
				class="catalog-filter-equipment-trigger"
				class:is-active={filters.equipment !== 'all'}
				aria-haspopup="dialog"
				aria-expanded={equipmentSheetOpen}
				onclick={() => {
					equipmentSheetOpen = true;
				}}
			>
				{equipmentTriggerLabel}
			</button>
		{/if}
	</div>
</div>

{#if equipmentSheetOpen}
	<BottomSheet
		open={equipmentSheetOpen}
		titleId="catalog-equipment-sheet-title"
		onDismiss={() => {
			equipmentSheetOpen = false;
		}}
	>
		<p id="catalog-equipment-sheet-title" class="bottom-sheet__title">
			{translate(lang, 'catalog.equipment')}
		</p>
		<div
			class="catalog-equipment-sheet-options"
			role="group"
			aria-labelledby="catalog-equipment-sheet-title"
		>
			<button
				type="button"
				class="catalog-equipment-sheet-option"
				class:is-active={filters.equipment === 'all'}
				aria-pressed={filters.equipment === 'all'}
				onclick={() => selectEquipment('all')}
			>
				{translate(lang, 'catalog.equipmentAny')}
			</button>
			{#each equipment as item (item)}
				<button
					type="button"
					class="catalog-equipment-sheet-option"
					class:is-active={filters.equipment === item}
					aria-pressed={filters.equipment === item}
					onclick={() => selectEquipment(item)}
				>
					{labelEquipment(item, lang)}
				</button>
			{/each}
		</div>
	</BottomSheet>
{/if}
