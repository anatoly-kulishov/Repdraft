<script lang="ts">
	import CatalogCategoryCard from '$lib/components/CatalogCategoryCard.svelte';
	import { catalogZonePath, withFromParam } from '$lib/domain/catalogLinks';
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
		query = '',
		from = null as string | null
	}: {
		bodyPart: string;
		chips: TargetChip[];
		zoneCount: number;
		targetCovers: Record<string, string>;
		zoneCover?: string;
		equipment?: string;
		query?: string;
		from?: string | null;
	} = $props();

	let lang = $derived($resolvedLocale);

	function targetHref(target?: string, browse?: string) {
		return withFromParam(
			catalogZonePath(bodyPart, {
				target: target && target !== 'all' ? target : undefined,
				browse,
				equipment: equipment || undefined,
				q: query.trim() || undefined
			}),
			from
		);
	}
</script>

{#if chips.length >= 2}
	<nav
		class="catalog-target-grid catalog-hub-grid"
		aria-label={translate(lang, 'catalog.targetChipsAria')}
	>
		<CatalogCategoryCard
			label={translate(lang, 'catalog.allExercises')}
			href={targetHref(undefined, 'all')}
			count={zoneCount}
			coverImage={zoneCover || null}
			priority
		/>
		{#each chips as chip (chip.target)}
			<CatalogCategoryCard
				label={labelTarget(chip.target, lang)}
				href={targetHref(chip.target)}
				count={chip.count}
				coverImage={targetCovers[chip.target] ?? null}
			/>
		{/each}
	</nav>
{/if}
