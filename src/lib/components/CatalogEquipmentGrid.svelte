<script lang="ts">
	import CatalogCategoryCard from '$lib/components/CatalogCategoryCard.svelte';
	import { catalogZonePath, withFromParam } from '$lib/domain/catalogLinks';
	import type { EquipmentChip } from '$lib/domain/filters';
	import { labelEquipment } from '$lib/domain/labels.ru';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		bodyPart,
		chips,
		zoneCount,
		equipmentCovers,
		zoneCover = '',
		query = '',
		from = null as string | null
	}: {
		bodyPart: string;
		chips: EquipmentChip[];
		zoneCount: number;
		equipmentCovers: Record<string, string>;
		zoneCover?: string;
		query?: string;
		from?: string | null;
	} = $props();

	let lang = $derived($resolvedLocale);

	function equipmentHref(equipment?: string, browse?: string) {
		return withFromParam(
			catalogZonePath(bodyPart, {
				equipment: equipment && equipment !== 'all' ? equipment : undefined,
				browse,
				q: query.trim() || undefined
			}),
			from
		);
	}
</script>

{#if chips.length >= 2}
	<nav
		class="catalog-target-grid catalog-hub-grid"
		aria-label={translate(lang, 'catalog.equipmentChipsAria')}
	>
		<CatalogCategoryCard
			label={translate(lang, 'catalog.allExercises')}
			href={equipmentHref(undefined, 'all')}
			count={zoneCount}
			coverImage={zoneCover || null}
			priority
		/>
		{#each chips as chip (chip.equipment)}
			<CatalogCategoryCard
				label={labelEquipment(chip.equipment, lang)}
				href={equipmentHref(chip.equipment)}
				count={chip.count}
				coverImage={equipmentCovers[chip.equipment] ?? null}
			/>
		{/each}
	</nav>
{/if}
