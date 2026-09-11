<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppChip from '$lib/components/AppChip.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import ListSearchBar from '$lib/components/ListSearchBar.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import type { ExerciseFilters } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { cn } from '$lib/utils.js';
	import { Check } from '@lucide/svelte';

	let {
		filters = $bindable(),
		equipment,
		targets,
		lockBodyPart = false,
		/** Deep-link target list (e.g. /catalog/back?target=traps): no sibling muscle chips. */
		hideTargetChips = false
	}: {
		filters: ExerciseFilters;
		/** Cascaded: options compatible with current body/target/query. */
		equipment: string[];
		/** Cascaded: options compatible with current body/equipment/query. */
		targets: string[];
		/** Zone route: body part comes from URL, not a list facet control. */
		lockBodyPart?: boolean;
		hideTargetChips?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let equipmentSheetOpen = $state(false);

	let showTargetFilters = $derived(lockBodyPart && !hideTargetChips && targets.length > 1);

	let showEquipmentFilter = $derived(equipment.length > 0);
	let equipmentActive = $derived(filters.equipment !== 'all');

	let equipmentAriaLabel = $derived(
		equipmentActive
			? `${translate(lang, 'catalog.equipment')}: ${labelEquipment(filters.equipment, lang)}`
			: translate(lang, 'catalog.equipment')
	);

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

	function clearEquipmentAndClose() {
		filters = { ...filters, equipment: 'all' };
		equipmentSheetOpen = false;
	}
</script>

{#snippet equipmentOption(value: string, label: string, active: boolean)}
	<AppChip
		class="catalog-equipment-sheet-option !h-auto !min-h-12 !w-full !rounded-[var(--radius-control)] !px-[0.85rem] !py-[0.55rem]"
		{active}
		role="radio"
		aria-checked={active}
		onclick={() => selectEquipment(value)}
	>
		<span class="catalog-equipment-sheet-option__label">{label}</span>
		{#if active}
			<span class="catalog-equipment-sheet-option__check" aria-hidden="true">
				<LucideIcon icon={Check} size={ICON_SMALL} />
			</span>
		{/if}
	</AppChip>
{/snippet}

{#snippet equipmentActions()}
	<AppButton variant="danger" onclick={clearEquipmentAndClose}>
		{translate(lang, 'workouts.historyClearFiltersAria')}
	</AppButton>
{/snippet}

<div class="catalog-filters-shell">
	<div class={cn('catalog-filters', lockBodyPart && 'catalog-filters--zone')}>
		<ListSearchBar
			bind:value={filters.query}
			debounceMs={150}
			placeholder={translate(lang, 'catalog.search')}
			filterActive={equipmentActive}
			filterAriaLabel={equipmentAriaLabel}
			filterExpanded={equipmentSheetOpen}
			onFilterClick={showEquipmentFilter
				? () => {
						equipmentSheetOpen = true;
					}
				: undefined}
		>
			{#if showTargetFilters}
				<div
					class="catalog-filter-chips"
					role="group"
					aria-label={translate(lang, 'catalog.filterChipsAria')}
				>
					{#each targets as item (item)}
						<AppChip
							class="catalog-filter-chip w-auto min-w-0 rounded-full px-3"
							active={filters.target === item}
							onclick={() => toggleTarget(item)}
						>
							{labelTarget(item, lang)}
						</AppChip>
					{/each}
				</div>
			{/if}
		</ListSearchBar>
	</div>
</div>

{#if equipmentSheetOpen}
	<BottomSheet
		open={equipmentSheetOpen}
		raised
		titleId="catalog-equipment-sheet-title"
		onDismiss={() => {
			equipmentSheetOpen = false;
		}}
		actions={equipmentActive ? equipmentActions : null}
	>
		<div class="bottom-sheet__head">
			<p id="catalog-equipment-sheet-title" class="bottom-sheet__title">
				{translate(lang, 'catalog.equipment')}
			</p>
		</div>
		<div
			class="catalog-equipment-sheet-options"
			role="radiogroup"
			aria-labelledby="catalog-equipment-sheet-title"
		>
			{@render equipmentOption('all', translate(lang, 'catalog.equipmentAny'), filters.equipment === 'all')}
			{#each equipment as item (item)}
				{@render equipmentOption(item, labelEquipment(item, lang), filters.equipment === item)}
			{/each}
		</div>
	</BottomSheet>
{/if}
