<script lang="ts">
	import CatalogTargetCard from '$lib/components/CatalogTargetCard.svelte';
	import { catalogZonePath } from '$lib/domain/catalogLinks';
	import type { TargetChip } from '$lib/domain/filters';
	import { labelTarget } from '$lib/domain/labels.ru';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		bodyPart,
		chips,
		zoneCount,
		targetCovers,
		zoneCover = '',
		equipment = '',
		query = ''
	}: {
		bodyPart: string;
		chips: TargetChip[];
		zoneCount: number;
		targetCovers: Record<string, string>;
		zoneCover?: string;
		equipment?: string;
		query?: string;
	} = $props();

	let lang = $derived($resolvedLocale);

	function targetHref(target?: string, browse?: string) {
		return catalogZonePath(bodyPart, {
			target: target && target !== 'all' ? target : undefined,
			browse,
			equipment: equipment || undefined,
			q: query.trim() || undefined
		});
	}
</script>

{#if chips.length >= 2}
	<nav
		class="catalog-target-grid catalog-hub-grid"
		aria-label={translate(lang, 'catalog.targetChipsAria')}
	>
		<CatalogTargetCard
			label={translate(lang, 'catalog.allExercises')}
			href={targetHref(undefined, 'all')}
			count={zoneCount}
			coverImage={zoneCover || null}
		/>
		{#each chips as chip (chip.target)}
			<CatalogTargetCard
				label={labelTarget(chip.target, lang)}
				href={targetHref(chip.target)}
				count={chip.count}
				coverImage={targetCovers[chip.target] ?? null}
			/>
		{/each}
	</nav>
{/if}
