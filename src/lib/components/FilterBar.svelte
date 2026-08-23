<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppChip from '$lib/components/AppChip.svelte';
	import AppIconButton from '$lib/components/AppIconButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import type { ExerciseFilters } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { cn } from '$lib/utils.js';
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
	<AppPanel class={cn('catalog-filters', lockBodyPart && 'catalog-filters--zone')}>
		<div class="catalog-filters-search-row">
			<SearchInput
				bind:value={filters.query}
				debounceMs={150}
				showClear={false}
				placeholder={translate(lang, 'catalog.search')}
			/>
			{#if showReset}
				<AppIconButton
					class="catalog-filters-reset !min-h-0 !min-w-0 size-auto p-0"
					onclick={resetFilters}
					aria-label={translate(lang, 'catalog.reset')}
					title={translate(lang, 'catalog.reset')}
				>
					<LucideIcon icon={X} size={ICON_BUTTON} />
				</AppIconButton>
			{/if}
		</div>

		{#if showTargetFilters}
			<div
				class="catalog-filter-chips"
				role="group"
				aria-label={translate(lang, 'catalog.filterChipsAria')}
			>
				{#each targets as item (item)}
					<AppChip
						class="catalog-filter-chip !min-h-0 h-auto w-auto min-w-0 rounded-full px-3 py-1.5"
						active={filters.target === item}
						onclick={() => toggleTarget(item)}
					>
						{labelTarget(item, lang)}
					</AppChip>
				{/each}
			</div>
		{/if}

		{#if equipment.length > 0}
			<AppButton
				variant="secondary"
				class={cn(
					'catalog-filter-equipment-trigger !h-auto !min-h-12 w-full justify-start px-[0.9rem] py-[0.55rem] text-left font-[550]',
					filters.equipment !== 'all' && 'is-active'
				)}
				aria-haspopup="dialog"
				aria-expanded={equipmentSheetOpen}
				onclick={() => {
					equipmentSheetOpen = true;
				}}
			>
				{equipmentTriggerLabel}
			</AppButton>
		{/if}
	</AppPanel>
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
			<AppChip
				class="catalog-equipment-sheet-option !h-auto !min-h-12 w-full justify-start rounded-[var(--radius-control)] px-[0.9rem] py-[0.65rem] text-left font-medium"
				active={filters.equipment === 'all'}
				onclick={() => selectEquipment('all')}
			>
				{translate(lang, 'catalog.equipmentAny')}
			</AppChip>
			{#each equipment as item (item)}
				<AppChip
					class="catalog-equipment-sheet-option !h-auto !min-h-12 w-full justify-start rounded-[var(--radius-control)] px-[0.9rem] py-[0.65rem] text-left font-medium"
					active={filters.equipment === item}
					onclick={() => selectEquipment(item)}
				>
					{labelEquipment(item, lang)}
				</AppChip>
			{/each}
		</div>
	</BottomSheet>
{/if}
