<script lang="ts">
	import CatalogExerciseList from '$lib/components/CatalogExerciseList.svelte';
	import CatalogEquipmentGrid from '$lib/components/CatalogEquipmentGrid.svelte';
	import CatalogTargetGrid from '$lib/components/CatalogTargetGrid.svelte';
	import CatalogCategoryGridSkeleton from '$lib/components/CatalogCategoryGridSkeleton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import {
		catalogZonePath,
		CATALOG_HUB_ZONE_COUNT,
		isBuilderReturnPath,
		labelCatalogZone,
		withFromParam
	} from '$lib/domain/catalogLinks';
	import { resolveBackFrom } from '$lib/domain/navigation';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { resolveSeoLang } from '$lib/seo/seoLang';
	import { backLabelForHref } from '$lib/i18n/backLabel';
	import { resolvedLocale } from '$lib/stores/locale';
	import { readSearchParam } from '$lib/navigation/urlSearchParams';
	import { page } from '$app/stores';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let seoLang = $derived(resolveSeoLang($page.data.seoLocale, lang));
	let title = $derived(
		data.bodyPart === 'all'
			? translate(lang, 'catalog.allExercises')
			: labelCatalogZone(data.bodyPart, lang)
	);
	let presetBodyPart = $derived(data.bodyPart === 'all' ? 'all' : data.bodyPart);
	let urlTarget = $derived(readSearchParam($page.url, 'target') ?? '');
	let urlEquipment = $derived(readSearchParam($page.url, 'equipment') ?? '');
	let urlBrowse = $derived(readSearchParam($page.url, 'browse') ?? '');
	let effectiveTarget = $derived(data.initialTarget || urlTarget);
	let effectiveEquipment = $derived(data.initialEquipment || urlEquipment);
	let effectiveBrowse = $derived(data.initialBrowse || urlBrowse);
	let hasTargetBrowse = $derived(data.bodyPart !== 'all' && data.targetChips.length >= 2);
	let hasEquipmentBrowse = $derived(!hasTargetBrowse && data.equipmentChips.length >= 2);
	let showTargetBrowse = $derived(
		hasTargetBrowse && !effectiveTarget && effectiveBrowse !== 'all'
	);
	let showEquipmentBrowse = $derived(
		hasEquipmentBrowse && !effectiveEquipment && effectiveBrowse !== 'all'
	);
	let showCategoryBrowse = $derived(showTargetBrowse || showEquipmentBrowse);
	let showExerciseList = $derived(!showCategoryBrowse);
	let exerciseTitle = $derived.by(() => {
		if (effectiveTarget) return labelTarget(effectiveTarget, lang);
		if (effectiveEquipment) return labelEquipment(effectiveEquipment, lang);
		return title;
	});
	let inTargetList = $derived(
		showExerciseList &&
			hasTargetBrowse &&
			(Boolean(effectiveTarget) || effectiveBrowse === 'all')
	);
	let inEquipmentList = $derived(
		showExerciseList &&
			hasEquipmentBrowse &&
			(Boolean(effectiveEquipment) || effectiveBrowse === 'all')
	);
	let inSubList = $derived(inTargetList || inEquipmentList);
	let fromParam = $derived(readSearchParam($page.url, 'from'));
	let fromBuilder = $derived(isBuilderReturnPath(fromParam));
	let hubHref = $derived(withFromParam('/exercises', fromParam));
	let zoneBrowseHref = $derived(withFromParam(catalogZonePath(data.bodyPart), fromParam));
	/** Builder flow: hub ← zone browse ← exercise list (keep `from`). */
	let backHref = $derived.by(() => {
		if (fromBuilder) {
			if (inSubList) return zoneBrowseHref;
			if (showCategoryBrowse || data.bodyPart === 'all') return hubHref;
			return hubHref;
		}
		if (inSubList) return withFromParam(catalogZonePath(data.bodyPart), fromParam);
		return resolveBackFrom(fromParam, '/exercises');
	});
	let backLabel = $derived.by(() => {
		if (fromBuilder) {
			if (inSubList) return title;
			return translate(lang, 'catalog.hubTitle');
		}
		if (inSubList) return title;
		return backLabelForHref(backHref, lang);
	});
	let headerTitle = $derived(
		showExerciseList && (effectiveTarget || effectiveEquipment)
			? exerciseTitle
			: showExerciseList && effectiveBrowse === 'all'
				? translate(lang, 'catalog.allExercises')
				: title
	);
	/** Dev/QA: ?skeleton=1 — preview category grid placeholders on target browse. */
	let forceSkeleton = $derived(readSearchParam($page.url, 'skeleton') === '1');
	let showTargetSkeleton = $derived(showCategoryBrowse && forceSkeleton);
	let seoZoneTitle = $derived(
		data.bodyPart === 'all'
			? translate(seoLang, 'catalog.allExercises')
			: labelCatalogZone(data.bodyPart, seoLang)
	);
	let seoExerciseTitle = $derived.by(() => {
		if (effectiveTarget) return labelTarget(effectiveTarget, seoLang);
		if (effectiveEquipment) return labelEquipment(effectiveEquipment, seoLang);
		return seoZoneTitle;
	});
	let seoHeaderTitle = $derived(
		showExerciseList && (effectiveTarget || effectiveEquipment)
			? seoExerciseTitle
			: showExerciseList && effectiveBrowse === 'all'
				? translate(seoLang, 'catalog.allExercises')
				: seoZoneTitle
	);
	let seoHeadTitle = $derived(
		showExerciseList && (effectiveTarget || effectiveEquipment)
			? `${seoExerciseTitle} · ${seoZoneTitle}`
			: seoHeaderTitle
	);
</script>

<SeoHead
	title={seoHeadTitle}
	descriptionKey="seo.catalogZoneDescription"
	vars={{ zone: seoZoneTitle }}
	path={catalogZonePath(data.bodyPart)}
/>

<div
	class={`content-page content-page--catalog ${showCategoryBrowse ? 'catalog-page--browse' : 'catalog-page--list'}`}
>
	<ScreenHeader
		fixed={showExerciseList}
		title={headerTitle}
		{backHref}
		backLabelVisible
		{backLabel}
	/>

	<section
		class={`catalog-zone-shell ${showCategoryBrowse ? 'catalog-zone-shell--browse' : 'catalog-zone-shell--list'}`}
	>
		{#if showTargetSkeleton}
			<CatalogCategoryGridSkeleton label={translate(lang, 'common.loading')} rows={CATALOG_HUB_ZONE_COUNT} />
		{:else if showTargetBrowse}
			<CatalogTargetGrid
				bodyPart={data.bodyPart}
				chips={data.targetChips}
				zoneCount={data.zoneCount}
				targetCovers={data.targetCovers}
				zoneCover={data.zoneCover}
				equipment={data.initialEquipment}
				query={data.initialQuery}
				from={fromParam}
			/>
		{:else if showEquipmentBrowse}
			<CatalogEquipmentGrid
				bodyPart={data.bodyPart}
				chips={data.equipmentChips}
				zoneCount={data.zoneCount}
				equipmentCovers={data.equipmentCovers}
				zoneCover={data.zoneCover}
				query={data.initialQuery}
				from={fromParam}
			/>
		{:else if showExerciseList}
			<!-- Key = route shell only. Facets (q/equipment/target) sync via props+effects;
			     including them remounts mid-typing and eats keystrokes. -->
			{#key `${data.bodyPart}|${effectiveBrowse}|${effectiveTarget}|${effectiveEquipment}|${fromBuilder ? 'builder' : 'browse'}`}
				<CatalogExerciseList
					equipment={data.equipment}
					targets={data.targets}
					totalCount={data.totalCount}
					indexError={data.indexError}
					{presetBodyPart}
					initialQuery={data.initialQuery}
					initialEquipment={effectiveEquipment}
					initialTarget={effectiveTarget}
					initialBodyPart={data.initialBodyPart}
					gridOnDesktop
				/>
			{/key}
		{/if}
	</section>
</div>
