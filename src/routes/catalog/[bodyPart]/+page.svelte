<script lang="ts">
	import CatalogExerciseList from '$lib/components/CatalogExerciseList.svelte';
	import CatalogTargetGrid from '$lib/components/CatalogTargetGrid.svelte';
	import CatalogCategoryGridSkeleton from '$lib/components/CatalogCategoryGridSkeleton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { catalogZonePath, CATALOG_HUB_ZONE_COUNT, isBuilderReturnPath, labelCatalogZone, withFromParam } from '$lib/domain/catalogLinks';
	import { resolveBackFrom } from '$lib/domain/navigation';
	import { labelTarget } from '$lib/domain/labels.ru';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { resolveSeoLang } from '$lib/seo/seoLang';
	import { backLabelForHref } from '$lib/i18n/backLabel';
	import { resolvedLocale } from '$lib/stores/locale';
	import { readSearchParam } from '$lib/navigation/urlSearchParams';
	import { ArrowLeft } from '@lucide/svelte';
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
	let urlBrowse = $derived(readSearchParam($page.url, 'browse') ?? '');
	let effectiveTarget = $derived(data.initialTarget || urlTarget);
	let effectiveBrowse = $derived(data.initialBrowse || urlBrowse);
	let hasTargetBrowse = $derived(data.bodyPart !== 'all' && data.targetChips.length >= 2);
	let showTargetBrowse = $derived(
		hasTargetBrowse && !effectiveTarget && effectiveBrowse !== 'all'
	);
	let showExerciseList = $derived(!showTargetBrowse);
	let exerciseTitle = $derived(
		effectiveTarget ? labelTarget(effectiveTarget, lang) : title
	);
	let inTargetList = $derived(
		showExerciseList &&
			hasTargetBrowse &&
			(Boolean(effectiveTarget) || effectiveBrowse === 'all')
	);
	let fromParam = $derived(readSearchParam($page.url, 'from'));
	let fromBuilder = $derived(isBuilderReturnPath(fromParam));
	let hubHref = $derived(withFromParam('/exercises', fromParam));
	let zoneBrowseHref = $derived(withFromParam(catalogZonePath(data.bodyPart), fromParam));
	/** Builder flow: hub ← zone browse ← exercise list (keep `from`). */
	let backHref = $derived.by(() => {
		if (fromBuilder) {
			if (inTargetList) return zoneBrowseHref;
			if (showTargetBrowse || data.bodyPart === 'all') return hubHref;
			return hubHref;
		}
		if (inTargetList) return withFromParam(catalogZonePath(data.bodyPart), fromParam);
		return resolveBackFrom(fromParam, '/exercises');
	});
	let backLabel = $derived.by(() => {
		if (fromBuilder) {
			if (inTargetList) return title;
			return translate(lang, 'catalog.hubTitle');
		}
		if (inTargetList) return title;
		return backLabelForHref(backHref, lang);
	});
	let headerTitle = $derived(
		showExerciseList && effectiveTarget
			? exerciseTitle
			: showExerciseList && effectiveBrowse === 'all'
				? translate(lang, 'catalog.allExercises')
				: title
	);
	/** Dev/QA: ?skeleton=1 — preview category grid placeholders on target browse. */
	let forceSkeleton = $derived(readSearchParam($page.url, 'skeleton') === '1');
	let showTargetSkeleton = $derived(showTargetBrowse && forceSkeleton);
	let seoZoneTitle = $derived(
		data.bodyPart === 'all'
			? translate(seoLang, 'catalog.allExercises')
			: labelCatalogZone(data.bodyPart, seoLang)
	);
	let seoExerciseTitle = $derived(
		effectiveTarget ? labelTarget(effectiveTarget, seoLang) : seoZoneTitle
	);
	let seoHeaderTitle = $derived(
		showExerciseList && effectiveTarget
			? seoExerciseTitle
			: showExerciseList && effectiveBrowse === 'all'
				? translate(seoLang, 'catalog.allExercises')
				: seoZoneTitle
	);
	let seoHeadTitle = $derived(
		showExerciseList && effectiveTarget
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
	class={`content-page content-page--catalog ${showTargetBrowse ? 'catalog-page--browse' : 'catalog-page--list'}`}
>
	<ScreenHeader
		class="lg:hidden"
		fixed={showExerciseList}
		title={headerTitle}
		{backHref}
		{backLabel}
	/>

	<section
		class={`catalog-zone-shell ${showTargetBrowse ? 'catalog-zone-shell--browse' : 'catalog-zone-shell--list'}`}
	>
		<div class="catalog-subroute-header">
			<a class="catalog-zone-crumb-link" href={backHref}>
				<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
				{backLabel}
			</a>
			<div class="page-header page-header--compact catalog-zone-head">
				<h1 class="page-title catalog-zone-title">{headerTitle}</h1>
			</div>
		</div>

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
		{:else if showExerciseList}
			<!-- Key = route shell only. Facets (q/equipment/target) sync via props+effects;
			     including them remounts mid-typing and eats keystrokes. -->
			{#key `${data.bodyPart}|${effectiveBrowse}|${effectiveTarget}|${fromBuilder ? 'builder' : 'browse'}`}
				<CatalogExerciseList
					equipment={data.equipment}
					targets={data.targets}
					totalCount={data.totalCount}
					indexError={data.indexError}
					{presetBodyPart}
					initialQuery={data.initialQuery}
					initialEquipment={data.initialEquipment}
					initialTarget={effectiveTarget}
					initialBodyPart={data.initialBodyPart}
					gridOnDesktop
				/>
			{/key}
		{/if}
	</section>
</div>
