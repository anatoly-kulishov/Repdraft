<script lang="ts">
	import CatalogExerciseList from '$lib/components/CatalogExerciseList.svelte';
	import CatalogTargetChips from '$lib/components/CatalogTargetChips.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { labelCatalogZone } from '$lib/domain/catalogLinks';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ArrowLeft } from '@lucide/svelte';

	let { data } = $props();

	let lang = $derived($resolvedLocale);
	let title = $derived(
		data.bodyPart === 'all'
			? translate(lang, 'catalog.allExercises')
			: labelCatalogZone(data.bodyPart, lang)
	);
	let presetBodyPart = $derived(data.bodyPart === 'all' ? 'all' : data.bodyPart);
	let showTargetChips = $derived(data.bodyPart !== 'all' && data.targetChips.length >= 2);
</script>

<svelte:head>
	<title>{title} — Repdraft</title>
</svelte:head>

<div class="content-page content-page--wide">
	<ScreenHeader {title} backHref="/exercises" />

	<section class="catalog-zone-shell">
		<div class="catalog-subroute-header">
			<a class="catalog-zone-crumb-link" href="/exercises">
				<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
				{translate(lang, 'catalog.hubTitle')}
			</a>
			<div class="page-header page-header--compact catalog-zone-head">
				<h1 class="page-title catalog-zone-title">{title}</h1>
			</div>
		</div>

		{#if showTargetChips}
			<CatalogTargetChips
				bodyPart={data.bodyPart}
				chips={data.targetChips}
				zoneCount={data.zoneCount}
				activeTarget={data.initialTarget}
				equipment={data.initialEquipment}
				query={data.initialQuery}
			/>
		{/if}

		{#key `${data.bodyPart}|${data.initialEquipment}|${data.initialTarget}|${data.initialQuery}`}
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
				hideTargetFilter={showTargetChips}
				gridOnDesktop
			/>
		{/key}
	</section>
</div>
