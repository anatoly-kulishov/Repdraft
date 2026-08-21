<script lang="ts">
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { labelBodyPart, labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import type { ExerciseFilters } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

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

	let lang = $derived($resolvedLocale);

	/** Active chip first so entering a subgroup doesn’t hide the selection off-screen. */
	function withActiveFirst(items: string[], active: string): string[] {
		if (active === 'all' || !items.includes(active)) return items;
		return [active, ...items.filter((item) => item !== active)];
	}

	let targetChips = $derived(withActiveFirst(targets, filters.target));
	let equipmentChips = $derived(withActiveFirst(equipment, filters.equipment));
	let targetRowEl: HTMLDivElement | undefined = $state();
	let equipmentRowEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		filters.target;
		filters.equipment;
		queueMicrotask(() => {
			if (targetRowEl) targetRowEl.scrollLeft = 0;
			if (equipmentRowEl) equipmentRowEl.scrollLeft = 0;
		});
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

	function toggleTarget(value: string) {
		filters = {
			...filters,
			target: filters.target === value ? 'all' : value
		};
	}

	function toggleEquipment(value: string) {
		filters = {
			...filters,
			equipment: filters.equipment === value ? 'all' : value
		};
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
			{#if activeFilterCount > 0}
				<button
					type="button"
					class="btn-link catalog-filters-reset-desktop min-h-[48px] min-w-[48px]"
					onclick={resetFilters}
				>
					{translate(lang, 'catalog.reset')}
				</button>
			{/if}
		</div>

		{#if targets.length > 0 || equipment.length > 0}
			<div class="catalog-filter-chips" role="group" aria-label={translate(lang, 'catalog.filterChipsAria')}>
				{#if targetChips.length > 0}
					<div class="catalog-filter-chips__row" bind:this={targetRowEl}>
						{#each targetChips as item (item)}
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
				{#if equipmentChips.length > 0}
					<div class="catalog-filter-chips__row" bind:this={equipmentRowEl}>
						{#each equipmentChips as item (item)}
							<button
								type="button"
								class="catalog-filter-chip"
								class:is-active={filters.equipment === item}
								aria-pressed={filters.equipment === item}
								onclick={() => toggleEquipment(item)}
							>
								{labelEquipment(item, lang)}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		{#if !lockBodyPart}
			<label class="field-label catalog-filters-body">
				{translate(lang, 'catalog.bodyPart')}
				<select class="field mt-1 w-full min-h-[48px]" bind:value={filters.bodyPart}>
					<option value="all">{translate(lang, 'catalog.all')}</option>
					{#each bodyParts as part (part)}
						<option value={part}>{labelBodyPart(part, lang)}</option>
					{/each}
				</select>
			</label>
		{/if}

		{#if activeFilterCount > 0}
			<button
				type="button"
				class="btn-secondary catalog-filters-clear-mobile min-h-[48px] min-w-[48px]"
				onclick={resetFilters}
			>
				{translate(lang, 'catalog.reset')}
			</button>
		{/if}
	</div>
</div>
