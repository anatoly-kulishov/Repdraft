<script lang="ts">
	import CatalogExerciseList from '$lib/components/CatalogExerciseList.svelte';
	import CatalogTargetGrid from '$lib/components/CatalogTargetGrid.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { catalogZonePath, isBuilderReturnPath, labelCatalogZone } from '$lib/domain/catalogLinks';
	import { labelTarget } from '$lib/domain/labels.ru';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ArrowLeft } from '@lucide/svelte';
	import { page } from '$app/stores';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let title = $derived(
		data.bodyPart === 'all'
			? translate(lang, 'catalog.allExercises')
			: labelCatalogZone(data.bodyPart, lang)
	);
	let presetBodyPart = $derived(data.bodyPart === 'all' ? 'all' : data.bodyPart);
	let hasTargetBrowse = $derived(data.bodyPart !== 'all' && data.targetChips.length >= 2);
	let showTargetBrowse = $derived(
		hasTargetBrowse && !data.initialTarget && data.initialBrowse !== 'all'
	);
	let showExerciseList = $derived(!showTargetBrowse);
	let exerciseTitle = $derived(
		data.initialTarget ? labelTarget(data.initialTarget, lang) : title
	);
	let inTargetList = $derived(
		showExerciseList &&
			hasTargetBrowse &&
			(Boolean(data.initialTarget) || data.initialBrowse === 'all')
	);
	let fromParam = $derived($page.url.searchParams.get('from'));
	let fromBuilder = $derived(isBuilderReturnPath(fromParam));
	let backHref = $derived(
		fromBuilder ? '/builder' : inTargetList ? catalogZonePath(data.bodyPart) : '/exercises'
	);
	let backLabel = $derived(
		fromBuilder
			? translate(lang, 'builder.createTitle')
			: inTargetList
				? title
				: translate(lang, 'catalog.hubTitle')
	);
	let headerTitle = $derived(
		showExerciseList && data.initialTarget
			? exerciseTitle
			: showExerciseList && data.initialBrowse === 'all'
				? translate(lang, 'catalog.allExercises')
				: title
	);
</script>

<svelte:head>
	<title>{showExerciseList && data.initialTarget ? `${exerciseTitle} · ${title}` : headerTitle} · Repdraft</title>
</svelte:head>

<div class="content-page content-page--catalog">
	<ScreenHeader class="md:hidden" title={headerTitle} {backHref} />

	<section class="catalog-zone-shell">
		<div class="catalog-subroute-header">
			<a class="catalog-zone-crumb-link" href={backHref}>
				<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
				{backLabel}
			</a>
			<div class="page-header page-header--compact catalog-zone-head">
				<h1 class="page-title catalog-zone-title">{headerTitle}</h1>
			</div>
		</div>

		{#if showTargetBrowse}
			<CatalogTargetGrid
				bodyPart={data.bodyPart}
				chips={data.targetChips}
				zoneCount={data.zoneCount}
				targetCovers={data.targetCovers}
				zoneCover={data.zoneCover}
				equipment={data.initialEquipment}
				query={data.initialQuery}
			/>
		{:else if showExerciseList}
			<!-- Key = route shell only. Facets (q/equipment/target) sync via props+effects;
			     including them remounts mid-typing and eats keystrokes. -->
			{#key `${data.bodyPart}|${data.initialBrowse}|${fromBuilder ? 'builder' : 'browse'}`}
				<CatalogExerciseList
					bodyParts={data.bodyParts}
					equipment={data.equipment}
					targets={data.targets}
					totalCount={data.totalCount}
					indexError={data.indexError}
					{presetBodyPart}
					initialQuery={data.initialQuery}
					initialEquipment={data.initialEquipment}
					initialTarget={data.initialTarget}
					initialBodyPart={data.initialBodyPart}
					gridOnDesktop
				/>
			{/key}
		{/if}
	</section>
</div>
