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
		targets
	}: {
		filters: ExerciseFilters;
		bodyParts: string[];
		equipment: string[];
		targets: string[];
	} = $props();

	let filtersOpen = $state(false);
	let lang = $derived($resolvedLocale);

	let activeFilterCount = $derived(
		(filters.bodyPart !== 'all' ? 1 : 0) +
			(filters.equipment !== 'all' ? 1 : 0) +
			(filters.target !== 'all' ? 1 : 0)
	);

	function resetFilters() {
		filters = {
			...filters,
			bodyPart: 'all',
			equipment: 'all',
			target: 'all'
		};
	}
</script>

<div
	class="sticky top-14 z-20 -mx-4 mb-4 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_94%,white)] px-4 py-3 backdrop-blur md:top-16 md:-mx-6 md:px-6"
>
	<div class="mx-auto flex max-w-6xl flex-col gap-2.5">
		<SearchInput bind:value={filters.query} placeholder={translate(lang, 'catalog.search')} />

		<div class="flex items-center gap-2 md:hidden">
			<button
				type="button"
				class="btn-secondary flex-1"
				onclick={() => (filtersOpen = !filtersOpen)}
				aria-expanded={filtersOpen}
			>
				{translate(lang, 'catalog.filters')}
				{#if activeFilterCount > 0}
					<span
						class="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 text-[11px] text-white"
					>
						{activeFilterCount}
					</span>
				{/if}
				<span class="ml-auto text-[var(--color-muted)]">{filtersOpen ? '▴' : '▾'}</span>
			</button>
			{#if activeFilterCount > 0}
				<button type="button" class="btn-ghost px-3 text-sm" onclick={resetFilters}
					>{translate(lang, 'catalog.reset')}</button
				>
			{/if}
		</div>

		<div class={`grid grid-cols-1 gap-2 sm:grid-cols-3 ${filtersOpen ? '' : 'hidden md:grid'}`}>
			<label class="field-label">
				{translate(lang, 'catalog.bodyPart')}
				<select class="field mt-1 w-full" bind:value={filters.bodyPart}>
					<option value="all">{translate(lang, 'catalog.all')}</option>
					{#each bodyParts as part (part)}
						<option value={part}>{labelBodyPart(part, lang)}</option>
					{/each}
				</select>
			</label>
			<label class="field-label">
				{translate(lang, 'catalog.equipment')}
				<select class="field mt-1 w-full" bind:value={filters.equipment}>
					<option value="all">{translate(lang, 'catalog.all')}</option>
					{#each equipment as item (item)}
						<option value={item}>{labelEquipment(item, lang)}</option>
					{/each}
				</select>
			</label>
			<label class="field-label">
				{translate(lang, 'catalog.muscle')}
				<select class="field mt-1 w-full" bind:value={filters.target}>
					<option value="all">{translate(lang, 'catalog.all')}</option>
					{#each targets as item (item)}
						<option value={item}>{labelTarget(item, lang)}</option>
					{/each}
				</select>
			</label>
		</div>
	</div>
</div>
