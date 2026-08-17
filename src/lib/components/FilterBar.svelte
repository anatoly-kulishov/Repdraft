<script lang="ts">
	import SearchInput from '$lib/components/SearchInput.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { labelBodyPart, labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import type { ExerciseFilters } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ChevronDown, SlidersHorizontal } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let {
		filters = $bindable(),
		bodyParts,
		equipment,
		targets,
		lockBodyPart = false
	}: {
		filters: ExerciseFilters;
		bodyParts: string[];
		/** Cascaded: options compatible with current body/target/query. */
		equipment: string[];
		/** Cascaded: options compatible with current body/equipment/query. */
		targets: string[];
		/** Zone route: body part comes from URL, not the facet control. */
		lockBodyPart?: boolean;
	} = $props();

	let filtersOpen = $state(false);
	let lang = $derived($resolvedLocale);

	onMount(() => {
		if (
			filters.equipment !== 'all' ||
			filters.target !== 'all' ||
			(!lockBodyPart && filters.bodyPart !== 'all')
		) {
			filtersOpen = true;
		}
	});

	let activeFilterCount = $derived(
		(lockBodyPart || filters.bodyPart === 'all' ? 0 : 1) +
			(filters.equipment !== 'all' ? 1 : 0) +
			(filters.target !== 'all' ? 1 : 0)
	);

	function resetFilters() {
		filters = {
			query: '',
			bodyPart: lockBodyPart ? filters.bodyPart : 'all',
			equipment: 'all',
			target: 'all'
		};
	}
</script>

<div class="catalog-filters-shell">
	<div class="catalog-filters panel" class:catalog-filters--zone={lockBodyPart}>
		<div class="catalog-filters-search-row">
			<SearchInput bind:value={filters.query} debounceMs={320} placeholder={translate(lang, 'catalog.search')} />
			{#if activeFilterCount > 0}
				<button
					type="button"
					class="btn-link catalog-filters-reset-desktop"
					onclick={resetFilters}
				>
					{translate(lang, 'catalog.reset')}
				</button>
			{/if}
		</div>

		<div class="catalog-filters-toolbar">
			<button
				type="button"
				class="btn-secondary catalog-filters-toggle"
				onclick={() => (filtersOpen = !filtersOpen)}
				aria-expanded={filtersOpen}
				aria-controls="catalog-filters"
			>
				<LucideIcon icon={SlidersHorizontal} size={ICON_BUTTON} />
				{translate(lang, 'catalog.filters')}
				{#if activeFilterCount > 0}
					<span class="catalog-filters-toggle__count" aria-hidden="true">{activeFilterCount}</span>
				{/if}
				<span class="catalog-filters-toggle__chevron" aria-hidden="true">
					<LucideIcon
						icon={ChevronDown}
						size={ICON_BUTTON}
						class={filtersOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
					/>
				</span>
			</button>
			{#if activeFilterCount > 0}
				<button type="button" class="btn-secondary catalog-filters-clear" onclick={resetFilters}>
					{translate(lang, 'catalog.reset')}
				</button>
			{/if}
		</div>

		<div
			id="catalog-filters"
			class="catalog-filters-grid"
			class:is-open={filtersOpen}
			class:catalog-filters-grid--zone={lockBodyPart}
		>
			{#if !lockBodyPart}
				<label class="field-label">
					{translate(lang, 'catalog.bodyPart')}
					<select class="field mt-1 w-full" bind:value={filters.bodyPart}>
						<option value="all">{translate(lang, 'catalog.all')}</option>
						{#each bodyParts as part (part)}
							<option value={part}>{labelBodyPart(part, lang)}</option>
						{/each}
					</select>
				</label>
			{/if}
			<label class="field-label">
				{translate(lang, 'catalog.equipment')}
				<select class="field mt-1 w-full" bind:value={filters.equipment}>
					<option value="all">{translate(lang, 'catalog.all')}</option>
					{#if filters.equipment !== 'all' && !equipment.includes(filters.equipment)}
						<option value={filters.equipment}>{labelEquipment(filters.equipment, lang)}</option>
					{/if}
					{#each equipment as item (item)}
						<option value={item}>{labelEquipment(item, lang)}</option>
					{/each}
				</select>
			</label>
			<label class="field-label">
				{translate(lang, 'catalog.muscle')}
				<select class="field mt-1 w-full" bind:value={filters.target}>
					<option value="all">{translate(lang, 'catalog.all')}</option>
					{#if filters.target !== 'all' && !targets.includes(filters.target)}
						<option value={filters.target}>{labelTarget(filters.target, lang)}</option>
					{/if}
					{#each targets as item (item)}
						<option value={item}>{labelTarget(item, lang)}</option>
					{/each}
				</select>
			</label>
		</div>
	</div>
</div>
