<script lang="ts">
	import SearchInput from '$lib/components/SearchInput.svelte';
	import { labelBodyPart, labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import type { ExerciseFilters } from '$lib/domain/types';

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
</script>

<div
	class="sticky top-0 z-20 -mx-4 mb-4 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_92%,white)] px-4 py-3 backdrop-blur md:-mx-6 md:px-6"
>
	<div class="mx-auto flex max-w-6xl flex-col gap-3">
		<SearchInput bind:value={filters.query} />
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
			<label class="block text-xs font-medium text-[var(--color-muted)]">
				Часть тела
				<select class="field mt-1 w-full" bind:value={filters.bodyPart}>
					<option value="all">Все</option>
					{#each bodyParts as part (part)}
						<option value={part}>{labelBodyPart(part)}</option>
					{/each}
				</select>
			</label>
			<label class="block text-xs font-medium text-[var(--color-muted)]">
				Оборудование
				<select class="field mt-1 w-full" bind:value={filters.equipment}>
					<option value="all">Все</option>
					{#each equipment as item (item)}
						<option value={item}>{labelEquipment(item)}</option>
					{/each}
				</select>
			</label>
			<label class="block text-xs font-medium text-[var(--color-muted)]">
				Мышца
				<select class="field mt-1 w-full" bind:value={filters.target}>
					<option value="all">Все</option>
					{#each targets as item (item)}
						<option value={item}>{labelTarget(item)}</option>
					{/each}
				</select>
			</label>
		</div>
	</div>
</div>
